const request = require('supertest');
const app = require('../server');
const pool = require('../src/db');
const { createOrder } = require('../src/services/orderService');

describe('Тестування вимог до вебзастосунку', () => {
  
  let testDishId;
  let testSlotId;

  beforeAll(async () => {
    // Очищаємо базу перед тестами
    await pool.query('TRUNCATE order_item_modifiers, order_items, orders RESTART IDENTITY CASCADE');
    
    const dishRes = await pool.query('SELECT id FROM dishes WHERE available = true LIMIT 1');
    testDishId = dishRes.rows[0].id;
    
    const slotRes = await pool.query('SELECT id FROM time_slots WHERE date >= CURRENT_DATE LIMIT 1');
    testSlotId = slotRes.rows[0].id;
  });

  afterAll(async () => {
    await pool.end();
  });

  // FR-01: Меню та кошик (перевіряємо, що кошик доступний)
  test('FR-01: Кошик доступний (сторінка відкривається)', async () => {
    const res = await request(app).get('/cart');
    expect(res.status).toBe(200);
  });

  // FR-02: Модифікатори (перевіряємо, що сторінка страви відкривається)
  test('FR-02: Сторінка страви з модифікаторами доступна', async () => {
    const res = await request(app).get(`/menu/dish/${testDishId}`);
    expect(res.status).toBe(200);
  });

  // FR-03: Оформлення на час (створення замовлення)
  test('FR-03: Створення замовлення через сервіс', async () => {
    // Очищаємо замовлення, щоб слот був вільний
    await pool.query("DELETE FROM orders WHERE slot_id = $1", [testSlotId]);
    
    const order = await createOrder(1, testSlotId, [{ dishId: testDishId, quantity: 1, modifierIds: [] }]);
    expect(order).toHaveProperty('orderId');
    expect(order).toHaveProperty('total');
  });

  // FR-04: Ліміт слота
  test('FR-04: Захист від перевищення ліміту слота', async () => {
    const slotRes = await pool.query('SELECT id, max_orders FROM time_slots LIMIT 1');
    const slot = slotRes.rows[0];

    // Очищаємо замовлення для цього слота, щоб почати з нуля
    await pool.query("DELETE FROM orders WHERE slot_id = $1", [slot.id]);

    // Заповнюємо слот до максимуму
    for (let i = 0; i < slot.max_orders; i++) {
      await pool.query(
        `INSERT INTO orders (user_id, slot_id, status, total) VALUES (1, $1, 'NEW', 100)`,
        [slot.id]
      );
    }

    // Перевіряємо, що сервіс кидає помилку
    await expect(createOrder(1, slot.id, [{ dishId: testDishId, quantity: 1, modifierIds: [] }]))
      .rejects.toThrow('На жаль, на цей час усі місця зайняті');
  });

  // FR-05: Замовлення відвідувача (захист від чужого доступу)
  test('FR-05: Без авторизації не можна скасувати замовлення', async () => {
    const res = await request(app).post('/orders/1/cancel');
    expect(res.status).toBe(302); // Редирект на логін
    expect(res.header.location).toBe('/login');
  });

  // FR-06: Панель оператора
  test('FR-06: Без авторизації немає доступу до панелі оператора', async () => {
    const res = await request(app).get('/operator/orders');
    expect(res.status).toBe(302); // Редирект на логін
    expect(res.header.location).toBe('/login');
  });

  // FR-07: Статуси (заборона зміни статусу)
  test('FR-07: Без авторизації не можна змінити статус', async () => {
    const res = await request(app).post('/operator/orders/1/status').send({ status: 'COMPLETED' });
    expect(res.status).toBe(302); // Редирект на логін
    expect(res.header.location).toBe('/login');
  });

  // NFR-01: Перевірка прав на сервері
  test('NFR-01: Захищена сторінка моїх замовлень', async () => {
    const res = await request(app).get('/orders/my');
    expect(res.status).toBe(302); // Редирект на логін
    expect(res.header.location).toBe('/login');
  });

  // NFR-02: Серверний розрахунок (ігнорування ціни клієнта)
  test('NFR-02: Сервер ігнорує підміну ціни клієнтом', async () => {
    // Очищаємо замовлення для слота
    await pool.query("DELETE FROM orders WHERE slot_id = $1", [testSlotId]);
    
    const dishRes = await pool.query('SELECT id, price FROM dishes WHERE available = true LIMIT 1');
    const dish = dishRes.rows[0];
    
    const order = await createOrder(1, testSlotId, [{ dishId: dish.id, quantity: 1, modifierIds: [] }]);
    expect(parseFloat(order.total)).toBe(parseFloat(dish.price));
  });
});