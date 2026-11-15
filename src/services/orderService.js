const pool = require('../db');

async function createOrder(userId, slotId, cartItems) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN'); // Початок транзакції

    // 1. Перевіряємо слот
    const slotRes = await client.query('SELECT * FROM time_slots WHERE id = $1 FOR UPDATE', [slotId]);

    if (slotRes.rows.length === 0) throw new Error('Слот не знайдено');
    const slot = slotRes.rows[0];

    // 2. Перевіряємо ліміт замовлень на слот (атомарно в транзакції)
    const countRes = await client.query(
      "SELECT COUNT(*) FROM orders WHERE slot_id = $1 AND status != 'CANCELLED'",
      [slotId]
    );
    const currentOrders = parseInt(countRes.rows[0].count);
    if (currentOrders >= slot.max_orders) {
      throw new Error('На жаль, на цей час усі місця зайняті. Оберіть інший інтервал.');
    }

    // 3. Серверний розрахунок суми
    let total = 0;
    const orderItemsData = [];

    for (const item of cartItems) {
      // Беремо страву з бази (ігноруючи ціну з клієнта)
      const dishRes = await client.query('SELECT * FROM dishes WHERE id = $1 AND available = true', [item.dishId]);
      if (dishRes.rows.length === 0) throw new Error(`Страва з ID ${item.dishId} недоступна`);
      
      const dish = dishRes.rows[0];
      let itemPrice = parseFloat(dish.price);
      const modifiersData = [];

      // Рахуємо, скільки разів обрано кожен модифікатор
      const modCounts = {};
      for (const modId of item.modifierIds) {
        modCounts[modId] = (modCounts[modId] || 0) + 1;
      }

      // Перевіряємо модифікатори
      for (const modId of item.modifierIds) {
        const modRes = await client.query('SELECT * FROM modifiers WHERE id = $1 AND dish_id = $2', [modId, dish.id]);
        if (modRes.rows.length === 0) throw new Error('Некоректний модифікатор');
        
        const mod = modRes.rows[0];
        if (modCounts[modId] > mod.max_per_dish) {
          throw new Error(`Перевищено ліміт для модифікатора ${mod.name}`);
        }
        itemPrice += parseFloat(mod.price);
        modifiersData.push({ modifierId: mod.id, price: mod.price });
      }

      total += itemPrice * item.quantity;
      orderItemsData.push({
        dishId: dish.id,
        quantity: item.quantity,
        price: dish.price, // Фіксуємо ціну на момент замовлення
        modifiers: modifiersData
      });
    }

    // 4. Створюємо замовлення
    const orderRes = await client.query(
      'INSERT INTO orders (user_id, slot_id, total, status) VALUES ($1, $2, $3, $4) RETURNING id',
      [userId, slotId, total, 'NEW']
    );
    const orderId = orderRes.rows[0].id;

    // 5. Створюємо позиції замовлення та модифікатори
    for (const item of orderItemsData) {
      const itemRes = await client.query(
        'INSERT INTO order_items (order_id, dish_id, quantity, price) VALUES ($1, $2, $3, $4) RETURNING id',
        [orderId, item.dishId, item.quantity, item.price]
      );
      const orderItemId = itemRes.rows[0].id;

      for (const mod of item.modifiers) {
        await client.query(
          'INSERT INTO order_item_modifiers (order_item_id, modifier_id, price) VALUES ($1, $2, $3)',
          [orderItemId, mod.modifierId, mod.price]
        );
      }
    }

    await client.query('COMMIT'); // Зберігаємо все
    return { orderId, total };

  } catch (err) {
    await client.query('ROLLBACK'); // Відкочуємо зміни при помилці
    throw err;
  } finally {
    client.release(); // Повертаємо з'єднання в пул
  }
}

module.exports = { createOrder };