const { Pool } = require('pg');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

console.log('--- Verificação de Variáveis ---');
console.log('DB_HOST:', process.env.DB_HOST || '❌ NÃO ENCONTRADO');
console.log('-------------------------------');

const pool = new Pool({
  user: String(process.env.DB_USER || 'postgres'),
  host: String(process.env.DB_HOST || 'localhost'),
  database: String(process.env.DB_DATABASE || 'linkah_db'),
  password: String(process.env.DB_PASSWORD || 'admin'),
  port: Number(process.env.DB_PORT) || 5432,
  // ADICIONE ISSO AQUI:
  ssl: process.env.DB_HOST && process.env.DB_HOST !== 'localhost' 
    ? { rejectUnauthorized: false } 
    : false
});

// Teste de conexão
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ ERRO CRÍTICO NO POSTGRES:', err.stack); // stack dá mais detalhes que message
  } else {
    console.log('🐘 BANCO DE DADOS CONECTADO COM SUCESSO!');
    release();
  }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};