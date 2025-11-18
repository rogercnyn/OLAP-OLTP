require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: 'movies_oltp',
    password: process.env.DB_PASSWORD || 'password',
    port: 5432,
});

// 1. Get Movies (Now includes PRICE)
app.get('/api/schedule', async (req, res) => {
    const { date } = req.query; 
    try {
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
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// 2. Get Seats (Unchanged)
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
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// 3. Book Seats & Process Payment (The Heavy Lifting)
app.post('/api/book', async (req, res) => {
    const { showtimeId, customerId, seatIds } = req.body;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // A. Lookup Movie Price first (Secure: don't trust frontend price)
        const priceRes = await client.query(`
            SELECT m.price 
            FROM showtimes s 
            JOIN movies m ON s.movie_id = m.id 
            WHERE s.id = $1
        `, [showtimeId]);
        
        const pricePerSeat = parseFloat(priceRes.rows[0].price);
        const totalAmount = pricePerSeat * seatIds.length;

        // B. Record the Payment
        const payRes = await client.query(`
            INSERT INTO payments (customer_id, amount, payment_method)
            VALUES ($1, $2, 'CREDIT_CARD')
            RETURNING id
        `, [customerId, totalAmount]);
        const paymentId = payRes.rows[0].id;

        // C. Book each seat
        for (const seatId of seatIds) {
            // 1. Create Hold (Lock the seat)
            const holdRes = await client.query(`
                INSERT INTO reservation_holds (showtime_id, seat_id, customer_id, hold_expires_at, status)
                VALUES ($1, $2, $3, NOW() + INTERVAL '1 year', 'CONFIRMED')
                RETURNING id
            `, [showtimeId, seatId, customerId]);

            // 2. Create Ticket (Link to Payment)
            await client.query(`
                INSERT INTO tickets (reservation_id, payment_id, price)
                VALUES ($1, $2, $3)
            `, [holdRes.rows[0].id, paymentId, pricePerSeat]);
        }

        await client.query('COMMIT');
        res.status(201).json({ message: 'Booking & Payment Successful!', total: totalAmount });

    } catch (error) {
        await client.query('ROLLBACK');
        if (error.code === '23505') {
            res.status(409).json({ error: 'Payment Failed: Seats were just taken.' });
        } else {
            console.error(error);
            res.status(500).json({ error: 'Transaction failed' });
        }
    } finally {
        client.release();
    }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));