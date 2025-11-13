const express = require('express');
const db = require('./db');
const cron = require('node-cron');

const app = express();

// Middleware
app.use(express.json());

// Routes
app.post('/api/users', async (req, res) => {
  try {
    const { name, email } = req.body;
    const result = await db.query(
      'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *',
      [name, email]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'SELECT user_id, name, email, credits_received, credits_to_give, monthly_sent FROM users WHERE user_id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/recognitions', async (req, res) => {
  const { sender_id, recipient_id, amount, message } = req.body;
  
  // Validation: prevent self-recognition
  if (sender_id === recipient_id) {
    return res.status(400).json({ error: 'Self-recognition is not allowed' });
  }
  
  let client;
  try {
    // Get a client from the pool
    client = await db.getClient();
    
    // Start transaction
    await client.query('BEGIN');
    
    // Lock sender's row and get current credits
    const senderResult = await client.query(
      'SELECT credits_to_give, monthly_sent FROM users WHERE user_id = $1 FOR UPDATE',
      [sender_id]
    );
    
    if (senderResult.rows.length === 0) {
      throw new Error('Sender not found');
    }
    
    const sender = senderResult.rows[0];
    
    // Validate sufficient credits
    if (amount > sender.credits_to_give) {
      throw new Error('Insufficient credits');
    }
    
    // Validate monthly limit
    if (sender.monthly_sent + amount > 100) {
      throw new Error('Monthly sending limit exceeded');
    }
    
    // Update sender's credits
    await client.query(
      'UPDATE users SET credits_to_give = credits_to_give - $1, monthly_sent = monthly_sent + $1 WHERE user_id = $2',
      [amount, sender_id]
    );
    
    // Update recipient's credits
    await client.query(
      'UPDATE users SET credits_received = credits_received + $1 WHERE user_id = $2',
      [amount, recipient_id]
    );
    
    // Insert recognition record
    const recognitionResult = await client.query(
      'INSERT INTO recognitions (sender_id, recipient_id, amount, message) VALUES ($1, $2, $3, $4) RETURNING *',
      [sender_id, recipient_id, amount, message]
    );
    
    // Commit transaction
    await client.query('COMMIT');
    
    // Send response
    res.status(201).json(recognitionResult.rows[0]);
    
  } catch (error) {
    // Rollback transaction on error
    if (client) {
      await client.query('ROLLBACK');
    }
    res.status(500).json({ error: error.message });
  } finally {
    // Release client back to pool
    if (client) {
      client.release();
    }
  }
});

app.post('/api/recognitions/:id/endorse', async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;
    
    await db.query(
      'INSERT INTO endorsements (user_id, recognition_id) VALUES ($1, $2)',
      [user_id, id]
    );
    
    res.status(201).json({ message: 'Endorsement created successfully' });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'You have already endorsed this recognition' });
    }
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/redeem', async (req, res) => {
  const { user_id, credits_to_redeem } = req.body;
  
  let client;
  try {
    // Get a client from the pool
    client = await db.getClient();
    
    // Start transaction
    await client.query('BEGIN');
    
    // Lock user's row and get current credits_received
    const userResult = await client.query(
      'SELECT credits_received FROM users WHERE user_id = $1 FOR UPDATE',
      [user_id]
    );
    
    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }
    
    const user = userResult.rows[0];
    
    // Validate sufficient credits to redeem
    if (credits_to_redeem > user.credits_received) {
      throw new Error('Insufficient credits to redeem');
    }
    
    // Update user's credits_received
    await client.query(
      'UPDATE users SET credits_received = credits_received - $1 WHERE user_id = $2',
      [credits_to_redeem, user_id]
    );
    
    // Commit transaction
    await client.query('COMMIT');
    
    // Calculate voucher value (credits * 5 INR)
    const voucher_value_inr = credits_to_redeem * 5;
    
    // Send response
    res.status(200).json({
      message: 'Credits redeemed successfully',
      voucher_value_inr
    });
    
  } catch (error) {
    // Rollback transaction on error
    if (client) {
      await client.query('ROLLBACK');
    }
    res.status(500).json({ error: error.message });
  } finally {
    // Release client back to pool
    if (client) {
      client.release();
    }
  }
});

app.get('/api/leaderboard', async (req, res) => {
  try {
    const limit = req.query.limit || 10;
    
    const leaderboardQuery = `
      SELECT 
        u.user_id,
        u.name,
        u.credits_received,
        COUNT(r.recognition_id) AS recognitions_received_count,
        (
          SELECT COUNT(*) 
          FROM endorsements e 
          JOIN recognitions r_inner ON e.recognition_id = r_inner.recognition_id 
          WHERE r_inner.recipient_id = u.user_id
        ) AS total_endorsements_received
      FROM users u
      LEFT JOIN recognitions r ON u.user_id = r.recipient_id
      GROUP BY u.user_id
      ORDER BY u.credits_received DESC, u.user_id ASC
      LIMIT $1
    `;
    
    const result = await db.query(leaderboardQuery, [limit]);
    res.status(200).json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Monthly credit reset cron job (runs at midnight on the 1st of every month)
cron.schedule('0 0 1 * *', async () => {
  console.log('Running monthly credit reset job...');
  
  try {
    const resetQuery = `
      UPDATE users 
      SET credits_to_give = 100 + (CASE WHEN credits_to_give > 50 THEN 50 ELSE credits_to_give END),
          monthly_sent = 0
    `;
    
    await db.query(resetQuery);
    console.log('Monthly credit reset successful.');
  } catch (error) {
    console.error('Monthly credit reset failed:', error);
  }
});

// Start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
