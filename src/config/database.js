const { Pool } = require('pg');
const path = require('path');

// Carrega o .env apenas para desenvolvimento local
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

console.log('--- 🔄 Iniciando Conexão com o Banco ---');

// O segredo está aqui: Se existir DATABASE_URL (no Render existe), ele usa ela. 
// Caso contrário, usa as variáveis soltas (local).
const isProduction = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: isProduction ? process.env.DATABASE_URL : null,
  // Fallback para local caso não exista DATABASE_URL
  user: !isProduction ? String(process.env.DB_USER || 'postgres') : undefined,
  host: !isProduction ? String(process.env.DB_HOST || 'localhost') : undefined,
  database: !isProduction ? String(process.env.DB_DATABASE || 'linkah_db') : undefined,
  password: !isProduction ? String(process.env.DB_PASSWORD || 'admin') : undefined,
  port: !isProduction ? Number(process.env.DB_PORT || 5432) : undefined,
  
  // CONFIGURAÇÃO OBRIGATÓRIA PARA O RENDER
  ssl: isProduction 
    ? { rejectUnauthorized: false } 
    : false
});

// Teste de conexão melhorado
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ ERRO CRÍTICO NO POSTGRES:', err.message);
    console.log('Verifique se a DATABASE_URL no Render está correta.');
  } else {
    console.log('🐘 BANCO DE DADOS CONECTADO COM SUCESSO! Hora do banco:', res.rows[0].now);
  }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};