const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { createOrder } = require('../services/orderService');

// Функція для отримання лише актуальних слотів
async function getAvailableSlots() {
  const slotsRes = await pool.query(
    `SELECT s.*, 
     (SELECT COUNT(*) FROM orders o WHERE o.slot_id = s.id AND o.status != 'CANCELLED') as current_orders
     FROM time_slots s 
     WHERE s.date >= CURRENT_DATE 
     ORDER BY s.date, s.start_time`
  );

  const now = new Date();
  // Отримуємо поточний час у форматі "ГГ:ХХ"
  const currentTime = now.getHours().toString().padStart(2, '0') + ':' + 
                      now.getMinutes().toString().padStart(2, '0');
  
  // Отримуємо сьогоднішню дату у форматі "РРРР-ММ-ДД"
  const today = now.getFullYear() + '-' + 
                (now.getMonth() + 1).toString().padStart(2, '0') + '-' + 
                now.getDate().toString().padStart(2, '0');

  // Фільтруємо слоти
  return slotsRes.rows.filter(slot => {
    const d = new Date(slot.date);
    const slotDate = d.getFullYear() + '-' +
                     (d.getMonth() + 1).toString().padStart(2, '0') + '-' +
                     d.getDate().toString().padStart(2, '0');
    
    if (slotDate > today) return true; // Майбутні дні залишаємо
    if (slotDate === today) {
      return slot.start_time > currentTime; // Сьогодні тільки майбутні години
    }
    return false; // Минулі дні відкидаємо
  });
}

// Сторінка оформлення (вибір слота)
router.get('/checkout', requireAuth, async (req, res) => {
  try {
    const token = crypto.randomBytes(16).toString('hex');
    req.session.checkoutToken = token;
    const validSlots = await getAvailableSlots();
    
    res.render('checkout', { slots: validSlots, error: null, token });
  } catch (err) {
    console.error(err); 
    res.status(500).send('Помилка завантаження слотів');
  }
});

// Створення замовлення
router.post('/create', requireAuth, async (req, res) => {
  const { slotId, token } = req.body;
  const cart = req.session.cart || [];
  
  if (!token || token !== req.session.checkoutToken) {
    return res.redirect('/orders/my');
  }
  req.session.checkoutToken = null;

  if (cart.length === 0) return res.redirect('/cart');

  try {
    await createOrder(req.session.user.id, parseInt(slotId), cart);
    req.session.cart = []; 
    res.redirect('/orders/my?success=1');
  } catch (err) {
    console.error(err);
    const validSlots = await getAvailableSlots();
    const newToken = crypto.randomBytes(16).toString('hex');
    req.session.checkoutToken = newToken;
    
    res.render('checkout', { slots: validSlots, error: err.message, token: newToken });
  }
});

// Мої замовлення
router.get('/my', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.*, t.date, t.start_time, t.end_time 
       FROM orders o 
       JOIN time_slots t ON o.slot_id = t.id 
       WHERE o.user_id = $1 
       ORDER BY o.created_at DESC`,
      [req.session.user.id]
    );
    
    for (let order of result.rows) {
      const items = await pool.query(
        `SELECT oi.*, d.name as dish_name 
         FROM order_items oi 
         JOIN dishes d ON oi.dish_id = d.id 
         WHERE oi.order_id = $1`,
        [order.id]
      );
      order.items = items.rows;
    }

    res.render('my-orders', { orders: result.rows, success: req.query.success === '1' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Помилка завантаження замовлень');
  }
});

// Скасування замовлення
router.post('/:id/cancel', requireAuth, async (req, res) => {
  try {
    const orderRes = await pool.query('SELECT * FROM orders WHERE id = $1 AND user_id = $2', [req.params.id, req.session.user.id]);
    if (orderRes.rows.length === 0) return res.status(403).send('Замовлення не знайдено');
    
    if (orderRes.rows[0].status !== 'NEW') {
      return res.status(400).send('Можна скасувати лише нове замовлення');
    }

    await pool.query("UPDATE orders SET status = 'CANCELLED' WHERE id = $1", [req.params.id]);
    res.redirect('/orders/my');
  } catch (err) {
    console.error(err);
    res.status(500).send('Помилка');
  }
});

module.exports = router;