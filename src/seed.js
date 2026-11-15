const pool = require('./db');
const bcrypt = require('bcryptjs');

async function seed() {
  try {
    await pool.query('TRUNCATE order_item_modifiers, order_items, orders, time_slots, modifiers, dishes, categories, users RESTART IDENTITY CASCADE');

    const hash = await bcrypt.hash('123456', 10);
    await pool.query(`
      INSERT INTO users (email, password, name, role) VALUES 
      ('visitor@test.com', $1, 'Іван Відвідувач', 'VISITOR'),
      ('operator@test.com', $1, 'Марія Оператор', 'OPERATOR')
    `, [hash]);

    const catRes = await pool.query(`
      INSERT INTO categories (name) VALUES 
      ('Гарячі страви'), ('Салати'), ('Напої'), ('Десерти')
      RETURNING id, name
    `);
    
    const hot = catRes.rows.find(r => r.name === 'Гарячі страви').id;
    const salad = catRes.rows.find(r => r.name === 'Салати').id;
    const drink = catRes.rows.find(r => r.name === 'Напої').id;
    const dessert = catRes.rows.find(r => r.name === 'Десерти').id;

    const dishRes = await pool.query(`
      INSERT INTO dishes (name, description, composition, allergens, price, category_id, image_url) VALUES 
      -- ГАРЯЧІ СТРАВИ
      ('Борщ з пампушкою', 'Класичний український борщ', 'Буряк, капуста, картопля, м''ясо', 'Молоко (сметана)', 95.00, $1, 'https://images.pexels.com/photos/10467829/pexels-photo-10467829.jpeg'),
      ('Вареники з картоплею', 'Зі сметаною та цибулею', 'Тісто, картопля, цибуля', 'Глютен, Молоко', 85.00, $1, 'https://images.pexels.com/photos/19503799/pexels-photo-19503799.jpeg'),
      ('Курка гриль', 'Соковита курка зі спеціями', 'Курка, спеції', '-', 150.00, $1, 'https://images.pexels.com/photos/17429043/pexels-photo-17429043.jpeg'),
      ('Стейк зі свинини', 'З овочами гриль', 'Свинина, перець, цибуля', '-', 210.00, $1, 'https://images.pexels.com/photos/675951/pexels-photo-675951.jpeg'),
      -- САЛАТИ
      ('Цезар з куркою', 'Салат з куркою та сухариками', 'Курка, салат, пармезан, грінки', 'Глютен, Молоко', 130.00, $2, 'https://images.pexels.com/photos/28618644/pexels-photo-28618644.jpeg'),
      ('Грецький салат', 'Свіжий салат з фетою', 'Огірок, помідор, фета, оливки', 'Молоко', 110.00, $2, 'https://images.pexels.com/photos/13467083/pexels-photo-13467083.jpeg'),
      ('Вітамінний', 'Зі свіжої капусти та моркви', 'Капуста, морква, олія', '-', 70.00, $2, 'https://images.pexels.com/photos/5639351/pexels-photo-5639351.jpeg'),
      ('Олів''є', 'Класичний салат', 'Ковбаса, горошок, картопля, яйце', 'Яйця', 90.00, $2, 'https://images.pexels.com/photos/19674143/pexels-photo-19674143.jpeg'),
      -- НАПОЇ
      ('Ягідний фреш', 'Освіжаючий напій зі свіжих ягід', 'Малина, полуниця, лайм, лід', '-', 55.00, $3, 'https://images.unsplash.com/photo-1595981267035-7b04ca84a82d?w=500&q=80'),
      ('Лимонад', 'Домашній цитрусовий', 'Лимон, апельсин, м''ята', '-', 55.00, $3, 'https://images.pexels.com/photos/33107433/pexels-photo-33107433.jpeg'),
      ('Чай чорний', 'Цейлонський', 'Чай, вода', '-', 30.00, $3, 'https://images.pexels.com/photos/17512812/pexels-photo-17512812.jpeg'),
      ('Кава Американо', 'Натуральна кава', 'Кавові зерна, вода', '-', 45.00, $3, 'https://images.unsplash.com/photo-1551030173-122aabc4489c?w=500&q=80'),
      -- ДЕСЕРТИ
      ('Медовик', 'Ніжний медовий торт', 'Борошно, мед, сметана', 'Глютен, Молоко', 80.00, $4, 'https://images.pexels.com/photos/14708995/pexels-photo-14708995.jpeg'),
      ('Тірамісу', 'Класичний італійський десерт', 'Печиво, кава, маскарпоне', 'Глютен, Молоко', 90.00, $4, 'https://images.unsplash.com/photo-1571115177098-24ec42ed204d?w=500&q=80'),
      ('Чізкейк', 'Нью-Йорк з ягодами', 'Сир, печиво, ягоди', 'Глютен, Молоко', 95.00, $4, 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=500&q=80'),
      ('Шоколадний брауні', 'З кулькою морозива', 'Шоколад, борошно, яйця', 'Глютен, Яйця, Молоко', 85.00, $4, 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=500&q=80')
      RETURNING id, name
    `, [hot, salad, drink, dessert]);

    const getDishId = (name) => dishRes.rows.find(r => r.name === name).id;

    await pool.query(`
      INSERT INTO modifiers (dish_id, name, price, max_per_dish) VALUES 
      ($1, 'Сметана', 15.00, 2),
      ($1, 'Пампушка', 20.00, 3),
      ($1, 'Зелень', 5.00, 1),
      ($2, 'Сметана', 15.00, 2),
      ($2, 'Шкварки', 25.00, 1),
      ($3, 'Соус часниковий', 10.00, 1),
      ($3, 'Хліб', 10.00, 1),
      ($4, 'Куряче філе', 40.00, 1),
      ($4, 'Пармезан', 20.00, 1),
      ($5, 'Лимон', 5.00, 1),
      ($6, 'Лід', 0.00, 1),
      ($7, 'Молоко', 10.00, 1),
      ($8, 'Кулька морозива', 30.00, 1)
    `, [
      getDishId('Борщ з пампушкою'), 
      getDishId('Вареники з картоплею'), 
      getDishId('Курка гриль'), 
      getDishId('Цезар з куркою'), 
      getDishId('Ягідний фреш'), 
      getDishId('Лимонад'), 
      getDishId('Кава Американо'),
      getDishId('Медовик')
    ]);

    // Слоти на 3 дні вперед
    for (let i = 0; i < 3; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      
      // Ручне форматування дати для уникнення зсуву часових поясів
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      await pool.query(`
        INSERT INTO time_slots (date, start_time, end_time, max_orders) VALUES 
        ($1, '10:00', '10:30', 5),
        ($1, '12:00', '12:30', 5),
        ($1, '14:00', '14:30', 5),
        ($1, '16:00', '16:30', 5),
        ($1, '18:00', '18:30', 5),
        ($1, '20:00', '20:30', 5)
      `, [dateStr]);
    }

    console.log('База наповнена (16 страв, 4 категорії, слоти на 3 дні)');
    process.exit(0);
  } catch (err) {
    console.error('Помилка seed:', err);
    process.exit(1);
  }
}
seed();