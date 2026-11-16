require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.cartCount = (req.session.cart || []).length;
  next();
});

app.use('/', require('./src/routes/auth'));
app.use('/menu', require('./src/routes/menu'));
app.use('/cart', require('./src/routes/cart'));
app.use('/orders', require('./src/routes/orders'));
app.use('/operator', require('./src/routes/operator'));

app.get('/', (req, res) => res.render('index'));

// Запускаємо сервер лише якщо файл викликано напряму (а не через тести)
if (require.main === module) {
  app.listen(PORT, () => console.log(`Сервер запущено на http://localhost:${PORT}`));
}

module.exports = app;