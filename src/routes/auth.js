const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../db');

// Форма входу
router.get('/login', (req, res) => {
  res.render('login', { error: null });
});

// Обробка входу
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.render('login', { error: 'Користувача не знайдено' });
    }
    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.render('login', { error: 'Невірний пароль' });
    }
    req.session.user = { id: user.id, name: user.name, role: user.role };
    res.redirect('/menu');
  } catch (err) {
    res.render('login', { error: 'Помилка сервера' });
  }
});

// Форма реєстрації
router.get('/register', (req, res) => {
  res.render('register', { error: null });
});

// Обробка реєстрації
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)',
      [name, email, hash, 'VISITOR']
    );
    res.redirect('/login');
  } catch (err) {
    if (err.code === '23505') {
      return res.render('register', { error: 'Цей email вже зареєстрований' });
    }
    res.render('register', { error: 'Помилка сервера' });
  }
});

// Вихід
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

module.exports = router;