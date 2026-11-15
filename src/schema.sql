CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(20) DEFAULT 'VISITOR' CHECK (role IN ('VISITOR', 'OPERATOR')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE dishes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    composition TEXT,
    allergens TEXT,
    price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
    available BOOLEAN DEFAULT TRUE,
    category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE
);

CREATE TABLE modifiers (
    id SERIAL PRIMARY KEY,
    dish_id INTEGER REFERENCES dishes(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    price DECIMAL(10, 2) DEFAULT 0 CHECK (price >= 0),
    max_per_dish INTEGER DEFAULT 1 CHECK (max_per_dish > 0)
);

CREATE TABLE time_slots (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    start_time VARCHAR(5) NOT NULL,
    end_time VARCHAR(5) NOT NULL,
    max_orders INTEGER DEFAULT 10 CHECK (max_orders > 0),
    UNIQUE(date, start_time)
);

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    slot_id INTEGER REFERENCES time_slots(id),
    status VARCHAR(20) DEFAULT 'NEW' CHECK (status IN ('NEW', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED')),
    total DECIMAL(10, 2) NOT NULL CHECK (total >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    dish_id INTEGER REFERENCES dishes(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price DECIMAL(10, 2) NOT NULL CHECK (price >= 0)
);

CREATE TABLE order_item_modifiers (
    id SERIAL PRIMARY KEY,
    order_item_id INTEGER REFERENCES order_items(id) ON DELETE CASCADE,
    modifier_id INTEGER REFERENCES modifiers(id),
    price DECIMAL(10, 2) NOT NULL CHECK (price >= 0)
);