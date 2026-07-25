const { Pool } = require('pg');

let connectionString = process.env.DATABASE_URL;
if (connectionString) {
  connectionString = connectionString.split('&channel_binding=')[0];
}

const isProduction = !!connectionString;

const pool = new Pool({
  connectionString: connectionString || undefined,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  ...(!connectionString && {
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
  })
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ ERRO NA CONEXÃO COM O BANCO:', err.message);
  } else {
    const hostInfo = process.env.DATABASE_URL ? process.env.DATABASE_URL.split('@')[1].split('/')[0] : process.env.DB_HOST;
    console.log('🐘 CONECTADO AO BANCO:', hostInfo);
  }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};