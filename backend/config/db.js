const { Pool } = require('pg');
require('dotenv').config();

// 1. Primary OLTP Database (Read/Write)
const primaryPool = new Pool({
  connectionString: process.env.DATABASE_URL_PRIMARY,
});

// 2. Reports/OLAP Database (Read Only - Replicated)
const reportsPool = new Pool({
  connectionString: process.env.DATABASE_URL_REPORTS,
});

module.exports = {
  primaryPool,
  reportsPool
};