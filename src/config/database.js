const { Pool } = require('pg');

// Remove parâmetros extras da URL que podem causar conflito no driver pg do Node
let connectionString = process.env.DATABASE_URL;
if (connectionString) {
  connectionString = connectionString.split('&channel_binding=')[0];
}

const isProduction = !!connectionString;

const pool = new Pool({
  connectionString: connectionString || undefined,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  // Fallback caso use as variáveis separadas
  ...(!connectionString && {
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
  })
});

// Esse log TEM que aparecer no Render
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ ERRO NA CONEXÃO COM O BANCO:', err.message);
  } else {
    const hostInfo = process.env.DATABASE_URL ? process.env.DATABASE_URL.split('@')[1].split('/')[0] : process.env.DB_HOST;
    console.log('🐘 CONECTADO AO BANCO:', hostInfo); // Loga o host sem a senha
  }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};