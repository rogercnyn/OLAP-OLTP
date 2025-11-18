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
            SELECT m.id, m.title, m.genre, m.rating, m.poster_url
            FROM movies m
            WHERE EXISTS (
                SELECT 1 FROM showtimes s 
                WHERE s.movie_id = m.id AND DATE(s.show_datetime) = $1
            )
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
        const showtimesQuery = `
            SELECT 
                s.id, s.show_datetime, s.price,
                a.name AS auditorium_name, a.capacity
            FROM showtimes s
            JOIN auditoriums a ON s.auditorium_id = a.id
            WHERE s.movie_id = $1
            ORDER BY s.show_datetime
        `;
        const showtimesResult = await pool.query(showtimesQuery, [id]);

        for (const showtime of showtimesResult.rows) {
            const seatsQuery = `
                SELECT seat_number, status
                FROM seats
                WHERE showtime_id = $1
                ORDER BY seat_number
            `;
            const seatsResult = await pool.query(seatsQuery, [showtime.id]);
            showtime.seats = seatsResult.rows;
        }

        res.json(showtimesResult.rows);
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

        // Sort seat IDs to avoid deadlocks
        const sortedSeatIds = seats.map(s => s.id).sort((a, b) => a - b);

        // Lock seats
        const lockQuery = `
            SELECT seat_number, status
            FROM seats
            WHERE id = ANY($1::int[]) AND showtime_id = $2
            ORDER BY id
            FOR UPDATE
        `;
        const lockResult = await client.query(lockQuery, [sortedSeatIds, showtimeId]);

        // Check if all seats are available
        const unavailableSeats = lockResult.rows.filter(s => s.status !== 'available');
        if (unavailableSeats.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({
                error: 'Some seats are no longer available',
                unavailable: unavailableSeats.map(s => s.seat_number)
            });
        }

        // Insert customer
        const customerInsert = `
            INSERT INTO customers (name, email)
            VALUES ($1, $2)
            RETURNING id
        `;
        const customerResult = await client.query(customerInsert, [customerName, customerEmail]);
        const customerId = customerResult.rows[0].id;

        // Insert payment
        const paymentInsert = `
            INSERT INTO payments (customer_id, amount, payment_method, status)
            VALUES ($1, $2, $3, 'completed')
            RETURNING id
        `;
        const paymentResult = await client.query(paymentInsert, [customerId, paymentAmount, paymentMethod]);
        const paymentId = paymentResult.rows[0].id;

        // Update seats to booked
        const updateSeats = `
            UPDATE seats
            SET status = 'booked'
            WHERE id = ANY($1::int[])
        `;
        await client.query(updateSeats, [sortedSeatIds]);

        // Create tickets
        const ticketInserts = seats.map(seat => {
            return client.query(
                `INSERT INTO tickets (showtime_id, seat_id, customer_id, payment_id, price)
                 VALUES ($1, $2, $3, $4, $5)`,
                [showtimeId, seat.id, customerId, paymentId, seat.price]
            );
        });
        await Promise.all(ticketInserts);

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

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));