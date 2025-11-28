-- ETL Script: Transform OLTP data to OLAP fact_bookings table
-- This script extracts booking data from the OLTP database and loads it into the OLAP star schema

-- Connect to OLAP database
\c movies_olap

-- Truncate existing fact_bookings (or you can delete old data)
TRUNCATE TABLE fact_bookings RESTART IDENTITY CASCADE;

-- Insert transformed data from OLTP to OLAP
-- We need to use dblink or postgres_fdw to query across databases
-- First, install dblink extension if not exists
CREATE EXTENSION IF NOT EXISTS dblink;

-- Insert data using dblink to query OLTP database
INSERT INTO fact_bookings (
    booking_date,
    booking_time,
    booking_timestamp,
    movie_id,
    movie_title,
    movie_duration,
    movie_price,
    showtime_id,
    showtime_start,
    auditorium_id,
    auditorium_name,
    customer_id,
    customer_email,
    customer_name,
    seats_booked,
    total_revenue,
    payment_method,
    day_of_week,
    week_of_year,
    month_num,
    month_name,
    year,
    quarter,
    is_weekend,
    time_of_day
)
SELECT 
    payment_date::date as booking_date,
    payment_date::time as booking_time,
    payment_date as booking_timestamp,
    movie_id,
    title as movie_title,
    duration_minutes as movie_duration,
    price as movie_price,
    showtime_id,
    start_time as showtime_start,
    auditorium_id,
    auditorium_name,
    customer_id,
    email as customer_email,
    customer_name,
    COUNT(ticket_id) as seats_booked,
    amount as total_revenue,
    payment_method,
    TO_CHAR(payment_date, 'Day') as day_of_week,
    EXTRACT(WEEK FROM payment_date)::integer as week_of_year,
    EXTRACT(MONTH FROM payment_date)::integer as month_num,
    TO_CHAR(payment_date, 'Month') as month_name,
    EXTRACT(YEAR FROM payment_date)::integer as year,
    EXTRACT(QUARTER FROM payment_date)::integer as quarter,
    CASE WHEN EXTRACT(DOW FROM payment_date) IN (0, 6) THEN true ELSE false END as is_weekend,
    CASE 
        WHEN EXTRACT(HOUR FROM payment_date) BETWEEN 0 AND 5 THEN 'Late Night'
        WHEN EXTRACT(HOUR FROM payment_date) BETWEEN 6 AND 11 THEN 'Morning'
        WHEN EXTRACT(HOUR FROM payment_date) BETWEEN 12 AND 17 THEN 'Afternoon'
        WHEN EXTRACT(HOUR FROM payment_date) BETWEEN 18 AND 21 THEN 'Evening'
        ELSE 'Night'
    END as time_of_day
FROM dblink(
    'dbname=movies_oltp host=postgres-primary user=postgres password=password',
    'SELECT 
        p.id as payment_id,
        p.customer_id,
        p.amount,
        p.payment_date,
        p.payment_method,
        c.email,
        c.name as customer_name,
        t.id as ticket_id,
        t.reservation_id,
        rh.showtime_id,
        s.start_time,
        s.movie_id,
        s.auditorium_id,
        m.title,
        m.duration_minutes,
        m.price,
        a.name as auditorium_name
    FROM payments p
    JOIN customers c ON c.id = p.customer_id
    JOIN tickets t ON t.payment_id = p.id
    JOIN reservation_holds rh ON rh.id = t.reservation_id
    JOIN showtimes s ON s.id = rh.showtime_id
    JOIN movies m ON m.id = s.movie_id
    JOIN auditoriums a ON a.id = s.auditorium_id
    ORDER BY p.payment_date'
) AS oltp_data(
    payment_id integer,
    customer_id integer,
    amount numeric,
    payment_date timestamp,
    payment_method varchar,
    email varchar,
    customer_name varchar,
    ticket_id integer,
    reservation_id integer,
    showtime_id integer,
    start_time timestamp,
    movie_id integer,
    auditorium_id integer,
    title varchar,
    duration_minutes integer,
    price numeric,
    auditorium_name varchar
)
-- Regroup by payment to get correct aggregation
GROUP BY 
    payment_date,
    movie_id, title, duration_minutes, price,
    showtime_id, start_time,
    auditorium_id, auditorium_name,
    customer_id, email, customer_name,
    amount, payment_method;

-- Show summary statistics
SELECT 
    COUNT(*) as total_fact_records,
    SUM(seats_booked) as total_seats,
    SUM(total_revenue) as total_revenue,
    MIN(booking_date) as earliest_booking,
    MAX(booking_date) as latest_booking,
    COUNT(DISTINCT customer_id) as unique_customers,
    COUNT(DISTINCT movie_id) as unique_movies
FROM fact_bookings;

-- Analyze table for better query performance
ANALYZE fact_bookings;
