-- Create users table for Boostly
CREATE TABLE IF NOT EXISTS users (
  user_id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  credits_received INTEGER DEFAULT 0 CHECK (credits_received >= 0),
  credits_to_give INTEGER DEFAULT 100 CHECK (credits_to_give >= 0),
  monthly_sent INTEGER DEFAULT 0 CHECK (monthly_sent >= 0)
);

-- Create recognitions table
CREATE TABLE IF NOT EXISTS recognitions (
  recognition_id SERIAL PRIMARY KEY,
  sender_id INTEGER NOT NULL REFERENCES users(user_id),
  recipient_id INTEGER NOT NULL REFERENCES users(user_id),
  amount INTEGER NOT NULL CHECK (amount > 0),
  message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CHECK (sender_id != recipient_id)
);

-- Create endorsements table
CREATE TABLE IF NOT EXISTS endorsements (
  endorsement_id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(user_id),
  recognition_id INTEGER NOT NULL REFERENCES recognitions(recognition_id),
  UNIQUE (user_id, recognition_id)
);
