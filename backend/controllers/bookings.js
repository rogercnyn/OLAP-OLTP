const { primaryPool } = require('../config/db');

const bookSeats = async (req, res) => {
  const client = await primaryPool.connect();
  const { customerId, showtimeId, seatIds } = req.body; 
  // seatIds is an array, e.g., [15, 16]

  try {
    // 1. Start Transaction
    await client.query('BEGIN');

    // 2. Check for availability with LOCKING (Deadlock Avoidance Strategy)
    // We lock the specific rows in the 'seats' or 'reservation_holds' logic.
    // Strategy: We try to insert into reservation_holds. 
    // If it fails due to UNIQUE constraint, we know it's taken.
    
    // However, to prevent "phantom reads," strictly we should lock the context.
    // Easier approach for high concurrency: "Insert if not exists" logic inside transaction.
    
    const heldSeats = [];

    for (const seatId of seatIds) {
        // QUERY: Check if active hold exists for this showtime/seat
        // "FOR UPDATE" locks these rows if they exist, preventing others from modifying them
        const checkQuery = `
            SELECT id FROM reservation_holds 
            WHERE showtime_id = $1 AND seat_id = $2 
            AND (status = 'BOOKED' OR (status = 'HELD' AND hold_expires_at > NOW()))
            FOR UPDATE 
        `; 
        // Note: FOR UPDATE only locks *existing* rows. 
        // Ideally, use SERIALIZABLE isolation level, but Read Committed + Unique Constraint is standard.

        const { rows } = await client.query(checkQuery, [showtimeId, seatId]);

        if (rows.length > 0) {
            throw new Error(`Seat ${seatId} is already taken.`);
        }

        // 3. Insert the Hold
        const insertQuery = `
            INSERT INTO reservation_holds (showtime_id, seat_id, customer_id, hold_expires_at, status)
            VALUES ($1, $2, $3, NOW() + INTERVAL '5 minutes', 'HELD')
            RETURNING id
        `;
        const result = await client.query(insertQuery, [showtimeId, seatId, customerId]);
        heldSeats.push(result.rows[0]);
    }

    // 4. Commit Transaction
    await client.query('COMMIT');
    
    res.status(201).json({ message: "Seats reserved successfully", reservations: heldSeats });

  } catch (error) {
    // 5. Rollback on ANY error (Deadlock or Race Condition hit)
    await client.query('ROLLBACK');
    console.error("Transaction Failed:", error.message);
    
    if (error.message.includes('already taken') || error.code === '23505') {
        res.status(409).json({ error: "One or more seats were just taken by another user." });
    } else {
        res.status(500).json({ error: "Internal Server Error" });
    }
  } finally {
    client.release();
  }
};

module.exports = { bookSeats };