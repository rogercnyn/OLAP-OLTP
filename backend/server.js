require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// --- 1. ROBUST DATABASE CONFIGURATION ---
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: 'movies_oltp',
    password: process.env.DB_PASSWORD || 'password',
    port: 5432,
    // JMeter Optimization: Prevent crashing under load
    max: 20, // Limit max connections
    idleTimeoutMillis: 30000, // Close idle clients after 30s
    connectionTimeoutMillis: 2000, // Fail fast if DB is full
});

// Global error handler for the pool (prevents exit on idle client errors)
pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

// --- 2. API ROUTES ---

// Get Schedule (Movies for a specific date)
app.get('/api/schedule', async (req, res) => {
    const { date } = req.query; 
    try {
        // FIXED: Changed "a.auditorium_id" to "a.id" in the JOIN condition
        const query = `
            SELECT 
                m.id as movie_id, m.title, m.duration_minutes, m.price,
                a.name as cinema_name,
                json_agg(json_build_object('id', s.id, 'time', to_char(s.start_time, 'HH24:MI'))) as showtimes
            FROM showtimes s
            JOIN movies m ON s.movie_id = m.id
            JOIN auditoriums a ON s.auditorium_id = a.id 
            WHERE DATE(s.start_time) = $1
            GROUP BY m.id, m.title, m.duration_minutes, m.price, a.name
            ORDER BY a.name;
        `;
        const result = await pool.query(query, [date]);
        res.json(result.rows);
    } catch (err) {
        console.error("Schedule Error:", err.message); 
        res.status(500).json({ error: 'Database error' });
    }
});

// Get Seats for a specific showtime
app.get('/api/showtimes/:id/seats', async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT 
                s.id, s.row_code, s.number,
                CASE 
                    WHEN rh.id IS NOT NULL AND (rh.status = 'CONFIRMED') THEN 'TAKEN' 
                    ELSE 'AVAILABLE' 
                END as status
            FROM seats s
            JOIN showtimes st ON s.auditorium_id = st.auditorium_id
            LEFT JOIN reservation_holds rh ON s.id = rh.seat_id AND rh.showtime_id = st.id
            WHERE st.id = $1
            ORDER BY s.row_code, s.number;
        `;
        const result = await pool.query(query, [id]);
        res.json(result.rows);
    } catch (err) {
        console.error("Seat Fetch Error:", err.message);
        res.status(500).json({ error: 'Database error' });
    }
});

// --- 3. TRANSACTIONAL BOOKING (PESSIMISTIC LOCKING) ---
app.post('/api/book', async (req, res) => {
    const { showtimeId, customerId, seatIds } = req.body;
    
    // Helper variable to ensure we release the client even if errors happen
    let client;

    try {
        // A. CONNECT (Inside Try/Catch to handle connection exhaustion)
        client = await pool.connect();
        
        await client.query('BEGIN');

        // B. DEADLOCK AVOIDANCE: Sort IDs to always lock in same order
        const sortedSeatIds = [...seatIds].sort((a, b) => a - b);

        // C. PESSIMISTIC LOCKING (FOR UPDATE)
        for (const seatId of sortedSeatIds) {
            // Lock the specific seat row.
            // This makes other transactions WAIT here if they try to book the same seat.
            await client.query('SELECT id FROM seats WHERE id = $1 FOR UPDATE', [seatId]);

            // Double check status after acquiring the lock
            const existingHold = await client.query(`
                SELECT id FROM reservation_holds 
                WHERE showtime_id = $1 AND seat_id = $2
            `, [showtimeId, seatId]);

            if (existingHold.rows.length > 0) {
                throw new Error(`Seat ${seatId} is already booked.`);
            }
        }

        // D. CALCULATE PRICE
        const priceRes = await client.query(`
            SELECT m.price 
            FROM showtimes s 
            JOIN movies m ON s.movie_id = m.id 
            WHERE s.id = $1
        `, [showtimeId]);
        
        const pricePerSeat = parseFloat(priceRes.rows[0].price);
        const totalAmount = pricePerSeat * seatIds.length;

        // E. PROCESS PAYMENT RECORD
        const payRes = await client.query(`
            INSERT INTO payments (customer_id, amount, payment_method)
            VALUES ($1, $2, 'CREDIT_CARD')
            RETURNING id
        `, [customerId, totalAmount]);
        const paymentId = payRes.rows[0].id;

        // F. INSERT RESERVATIONS & TICKETS
        for (const seatId of sortedSeatIds) {
            // Create Hold
            const holdRes = await client.query(`
                INSERT INTO reservation_holds (showtime_id, seat_id, customer_id, hold_expires_at, status)
                VALUES ($1, $2, $3, NOW() + INTERVAL '1 year', 'CONFIRMED')
                RETURNING id
            `, [showtimeId, seatId, customerId]);

            // Create Ticket
            await client.query(`
                INSERT INTO tickets (reservation_id, payment_id, price)
                VALUES ($1, $2, $3)
            `, [holdRes.rows[0].id, paymentId, pricePerSeat]);
        }

        await client.query('COMMIT');
        res.status(201).json({ message: 'Booking & Payment Successful!', total: totalAmount });

    } catch (error) {
        // Only attempt rollback if we actually got a client connection
        if (client) {
            try { await client.query('ROLLBACK'); } catch (e) {}
        }

        // Handle Specific Errors for better UI/JMeter feedback
        if (error.message.includes('already booked') || error.code === '23505') {
             res.status(409).json({ error: 'Seats just taken.' });
        } else if (error.code === '40P01') {
             res.status(409).json({ error: 'Deadlock detected, please retry.' });
        } else {
            console.error("Transaction Error:", error.message);
            res.status(500).json({ error: 'Transaction failed' });
        }
    } finally {
        // CRITICAL: Release the client back to the pool
        if (client) client.release();
    }
});

// --- 4. PROCESS SAFETY NET (Prevents Node Process from Exiting) ---
process.on('uncaughtException', (err) => {
    console.error('CRITICAL: Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('CRITICAL: Unhandled Rejection:', reason);
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));