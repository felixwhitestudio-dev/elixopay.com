const { Pool } = require('pg');

const pool = new Pool({
  user: 'elixouser',
  host: 'localhost',
  database: 'elixopay',
  password: 'yourpassword', // เปลี่ยนเป็นรหัสจริง
  port: 5432,
});

module.exports = pool;
