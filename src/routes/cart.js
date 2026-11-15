const express = require('express');
const router = express.Router();
const pool = require('../db');

// Перегляд кошика
router.get('/', async (req, res) => {
  const cart = req.session.cart || [];
  let cartItems = [];
  let total = 0;

  for (const item of cart) {
    const dishRes = await pool.query('SELECT * FROM dishes WHERE id = $1', [item.dishId]);
    if (dishRes.rows.length === 0) continue;
    const dish = dishRes.rows[0];
    
    let modifiers = [];
    let itemPrice = parseFloat(dish.price);
    
    if (item.modifierIds && item.modifierIds.length > 0) {
      const modRes = await pool.query('SELECT * FROM modifiers WHERE id = ANY($1)', [item.modifierIds]);
      modifiers = modRes.rows;
      modifiers.forEach(m => itemPrice += parseFloat(m.price));
    }

    const lineTotal = itemPrice * item.quantity;
    total += lineTotal;
    
    cartItems.push({ ...item, dish, modifiers, lineTotal });
  }

  res.render('cart', { cartItems, total });
});

// Додати в кошик
router.post('/add', (req, res) => {
  const { dishId, quantity, modifiers } = req.body;
  const modIds = modifiers ? (Array.isArray(modifiers) ? modifiers.map(Number) : [Number(modifiers)]) : [];
  const qty = parseInt(quantity) || 1;

  if (!req.session.cart) req.session.cart = [];
  
  // Унікальний ключ для позиції (страва + набір модифікаторів)
  const key = `${dishId}-${modIds.sort().join(',')}`;
  const existing = req.session.cart.find(i => i.key === key);
  
  if (existing) {
    existing.quantity += qty;
  } else {
    req.session.cart.push({ key, dishId: Number(dishId), quantity: qty, modifierIds: modIds });
  }

  res.redirect('/cart');
});

// Оновити кількість
router.post('/update', (req, res) => {
  const { key, quantity } = req.body;
  const qty = parseInt(quantity);
  
  if (req.session.cart && qty > 0) {
    const item = req.session.cart.find(i => i.key === key);
    if (item) item.quantity = qty;
  }
  res.redirect('/cart');
});

// Видалити з кошика
router.post('/remove', (req, res) => {
  const { key } = req.body;
  if (req.session.cart) {
    req.session.cart = req.session.cart.filter(i => i.key !== key);
  }
  res.redirect('/cart');
});

module.exports = router;