-- Generate REALISTIC Dataset for Load Testing
-- Mimics real cinema booking patterns

\c movies_oltp;

DROP FUNCTION IF EXISTS generate_realistic_bookings(integer);

CREATE OR REPLACE FUNCTION generate_realistic_bookings(num_bookings INTEGER)
RETURNS void AS $$
DECLARE
    i INTEGER;
    attempts INTEGER := 0;
    max_attempts INTEGER := num_bookings * 3;
    successful_bookings INTEGER := 0;
    customer_id_var INTEGER;
    payment_id_var INTEGER;
    reservation_id_var INTEGER;
    random_showtime_id INTEGER;
    random_movie_id INTEGER;
    random_auditorium_id INTEGER;
    booking_timestamp TIMESTAMP;
    num_seats INTEGER;
    seat_id INTEGER;
    available_seats INTEGER[];
    ticket_price NUMERIC(10,2);
    hour_weight FLOAT;
    dow INTEGER;
    existing_customer_id INTEGER;
    use_existing_customer BOOLEAN;
    days_ago INTEGER;
    hour_of_day INTEGER;
    minute_of_hour INTEGER;
BEGIN
    CREATE TEMP TABLE IF NOT EXISTS temp_first_names (name VARCHAR(50));
    TRUNCATE temp_first_names;
    INSERT INTO temp_first_names VALUES 
        ('John'), ('Jane'), ('Michael'), ('Sarah'), ('David'), ('Emma'), 
        ('Chris'), ('Lisa'), ('Robert'), ('Maria'), ('William'), ('Jennifer'),
        ('James'), ('Linda'), ('Daniel'), ('Patricia'), ('Matthew'), ('Barbara'),
        ('Joseph'), ('Susan'), ('Thomas'), ('Jessica'), ('Charles'), ('Max'),
        ('Mark'), ('Nancy'), ('Paul'), ('Betty'), ('Donald'), ('Helen'),
        ('Kevin'), ('Sandra'), ('Lewis'), ('Ashley'), ('George'), ('Donna'),
        ('Edward'), ('Carol'), ('Ronald'), ('Michelle'), ('Anthony'), ('Emily'),
        ('Steven'), ('Amanda'), ('Andrew'), ('Melissa'), ('Joshua'), ('Deborah'),
        ('Max'), ('Gaby'), ('Alex'), ('Sophie'), ('Ryan'), ('China'),
        ('Taylor'), ('Roger'), ('Yuan'), ('Olivia'), ('Jacob'), ('Gaby');
    
    CREATE TEMP TABLE IF NOT EXISTS temp_last_names (name VARCHAR(50));
    TRUNCATE temp_last_names;
    INSERT INTO temp_last_names VALUES 
        ('Smith'), ('Johnson'), ('Williams'), ('Brown'), ('Jones'), ('Verstappen'),
        ('Miller'), ('Davis'), ('Hamilton'), ('Martinez'), ('Hernandez'), ('Lopez'),
        ('Gonzalez'), ('Wilson'), ('Anderson'), ('Thomas'), ('Taylor'), ('Moore'),
        ('Jackson'), ('Martin'), ('Lee'), ('Perez'), ('Thompson'), ('White'),
        ('Harris'), ('Sanchez'), ('Clark'), ('Ramirez'), ('Lewis'), ('Robinson'),
        ('Walker'), ('Young'), ('Allen'), ('King'), ('Wright'), ('Scott'),
        ('Torres'), ('Nguyen'), ('Hill'), ('Flores'), ('Green'), ('Adams');
    
    WHILE successful_bookings < num_bookings AND attempts < max_attempts LOOP
        attempts := attempts + 1;
        
        -- Realistic date: weighted toward recent
        IF random() < 0.40 THEN
            days_ago := (random() * 7)::INTEGER;
        ELSIF random() < 0.70 THEN
            days_ago := (random() * 7 + 7)::INTEGER;
        ELSIF random() < 0.90 THEN
            days_ago := (random() * 7 + 14)::INTEGER;
        ELSE
            days_ago := (random() * 90 + 21)::INTEGER;
        END IF;
        
        booking_timestamp := NOW() - (days_ago || ' days')::INTERVAL;
        dow := EXTRACT(DOW FROM booking_timestamp);
        
        -- Skip 60% of weekday bookings (simulates weekend preference)
        IF dow NOT IN (0, 5, 6) AND random() < 0.60 THEN
            CONTINUE;
        END IF;
        
        -- Realistic hours: Evening peak
        hour_weight := random();
        IF hour_weight < 0.50 THEN
            hour_of_day := 18 + (random() * 4)::INTEGER;  -- 6-10pm (50%)
        ELSIF hour_weight < 0.80 THEN
            hour_of_day := 14 + (random() * 4)::INTEGER;  -- 2-6pm (30%)
        ELSIF hour_weight < 0.95 THEN
            hour_of_day := 22 + (random() * 4)::INTEGER;  -- 10pm-2am (15%)
        ELSE
            hour_of_day := (random() * 14)::INTEGER;      -- Other (5%)
        END IF;
        
        minute_of_hour := (random() * 60)::INTEGER;
        booking_timestamp := DATE_TRUNC('day', booking_timestamp) + 
                            (hour_of_day || ' hours')::INTERVAL + 
                            (minute_of_hour || ' minutes')::INTERVAL;
        
        -- Realistic movie popularity
        SELECT id INTO random_movie_id 
        FROM movies 
        ORDER BY random() * (1 + id::FLOAT / 2) DESC
        LIMIT 1;
        
        SELECT s.id, s.auditorium_id, m.price
        INTO random_showtime_id, random_auditorium_id, ticket_price
        FROM showtimes s 
        JOIN movies m ON m.id = s.movie_id
        WHERE s.movie_id = random_movie_id 
        ORDER BY random() 
        LIMIT 1;
        
        -- Realistic seats: 1 (35%), 2 (35%), 3 (15%), 4 (10%), 5+ (5%)
        IF random() < 0.35 THEN
            num_seats := 1;
        ELSIF random() < 0.70 THEN
            num_seats := 2;
        ELSIF random() < 0.85 THEN
            num_seats := 3;
        ELSIF random() < 0.95 THEN
            num_seats := 4;
        ELSE
            num_seats := 5 + (random() * 4)::INTEGER;  -- 5-8
        END IF;
        
        -- Get available seats (limited to num_seats)
        SELECT ARRAY_AGG(id)
        INTO available_seats
        FROM (
            SELECT s.id
            FROM seats s
            WHERE s.auditorium_id = random_auditorium_id
                AND NOT EXISTS (
                    SELECT 1 FROM reservation_holds rh 
                    WHERE rh.seat_id = s.id 
                    AND rh.showtime_id = random_showtime_id
                )
            ORDER BY random()
            LIMIT num_seats
        ) limited_seats;
        
        IF available_seats IS NULL OR array_length(available_seats, 1) < num_seats THEN
            CONTINUE;
        END IF;
        
        -- 35% repeat customers
        use_existing_customer := random() < 0.35;
        
        IF use_existing_customer THEN
            SELECT id INTO existing_customer_id 
            FROM customers 
            WHERE id > 1
            ORDER BY random() 
            LIMIT 1;
        END IF;
        
        IF existing_customer_id IS NOT NULL AND use_existing_customer THEN
            customer_id_var := existing_customer_id;
        ELSE
            INSERT INTO customers (email, name)
            VALUES (
                lower((SELECT name FROM temp_first_names ORDER BY random() LIMIT 1)) || '.' || 
                lower((SELECT name FROM temp_last_names ORDER BY random() LIMIT 1)) || 
                floor(random() * 10000)::TEXT || '@example.com',
                (SELECT name FROM temp_first_names ORDER BY random() LIMIT 1) || ' ' || 
                (SELECT name FROM temp_last_names ORDER BY random() LIMIT 1)
            )
            ON CONFLICT (email) DO NOTHING
            RETURNING id INTO customer_id_var;
            
            IF customer_id_var IS NULL THEN
                SELECT id INTO customer_id_var FROM customers ORDER BY random() LIMIT 1;
            END IF;
        END IF;
        
        -- Realistic payment methods
        INSERT INTO payments (customer_id, amount, payment_date, payment_method)
        VALUES (
            customer_id_var,
            ticket_price * num_seats,
            booking_timestamp,
            CASE 
                WHEN random() < 0.60 THEN 'CREDIT_CARD'
                WHEN random() < 0.85 THEN 'DEBIT_CARD'
                WHEN random() < 0.95 THEN 'GCASH'
                ELSE 'CASH'
            END
        )
        RETURNING id INTO payment_id_var;
        
        -- Create reservations and tickets
        FOREACH seat_id IN ARRAY available_seats LOOP
            INSERT INTO reservation_holds (seat_id, showtime_id, customer_id, hold_expires_at, status)
            VALUES (
                seat_id, 
                random_showtime_id, 
                customer_id_var,
                booking_timestamp + INTERVAL '15 minutes',
                'CONFIRMED'
            )
            RETURNING id INTO reservation_id_var;
            
            INSERT INTO tickets (reservation_id, payment_id, price)
            VALUES (reservation_id_var, payment_id_var, ticket_price);
        END LOOP;
        
        successful_bookings := successful_bookings + 1;
        
        IF successful_bookings % 1000 = 0 THEN
            RAISE NOTICE '% bookings completed...', successful_bookings;
        END IF;
        
        existing_customer_id := NULL;
    END LOOP;
    
    RAISE NOTICE 'Generated % bookings (% attempts)!', successful_bookings, attempts;
    
    DROP TABLE IF EXISTS temp_first_names;
    DROP TABLE IF EXISTS temp_last_names;
END;
$$ LANGUAGE plpgsql;

-- Clear old data
TRUNCATE TABLE tickets CASCADE;
TRUNCATE TABLE reservation_holds CASCADE;
TRUNCATE TABLE payments CASCADE;
TRUNCATE TABLE customers RESTART IDENTITY CASCADE;

INSERT INTO customers (id, email, name) VALUES (1, 'test@example.com', 'Test User');
ALTER SEQUENCE customers_id_seq RESTART WITH 2;

SELECT generate_realistic_bookings(5000);

-- Statistics
SELECT '=== BOOKING STATISTICS ===' as info;
SELECT 
    COUNT(*) as bookings,
    COUNT(DISTINCT customer_id) as customers,
    SUM(amount) as revenue
FROM payments;

SELECT '=== SEATS PER BOOKING ===' as info;
SELECT seat_count, COUNT(*) as bookings, ROUND(COUNT(*)*100.0/SUM(COUNT(*)) OVER(), 1) as pct
FROM (SELECT payment_id, COUNT(*) as seat_count FROM tickets GROUP BY payment_id) t
GROUP BY seat_count ORDER BY seat_count;

SELECT '=== TIME SLOTS ===' as info;
SELECT 
    CASE 
        WHEN EXTRACT(HOUR FROM payment_date) BETWEEN 6 AND 11 THEN 'Morning'
        WHEN EXTRACT(HOUR FROM payment_date) BETWEEN 12 AND 17 THEN 'Afternoon'
        WHEN EXTRACT(HOUR FROM payment_date) BETWEEN 18 AND 21 THEN 'Evening'
        ELSE 'Night'
    END as slot,
    COUNT(*) as bookings, ROUND(COUNT(*)*100.0/SUM(COUNT(*)) OVER(), 1) as pct
FROM payments
GROUP BY 1 ORDER BY MIN(EXTRACT(HOUR FROM payment_date));

SELECT '=== DAY TYPES ===' as info;
SELECT 
    CASE 
        WHEN EXTRACT(DOW FROM payment_date) IN (0, 6) THEN 'Weekend'
        WHEN EXTRACT(DOW FROM payment_date) = 5 THEN 'Friday'
        ELSE 'Weekday'
    END as type, COUNT(*) as bookings, ROUND(COUNT(*)*100.0/SUM(COUNT(*)) OVER(), 1) as pct
FROM payments GROUP BY 1;

SELECT '=== REPEAT RATE ===' as info;
SELECT 
    COUNT(DISTINCT customer_id) as total,
    COUNT(DISTINCT CASE WHEN b > 1 THEN customer_id END) as repeats,
    ROUND(COUNT(DISTINCT CASE WHEN b > 1 THEN customer_id END)*100.0/NULLIF(COUNT(DISTINCT customer_id),0), 1) as pct
FROM (SELECT customer_id, COUNT(*) as b FROM payments GROUP BY customer_id) t;

CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_tickets_payment ON tickets(payment_id);

ANALYZE payments; ANALYZE tickets; ANALYZE reservation_holds; ANALYZE customers;
