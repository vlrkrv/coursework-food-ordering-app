const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireRole } = require('../middleware/auth');

// Всі замовлення для оператора
router.get('/orders', requireRole('OPERATOR'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.*, u.name as user_name, t.date, t.start_time 
       FROM orders o 
       JOIN users u ON o.user_id = u.id 
       JOIN time_slots t ON o.slot_id = t.id 
       ORDER BY o.created_at DESC`
    );
    res.render('operator/orders', { orders: result.rows });
  } catch (err) {
    res.status(500).send('Помилка');
  }
});

// Зміна статусу
router.post('/orders/:id/status', requireRole('OPERATOR'), async (req, res) => {
  const { status } = req.body;
  const allowedStatuses = ['CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'];
  
  if (!allowedStatuses.includes(status)) return res.status(400).send('Некоректний статус');

  try {
    await pool.query('UPDATE orders SET status = $1 WHERE id = $2', [status, req.params.id]);
    res.redirect('/operator/orders');
  } catch (err) {
    res.status(500).send('Помилка');
  }
});
// Панель керування меню (доступність страв)
router.get('/menu', requireRole('OPERATOR'), async (req, res) => {
  try {
    const dishes = await pool.query(
      `SELECT d.*, c.name as category_name 
       FROM dishes d 
       JOIN categories c ON d.category_id = c.id 
       ORDER BY c.name, d.name`
    );
    res.render('operator/menu', { dishes: dishes.rows });
  } catch (err) {
    res.status(500).send('Помилка');
  }
});

// Зміна доступності страви
router.post('/menu/:id/toggle', requireRole('OPERATOR'), async (req, res) => {
  try {
    await pool.query(
      'UPDATE dishes SET available = NOT available WHERE id = $1',
      [req.params.id]
    );
    res.redirect('/operator/menu');
  } catch (err) {
    res.status(500).send('Помилка');
  }
});

module.exports = router;