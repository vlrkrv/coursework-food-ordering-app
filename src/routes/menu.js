const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/', async (req, res) => {
  try {
    const { category, q } = req.query;
    let query = 'SELECT d.*, c.name as category_name FROM dishes d JOIN categories c ON d.category_id = c.id WHERE d.available = true';
    const params = [];

    if (category) {
      params.push(category);
      query += ` AND d.category_id = $${params.length}`;
    }
    if (q) {
      params.push(`%${q}%`);
      query += ` AND d.name ILIKE $${params.length}`;
    }

    const dishes = await pool.query(query, params);
    const categories = await pool.query('SELECT * FROM categories');
    
    res.render('menu', { 
      dishes: dishes.rows, 
      categories: categories.rows,
      selectedCategory: category || '',
      query: q || ''
    });
  } catch (err) {
    res.status(500).send('Помилка завантаження меню');
  }
});

// Картка окремої страви з модифікаторами
router.get('/dish/:id', async (req, res) => {
  try {
    const dishRes = await pool.query('SELECT * FROM dishes WHERE id = $1', [req.params.id]);
    if (dishRes.rows.length === 0) return res.status(404).send('Страву не знайдено');
    
    const modifiersRes = await pool.query('SELECT * FROM modifiers WHERE dish_id = $1', [req.params.id]);
    res.render('dish', { dish: dishRes.rows[0], modifiers: modifiersRes.rows });
  } catch (err) {
    res.status(500).send('Помилка');
  }
});

module.exports = router;