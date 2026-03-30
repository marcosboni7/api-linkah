const { Pool } = require('pg');

const isProduction = !!process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false
});

// Esse log TEM que aparecer no Render
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ ERRO NA CONEXÃO COM O BANCO:', err.message);
  } else {
    console.log('🐘 CONECTADO AO BANCO:', process.env.DATABASE_URL.split('@')[1].split('/')[0]); // Loga o host sem a senha
  }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};