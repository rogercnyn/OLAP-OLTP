-- OLAP Database Setup

CREATE TABLE IF NOT EXISTS fact_bookings (
    id SERIAL PRIMARY KEY,
    booking_date DATE NOT NULL,
    booking_time TIME NOT NULL,
    booking_timestamp TIMESTAMP DEFAULT NOW(),
    movie_id INT NOT NULL,
    movie_title VARCHAR(255) NOT NULL,
    movie_duration INT,
    movie_price DECIMAL(10, 2),
    showtime_id INT NOT NULL,
    showtime_start TIMESTAMP NOT NULL,
    auditorium_id INT NOT NULL,
    auditorium_name VARCHAR(50),
    customer_id INT NOT NULL,
    customer_email VARCHAR(255),
    customer_name VARCHAR(255),
    seats_booked INT DEFAULT 1,
    total_revenue DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'CREDIT_CARD',
    day_of_week VARCHAR(10),
    week_of_year INT,
    month_num INT,
    month_name VARCHAR(10),
    year INT,
    quarter INT,
    is_weekend BOOLEAN,
    time_of_day VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS dim_movies (
    movie_id INT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    duration_minutes INT,
    base_price DECIMAL(10, 2),
    genre VARCHAR(100),
    last_updated TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dim_time (
    date DATE PRIMARY KEY,
    day_of_week VARCHAR(10),
    day_of_month INT,
    week_of_year INT,
    month_num INT,
    month_name VARCHAR(10),
    quarter INT,
    year INT,
    is_weekend BOOLEAN,
    is_holiday BOOLEAN DEFAULT FALSE
);

-- Materialized Views
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_revenue AS
SELECT 
    booking_date,
    movie_title,
    auditorium_name,
    SUM(total_revenue) as total_revenue,
    SUM(seats_booked) as total_seats,
    COUNT(DISTINCT id) as total_bookings,
    AVG(total_revenue) as avg_transaction_value
FROM fact_bookings
GROUP BY booking_date, movie_title, auditorium_name
ORDER BY booking_date DESC, total_revenue DESC;

CREATE INDEX IF NOT EXISTS idx_mv_daily_revenue_date ON mv_daily_revenue(booking_date);
CREATE INDEX IF NOT EXISTS idx_mv_daily_revenue_movie ON mv_daily_revenue(movie_title);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_movie_performance AS
SELECT 
    movie_title,
    COUNT(DISTINCT booking_date) as days_shown,
    SUM(seats_booked) as total_seats_sold,
    SUM(total_revenue) as total_revenue,
    AVG(seats_booked) as avg_seats_per_booking,
    COUNT(DISTINCT showtime_id) as total_showtimes
FROM fact_bookings
GROUP BY movie_title
ORDER BY total_revenue DESC;

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_timeslot_analysis AS
SELECT 
    time_of_day,
    day_of_week,
    COUNT(*) as booking_count,
    SUM(total_revenue) as total_revenue,
    AVG(seats_booked) as avg_seats_per_booking
FROM fact_bookings
GROUP BY time_of_day, day_of_week
ORDER BY booking_count DESC;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fact_bookings_date ON fact_bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_fact_bookings_movie ON fact_bookings(movie_id);
CREATE INDEX IF NOT EXISTS idx_fact_bookings_showtime ON fact_bookings(showtime_id);
CREATE INDEX IF NOT EXISTS idx_fact_bookings_customer ON fact_bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_fact_bookings_timestamp ON fact_bookings(booking_timestamp);
CREATE INDEX IF NOT EXISTS idx_fact_bookings_dow ON fact_bookings(day_of_week);
CREATE INDEX IF NOT EXISTS idx_fact_bookings_month ON fact_bookings(month_num, year);
CREATE INDEX IF NOT EXISTS idx_fact_bookings_date_movie ON fact_bookings(booking_date, movie_id);
CREATE INDEX IF NOT EXISTS idx_fact_bookings_date_time ON fact_bookings(booking_date, time_of_day);

-- Helper Functions
CREATE OR REPLACE FUNCTION get_time_of_day(showtime_hour INT)
RETURNS VARCHAR AS $$
BEGIN
    RETURN CASE
        WHEN showtime_hour >= 6 AND showtime_hour < 12 THEN 'Morning'
        WHEN showtime_hour >= 12 AND showtime_hour < 17 THEN 'Afternoon'
        WHEN showtime_hour >= 17 AND showtime_hour < 21 THEN 'Evening'
        ELSE 'Night'
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION refresh_all_reports()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_revenue;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_movie_performance;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_timeslot_analysis;
    RAISE NOTICE 'All materialized views refreshed';
END;
$$ LANGUAGE plpgsql;

-- Setup logical replication
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_subscription WHERE subname = 'reports_subscription') THEN
        CREATE SUBSCRIPTION reports_subscription
        CONNECTION 'host=postgres-primary port=5432 dbname=movies_oltp user=postgres password=password'
        PUBLICATION reports_publication
        WITH (copy_data = true, create_slot = true);
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not create subscription yet. Error: %', SQLERRM;
END;
$$;

-- Populate time dimension
INSERT INTO dim_time (date, day_of_week, day_of_month, week_of_year, month_num, month_name, quarter, year, is_weekend)
SELECT 
    date,
    TO_CHAR(date, 'Day') as day_of_week,
    EXTRACT(DAY FROM date) as day_of_month,
    EXTRACT(WEEK FROM date) as week_of_year,
    EXTRACT(MONTH FROM date) as month_num,
    TO_CHAR(date, 'Month') as month_name,
    EXTRACT(QUARTER FROM date) as quarter,
    EXTRACT(YEAR FROM date) as year,
    CASE WHEN EXTRACT(DOW FROM date) IN (0, 6) THEN TRUE ELSE FALSE END as is_weekend
FROM generate_series(
    CURRENT_DATE - INTERVAL '1 year',
    CURRENT_DATE + INTERVAL '2 years',
    INTERVAL '1 day'
) as date
ON CONFLICT (date) DO NOTHING;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO postgres;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO postgres;

