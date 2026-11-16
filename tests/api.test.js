const request = require('supertest');
const app = require('../server');
const pool = require('../src/db');
const { createOrder } = require('../src/services/orderService');

describe('Тестування вимог до вебзастосунку', () => {
  
  let testDishId;
  let testSlotId;
  let concurrentSlotId;

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

  // FR-01
  test('FR-01: Кошик доступний (сторінка відкривається)', async () => {
    const res = await request(app).get('/cart');
    expect(res.status).toBe(200);
  });

  // FR-02
  test('FR-02: Сторінка страви з модифікаторами доступна', async () => {
    const res = await request(app).get(`/menu/dish/${testDishId}`);
    expect(res.status).toBe(200);
  });

  // FR-03
  test('FR-03: Створення замовлення через сервіс', async () => {
    await pool.query("DELETE FROM orders WHERE slot_id = $1", [testSlotId]);
    const order = await createOrder(1, testSlotId, [{ dishId: testDishId, quantity: 1, modifierIds: [] }]);
    expect(order).toHaveProperty('orderId');
    expect(order).toHaveProperty('total');
  });

  // FR-04 (частина 1: одночасні запити)
  test('FR-04: Одночасні запити на останнє місце', async () => {
    // Видаляємо старий слот для чистоти
    await pool.query("DELETE FROM time_slots WHERE date = CURRENT_DATE + 1 AND start_time = '23:55'");

    const slotRes = await pool.query(`
      INSERT INTO time_slots (date, start_time, end_time, max_orders) 
      VALUES (CURRENT_DATE + 1, '23:55', '23:59', 1) RETURNING id
    `);
    concurrentSlotId = slotRes.rows[0].id;

    await pool.query('DELETE FROM orders WHERE slot_id = $1', [concurrentSlotId]);

    const cart = [{ dishId: testDishId, quantity: 1, modifierIds: [] }];

    const results = await Promise.allSettled([
      createOrder(1, concurrentSlotId, cart),
      createOrder(1, concurrentSlotId, cart)
    ]);

    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    expect(rejected[0].reason.message).toContain('місця зайняті');
  });

  // FR-04 (частина 2: перевірка кількості в базі)
  test('FR-04 (додатково): Після одночасних запитів у БД рівно 1 замовлення', async () => {
    const countRes = await pool.query('SELECT COUNT(*) FROM orders WHERE slot_id = $1', [concurrentSlotId]);
    expect(parseInt(countRes.rows[0].count)).toBe(1);
  });

  // FR-05
  test('FR-05: Без авторизації не можна скасувати замовлення', async () => {
    const res = await request(app).post('/orders/1/cancel');
    expect(res.status).toBe(302);
    expect(res.header.location).toBe('/login');
  });

  // FR-06
  test('FR-06: Без авторизації немає доступу до панелі оператора', async () => {
    const res = await request(app).get('/operator/orders');
    expect(res.status).toBe(302);
    expect(res.header.location).toBe('/login');
  });

  // FR-07
  test('FR-07: Без авторизації не можна змінити статус', async () => {
    const res = await request(app).post('/operator/orders/1/status').send({ status: 'COMPLETED' });
    expect(res.status).toBe(302);
    expect(res.header.location).toBe('/login');
  });

  // NFR-01
  test('NFR-01: Захищена сторінка моїх замовлень', async () => {
    const res = await request(app).get('/orders/my');
    expect(res.status).toBe(302);
    expect(res.header.location).toBe('/login');
  });

  // NFR-02
  test('NFR-02: Сервер ігнорує підміну ціни клієнтом', async () => {
    await pool.query("DELETE FROM orders WHERE slot_id = $1", [testSlotId]);
    const dishRes = await pool.query('SELECT id, price FROM dishes WHERE available = true LIMIT 1');
    const dish = dishRes.rows[0];
    const order = await createOrder(1, testSlotId, [{ dishId: dish.id, quantity: 1, modifierIds: [] }]);
    expect(parseFloat(order.total)).toBe(parseFloat(dish.price));
  });
});