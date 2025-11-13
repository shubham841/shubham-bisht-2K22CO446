const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Create PostgreSQL connection pool configured for Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    require: true
  }
});

// Export query method for simple queries
const query = (text, params) => {
  return pool.query(text, params);
};

// Export getClient method to get a client from the pool
const getClient = () => {
  return pool.connect();
};

module.exports = {
  query,
  getClient,
  pool
};
