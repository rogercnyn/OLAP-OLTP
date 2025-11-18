-- Populate sample data for analytics testing

-- Insert sample bookings into fact_bookings
INSERT INTO fact_bookings (
    booking_date, booking_time, booking_timestamp,
    movie_id, movie_title, movie_duration, movie_price,
    showtime_id, showtime_start,
    auditorium_id, auditorium_name,
    customer_id, customer_email, customer_name,
    seats_booked, total_revenue, payment_method,
    day_of_week, week_of_year, month_num, month_name, year, quarter, is_weekend, time_of_day
) VALUES
    -- Movie 1: Quezon
    (CURRENT_DATE - 1, '14:30:00', NOW() - INTERVAL '1 day', 1, 'Quezon', 120, 250.00, 1, NOW() - INTERVAL '1 day', 1, 'Cinema 1', 1, 'john@example.com', 'John Doe', 2, 500.00, 'CREDIT_CARD', 'Monday', 47, 11, 'November', 2025, 4, false, 'Afternoon'),
    (CURRENT_DATE - 1, '19:00:00', NOW() - INTERVAL '1 day', 1, 'Quezon', 120, 250.00, 2, NOW() - INTERVAL '1 day', 1, 'Cinema 1', 2, 'jane@example.com', 'Jane Smith', 3, 750.00, 'CREDIT_CARD', 'Monday', 47, 11, 'November', 2025, 4, false, 'Evening'),
    (CURRENT_DATE - 2, '14:30:00', NOW() - INTERVAL '2 days', 1, 'Quezon', 120, 250.00, 3, NOW() - INTERVAL '2 days', 2, 'Cinema 2', 3, 'bob@example.com', 'Bob Johnson', 1, 250.00, 'DEBIT_CARD', 'Sunday', 46, 11, 'November', 2025, 4, true, 'Afternoon'),
    
    -- Movie 2: Predator: Badlands
    (CURRENT_DATE - 1, '16:00:00', NOW() - INTERVAL '1 day', 2, 'Predator: Badlands', 130, 300.00, 4, NOW() - INTERVAL '1 day', 2, 'Cinema 2', 4, 'alice@example.com', 'Alice Brown', 2, 600.00, 'CREDIT_CARD', 'Monday', 47, 11, 'November', 2025, 4, false, 'Afternoon'),
    (CURRENT_DATE - 1, '21:00:00', NOW() - INTERVAL '1 day', 2, 'Predator: Badlands', 130, 300.00, 5, NOW() - INTERVAL '1 day', 1, 'Cinema 1', 5, 'charlie@example.com', 'Charlie Wilson', 4, 1200.00, 'CREDIT_CARD', 'Monday', 47, 11, 'November', 2025, 4, false, 'Night'),
    (CURRENT_DATE - 3, '19:00:00', NOW() - INTERVAL '3 days', 2, 'Predator: Badlands', 130, 300.00, 6, NOW() - INTERVAL '3 days', 1, 'Cinema 1', 6, 'david@example.com', 'David Lee', 2, 600.00, 'CASH', 'Saturday', 46, 11, 'November', 2025, 4, true, 'Evening'),
    
    -- Movie 3: Die, My Love
    (CURRENT_DATE - 2, '15:30:00', NOW() - INTERVAL '2 days', 3, 'Die, My Love', 110, 220.00, 7, NOW() - INTERVAL '2 days', 3, 'Cinema 3', 7, 'emma@example.com', 'Emma Davis', 1, 220.00, 'CREDIT_CARD', 'Sunday', 46, 11, 'November', 2025, 4, true, 'Afternoon'),
    (CURRENT_DATE - 2, '18:00:00', NOW() - INTERVAL '2 days', 3, 'Die, My Love', 110, 220.00, 8, NOW() - INTERVAL '2 days', 2, 'Cinema 2', 8, 'frank@example.com', 'Frank Miller', 2, 440.00, 'DEBIT_CARD', 'Sunday', 46, 11, 'November', 2025, 4, true, 'Evening'),
    (CURRENT_DATE - 4, '14:00:00', NOW() - INTERVAL '4 days', 3, 'Die, My Love', 110, 220.00, 9, NOW() - INTERVAL '4 days', 1, 'Cinema 1', 9, 'grace@example.com', 'Grace Taylor', 3, 660.00, 'CREDIT_CARD', 'Friday', 46, 11, 'November', 2025, 4, false, 'Afternoon'),
    
    -- Movie 4: Bugonia
    (CURRENT_DATE - 3, '13:00:00', NOW() - INTERVAL '3 days', 4, 'Bugonia', 115, 200.00, 10, NOW() - INTERVAL '3 days', 3, 'Cinema 3', 10, 'henry@example.com', 'Henry White', 1, 200.00, 'CREDIT_CARD', 'Saturday', 46, 11, 'November', 2025, 4, true, 'Afternoon'),
    (CURRENT_DATE - 3, '20:00:00', NOW() - INTERVAL '3 days', 4, 'Bugonia', 115, 200.00, 11, NOW() - INTERVAL '3 days', 2, 'Cinema 2', 11, 'iris@example.com', 'Iris Green', 2, 400.00, 'CASH', 'Saturday', 46, 11, 'November', 2025, 4, true, 'Evening'),
    
    -- Movie 5: Wicked: For Good
    (CURRENT_DATE - 1, '17:00:00', NOW() - INTERVAL '1 day', 5, 'Wicked: For Good', 140, 280.00, 12, NOW() - INTERVAL '1 day', 3, 'Cinema 3', 12, 'jack@example.com', 'Jack Black', 4, 1120.00, 'CREDIT_CARD', 'Monday', 47, 11, 'November', 2025, 4, false, 'Evening'),
    (CURRENT_DATE - 2, '19:30:00', NOW() - INTERVAL '2 days', 5, 'Wicked: For Good', 140, 280.00, 13, NOW() - INTERVAL '2 days', 1, 'Cinema 1', 13, 'kate@example.com', 'Kate Brown', 3, 840.00, 'CREDIT_CARD', 'Sunday', 46, 11, 'November', 2025, 4, true, 'Evening'),
    (CURRENT_DATE - 5, '16:00:00', NOW() - INTERVAL '5 days', 5, 'Wicked: For Good', 140, 280.00, 14, NOW() - INTERVAL '5 days', 2, 'Cinema 2', 14, 'leo@example.com', 'Leo Martinez', 2, 560.00, 'DEBIT_CARD', 'Thursday', 46, 11, 'November', 2025, 4, false, 'Afternoon'),
    
    -- Movie 6: Meet, Greet & Bye
    (CURRENT_DATE - 4, '15:00:00', NOW() - INTERVAL '4 days', 6, 'Meet, Greet & Bye', 105, 180.00, 15, NOW() - INTERVAL '4 days', 3, 'Cinema 3', 15, 'mia@example.com', 'Mia Thompson', 1, 180.00, 'CREDIT_CARD', 'Friday', 46, 11, 'November', 2025, 4, false, 'Afternoon'),
    (CURRENT_DATE - 4, '20:30:00', NOW() - INTERVAL '4 days', 6, 'Meet, Greet & Bye', 105, 180.00, 16, NOW() - INTERVAL '4 days', 1, 'Cinema 1', 16, 'noah@example.com', 'Noah Garcia', 2, 360.00, 'CASH', 'Friday', 46, 11, 'November', 2025, 4, false, 'Night'),
    (CURRENT_DATE - 6, '14:00:00', NOW() - INTERVAL '6 days', 6, 'Meet, Greet & Bye', 105, 180.00, 17, NOW() - INTERVAL '6 days', 2, 'Cinema 2', 17, 'olivia@example.com', 'Olivia Wilson', 3, 540.00, 'CREDIT_CARD', 'Wednesday', 46, 11, 'November', 2025, 4, false, 'Afternoon'),
    
    -- More bookings for variety
    (CURRENT_DATE - 7, '10:00:00', NOW() - INTERVAL '7 days', 1, 'Quezon', 120, 250.00, 18, NOW() - INTERVAL '7 days', 1, 'Cinema 1', 18, 'paul@example.com', 'Paul Anderson', 2, 500.00, 'CREDIT_CARD', 'Tuesday', 46, 11, 'November', 2025, 4, false, 'Morning'),
    (CURRENT_DATE - 8, '11:30:00', NOW() - INTERVAL '8 days', 2, 'Predator: Badlands', 130, 300.00, 19, NOW() - INTERVAL '8 days', 2, 'Cinema 2', 19, 'quinn@example.com', 'Quinn Roberts', 1, 300.00, 'DEBIT_CARD', 'Monday', 46, 11, 'November', 2025, 4, false, 'Morning'),
    (CURRENT_DATE - 9, '12:00:00', NOW() - INTERVAL '9 days', 3, 'Die, My Love', 110, 220.00, 20, NOW() - INTERVAL '9 days', 3, 'Cinema 3', 20, 'rachel@example.com', 'Rachel King', 4, 880.00, 'CREDIT_CARD', 'Sunday', 45, 11, 'November', 2025, 4, true, 'Afternoon'),
    (CURRENT_DATE - 10, '13:30:00', NOW() - INTERVAL '10 days', 4, 'Bugonia', 115, 200.00, 21, NOW() - INTERVAL '10 days', 1, 'Cinema 1', 21, 'sam@example.com', 'Sam Turner', 2, 400.00, 'CASH', 'Saturday', 45, 11, 'November', 2025, 4, true, 'Afternoon');

-- Refresh materialized views
REFRESH MATERIALIZED VIEW mv_daily_revenue;
REFRESH MATERIALIZED VIEW mv_movie_performance;
REFRESH MATERIALIZED VIEW mv_timeslot_analysis;

SELECT 'Analytics data populated successfully!' AS status;
