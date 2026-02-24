const { Pool } = require('pg');
const path = require('path');

// Carrega o .env apenas para desenvolvimento local
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

console.log('--- 🔄 Iniciando Conexão com o Banco de Dados ---');

/**
 * Identifica se estamos em produção. 
 * Na AWS ou Render, as variáveis DB_HOST ou DATABASE_URL estarão presentes.
 */
const isProduction = process.env.DATABASE_URL || process.env.DB_HOST;

const poolConfig = {
  // 1. Se existir a URL única (padrão Render), usamos ela
  connectionString: process.env.DATABASE_URL || null,

  // 2. Se não existir a URL única, montamos com as variáveis soltas (padrão AWS e Local)
  user: !process.env.DATABASE_URL ? String(process.env.DB_USER || 'postgres') : undefined,
  host: !process.env.DATABASE_URL ? String(process.env.DB_HOST || 'localhost') : undefined,
  database: !process.env.DATABASE_URL ? String(process.env.DB_DATABASE || 'linkah_db') : undefined,
  password: !process.env.DATABASE_URL ? String(process.env.DB_PASSWORD || 'admin') : undefined,
  port: !process.env.DATABASE_URL ? Number(process.env.DB_PORT || 5432) : undefined,

  // 3. Configuração de SSL: Obrigatória para AWS RDS e Render em produção
  ssl: isProduction 
    ? { rejectUnauthorized: false } 
    : false
};

const pool = new Pool(poolConfig);

// Teste de conexão imediato ao iniciar o servidor
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ ERRO CRÍTICO DE CONEXÃO:');
    console.error('Mensagem:', err.message);
    console.log('--- DICA: Verifique se o Security Group da AWS permite a porta 5432 ---');
  } else {
    console.log('🐘 BANCO DE DADOS CONECTADO COM SUCESSO!');
    console.log('📍 Conectado em:', isProduction ? 'Nuvem (AWS/Render)' : 'Localhost');
    console.log('⏰ Hora do banco:', res.rows[0].now);
  }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool // Exportado caso precise para outras operações
};