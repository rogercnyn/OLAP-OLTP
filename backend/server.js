require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Primary Database Connection
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'movies_oltp',
    password: process.env.DB_PASSWORD || 'password',
    port: parseInt(process.env.DB_PORT) || 5432,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Reports Database Connection
const reportsPool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST_REPORTS || 'localhost',
    database: process.env.DB_NAME_REPORTS || 'movies_olap',
    password: process.env.DB_PASSWORD || 'password',
    port: parseInt(process.env.DB_PORT_REPORTS) || 5434,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
    console.error('Database error:', err);
});

reportsPool.on('error', (err) => {
    console.error('Reports database error:', err);
});

// Health check
app.get('/api/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    } catch (err) {
        res.status(503).json({ status: 'unhealthy', error: err.message });
    }
});

app.get('/favicon.ico', (req, res) => res.status(204).end());

app.get('/api', (req, res) => {
    res.json({
        name: 'Movie Booking API',
        version: '1.0.0',
        endpoints: {
            health: '/api/health',
            schedule: '/api/schedule?date=YYYY-MM-DD',
            seats: '/api/showtimes/:id/seats',
            book: 'POST /api/book'
        }
    });
});

// Get movie schedule for a specific date
app.get('/api/schedule', async (req, res) => {
    const { date } = req.query; 
    try {
        const query = `
            SELECT 
                m.id, 
                m.title, 
                m.price,
                json_agg(
                    json_build_object(
                        'id', s.id,
                        'time', TO_CHAR(s.start_time, 'HH24:MI')
                    ) ORDER BY s.start_time
                ) as showtimes
            FROM movies m
            JOIN showtimes s ON s.movie_id = m.id
            WHERE DATE(s.start_time) = $1
            GROUP BY m.id, m.title, m.price
            ORDER BY m.title
        `;
        const result = await pool.query(query, [date]);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching schedule:', err);
        res.status(500).json({ error: 'Failed to fetch schedule' });
    }
});

// Get showtimes and seats for a movie
app.get('/api/showtimes/:id/seats', async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT 
                s.id,
                s.row_code,
                s.number,
                CASE 
                    WHEN rh.id IS NOT NULL THEN 'TAKEN'
                    ELSE 'available'
                END as status
            FROM seats s
            JOIN auditoriums a ON s.auditorium_id = a.id
            JOIN showtimes sh ON sh.auditorium_id = a.id
            LEFT JOIN reservation_holds rh ON rh.seat_id = s.id AND rh.showtime_id = sh.id
            WHERE sh.id = $1
            ORDER BY s.row_code, s.number
        `;
        const result = await pool.query(query, [id]);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching seats:', err);
        res.status(500).json({ error: 'Failed to fetch seats' });
    }
});

// Book seats
app.post('/api/book', async (req, res) => {
    const { showtimeId, seats, customerName, customerEmail, paymentMethod, paymentAmount } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Get or Create Customer (Prevents duplicate email errors)
        let customerId;
        const checkCustomer = await client.query('SELECT id FROM customers WHERE email = $1', [customerEmail]);
        
        if (checkCustomer.rows.length > 0) {
            customerId = checkCustomer.rows[0].id;
        } else {
            const customerInsert = `
                INSERT INTO customers (name, email)
                VALUES ($1, $2)
                RETURNING id
            `;
            const customerResult = await client.query(customerInsert, [customerName, customerEmail]);
            customerId = customerResult.rows[0].id;
        }

        // 2. Insert Payment
        const paymentInsert = `
            INSERT INTO payments (customer_id, amount, payment_method)
            VALUES ($1, $2, $3)
            RETURNING id
        `;
        const paymentResult = await client.query(paymentInsert, [customerId, paymentAmount, paymentMethod]);
        const paymentId = paymentResult.rows[0].id;

        // 3. Process each seat
        // Instead of locking the "seats" table, we try to insert a reservation.
        // If the insert fails, the seat is taken.
        for (const seat of seats) {
            try {
                // Create Reservation (This acts as the "Lock")
                const reservationInsert = `
                    INSERT INTO reservation_holds (showtime_id, seat_id, customer_id, hold_expires_at, status)
                    VALUES ($1, $2, $3, NOW() + INTERVAL '1 hour', 'CONFIRMED')
                    RETURNING id
                `;
                const reservationResult = await client.query(reservationInsert, [showtimeId, seat.id, customerId]);
                const reservationId = reservationResult.rows[0].id;

                // Create Ticket
                await client.query(
                    `INSERT INTO tickets (reservation_id, payment_id, price)
                     VALUES ($1, $2, $3)`,
                    [reservationId, paymentId, seat.price]
                );

            } catch (err) {
                // Error code '23505' means a unique constraint violation (Seat already booked)
                if (err.code === '23505') {
                    await client.query('ROLLBACK');
                    return res.status(409).json({
                        error: 'One or more seats are already taken.',
                        details: `Seat ID ${seat.id} is unavailable.`
                    });
                } else {
                    throw err; // Throw other errors to the main catch block
                }
            }
        }

        await client.query('COMMIT');
        res.json({ success: true, paymentId, customerId });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Booking error:', err);
        res.status(500).json({ error: 'Booking failed', details: err.message });
    } finally {
        client.release();
    }
});

// Analytics endpoints (OLAP queries)
app.get('/api/analytics/revenue', async (req, res) => {
    try {
        const query = `
            SELECT 
                booking_date,
                SUM(total_revenue) as daily_revenue,
                COUNT(*) as bookings,
                SUM(seats_booked) as seats_sold
            FROM fact_bookings
            WHERE booking_date >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY booking_date
            ORDER BY booking_date DESC
        `;
        const result = await reportsPool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Revenue analytics error:', err);
        res.status(500).json({ error: 'Failed to fetch revenue data' });
    }
});

app.get('/api/analytics/movies', async (req, res) => {
    try {
        const query = `
            SELECT 
                movie_title,
                SUM(total_revenue) as total_revenue,
                SUM(seats_booked) as total_seats,
                COUNT(DISTINCT booking_date) as days_shown,
                AVG(total_revenue) as avg_revenue_per_booking
            FROM fact_bookings
            GROUP BY movie_title
            ORDER BY total_revenue DESC
            LIMIT 10
        `;
        const result = await reportsPool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Movie analytics error:', err);
        res.status(500).json({ error: 'Failed to fetch movie data' });
    }
});

app.get('/api/analytics/timeslots', async (req, res) => {
    try {
        const query = `
            SELECT 
                time_of_day,
                day_of_week,
                COUNT(*) as booking_count,
                SUM(total_revenue) as revenue,
                AVG(seats_booked) as avg_seats
            FROM fact_bookings
            GROUP BY time_of_day, day_of_week
            ORDER BY booking_count DESC
        `;
        const result = await reportsPool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Timeslot analytics error:', err);
        res.status(500).json({ error: 'Failed to fetch timeslot data' });
    }
});

app.get('/api/analytics/summary', async (req, res) => {
    try {
        const query = `
            SELECT 
                COUNT(DISTINCT customer_id) as total_customers,
                COUNT(*) as total_bookings,
                SUM(seats_booked) as total_seats_sold,
                SUM(total_revenue) as total_revenue,
                AVG(total_revenue) as avg_booking_value
            FROM fact_bookings
        `;
        const result = await reportsPool.query(query);
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Summary analytics error:', err);
        res.status(500).json({ error: 'Failed to fetch summary data' });
    }
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));