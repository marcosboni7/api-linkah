const { Pool } = require('pg');
const path = require('path');

// Tenta carregar o .env da raiz do projeto (um nível acima da pasta src)
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// Log de segurança: Se aparecer undefined aqui, o arquivo .env ainda está no lugar errado!
console.log('--- Verificação de Variáveis ---');
console.log('DB_HOST:', process.env.DB_HOST || '❌ NÃO ENCONTRADO');
console.log('DB_USER:', process.env.DB_USER || '❌ NÃO ENCONTRADO');
console.log('-------------------------------');

const pool = new Pool({
  user: String(process.env.DB_USER || 'postgres'), // fallback para o padrão
  host: String(process.env.DB_HOST || 'localhost'),
  database: String(process.env.DB_DATABASE || 'linkah_db'),
  password: String(process.env.DB_PASSWORD || ''),
  port: Number(process.env.DB_PORT) || 5432,
});

// Teste de conexão
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ ERRO CRÍTICO NO POSTGRES:', err.message);
  } else {
    console.log('🐘 BANCO DE DADOS CONECTADO COM SUCESSO!');
    release();
  }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};