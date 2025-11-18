-- =============================================
-- MOVIE BOOKING SYSTEM - MASTER INIT SCRIPT (v2 with Payments)
-- =============================================

-- 1. CLEANUP
DROP TABLE IF EXISTS tickets CASCADE;
DROP TABLE IF EXISTS payments CASCADE; -- NEW
DROP TABLE IF EXISTS reservation_holds CASCADE;
DROP TABLE IF EXISTS seats CASCADE;
DROP TABLE IF EXISTS showtimes CASCADE;
DROP TABLE IF EXISTS auditoriums CASCADE;
DROP TABLE IF EXISTS movies CASCADE;
DROP TABLE IF EXISTS customers CASCADE;

-- 2. SCHEMA CREATION

CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255)
);

CREATE TABLE movies (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    duration_minutes INT,
    price DECIMAL(10, 2) NOT NULL -- NEW: Price column
);

CREATE TABLE auditoriums (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50),
    total_seats INT
);

CREATE TABLE showtimes (
    id SERIAL PRIMARY KEY,
    movie_id INT REFERENCES movies(id),
    auditorium_id INT REFERENCES auditoriums(id),
    start_time TIMESTAMP NOT NULL
);

CREATE TABLE seats (
    id SERIAL PRIMARY KEY,
    auditorium_id INT REFERENCES auditoriums(id),
    row_code CHAR(1),
    number INT,
    UNIQUE(auditorium_id, row_code, number)
);

CREATE TABLE reservation_holds (
    id SERIAL PRIMARY KEY,
    showtime_id INT REFERENCES showtimes(id),
    seat_id INT REFERENCES seats(id),
    customer_id INT REFERENCES customers(id),
    hold_expires_at TIMESTAMP NOT NULL, 
    status VARCHAR(20) DEFAULT 'CONFIRMED', 
    UNIQUE(showtime_id, seat_id) 
);

-- NEW: Payments Table (For Sales Reports)
CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    customer_id INT REFERENCES customers(id),
    amount DECIMAL(10, 2) NOT NULL,
    payment_date TIMESTAMP DEFAULT NOW(),
    payment_method VARCHAR(50) DEFAULT 'CREDIT_CARD'
);

-- UPDATED: Tickets now link to the Payment
CREATE TABLE tickets (
    id SERIAL PRIMARY KEY,
    reservation_id INT REFERENCES reservation_holds(id),
    payment_id INT REFERENCES payments(id), -- Link to the transaction
    price DECIMAL(10, 2)
);

-- 3. DATA SEEDING

INSERT INTO customers (email, name) VALUES ('user@test.com', 'Guest User');

INSERT INTO auditoriums (name, total_seats) VALUES 
('Cinema 1', 200), ('Cinema 2', 200), ('Cinema 3', 200), 
('Cinema 4', 200), ('Cinema 5', 200), ('Cinema 6', 200);

-- NEW: Insert Movies with specific PRICES
INSERT INTO movies (title, duration_minutes, price) VALUES 
('Quezon', 150, 350.00),
('Predator: Badlands', 120, 380.00),
('Die, My Love', 110, 320.00),
('Bugonia', 105, 300.00),
('Wicked: For Good', 160, 400.00),
('Meet, Greet & Bye', 95, 350.00);

-- Generate Seats (Rows A-J, 1-20)
INSERT INTO seats (auditorium_id, row_code, number)
SELECT a.id, r.code, s.num
FROM auditoriums a
CROSS JOIN (VALUES ('A'), ('B'), ('C'), ('D'), ('E'), ('F'), ('G'), ('H'), ('I'), ('J')) AS r(code)
CROSS JOIN generate_series(1, 20) AS s(num);

-- Generate Schedule (Randomized)
DO $$
DECLARE
    m_id INT;
    day_offset INT;
    base_date DATE := CURRENT_DATE;
    h INT; m INT;
BEGIN
    FOR m_id IN 1..6 LOOP
        FOR day_offset IN 0..6 LOOP
            -- Slot 1
            h := 10 + floor(random() * 3); m := floor(random() * 2) * 30;
            INSERT INTO showtimes (movie_id, auditorium_id, start_time)
            VALUES (m_id, m_id, base_date + day_offset + (h * INTERVAL '1 hour') + (m * INTERVAL '1 minute'));
            -- Slot 2
            h := 13 + floor(random() * 4); m := floor(random() * 2) * 30;
            INSERT INTO showtimes (movie_id, auditorium_id, start_time)
            VALUES (m_id, m_id, base_date + day_offset + (h * INTERVAL '1 hour') + (m * INTERVAL '1 minute'));
            -- Slot 3
            h := 17 + floor(random() * 5); m := floor(random() * 2) * 30;
            INSERT INTO showtimes (movie_id, auditorium_id, start_time)
            VALUES (m_id, m_id, base_date + day_offset + (h * INTERVAL '1 hour') + (m * INTERVAL '1 minute'));
        END LOOP;
    END LOOP;
END $$;