require('dotenv').config();
const express = require('express'); 
const cors = require('cors');
const helmet = require('helmet');

// CAMINHOS DAS ROTAS
const authRoutes = require('./src/routes/authRoutes');
const eventoRoutes = require('./src/routes/eventoRoutes');
const compraRoutes = require('./src/routes/compraRoutes');
const pagamentoRoutes = require('./src/routes/pagamentoRoutes');
const comunidadeRoutes = require('./src/routes/comunidadeRoutes');

// CONTROLLERS
const pagamentoController = require('./src/controllers/pagamentoController');
const db = require('./src/config/database');

const app = express();

// Router de Usuários para o Staff
const routerUsuarios = express.Router();

// --- 1. MIDDLEWARES DE SEGURANÇA E CORS ---
app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(helmet({ 
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false
}));

// --- 2. ROTA DE WEBHOOK (STRIPE) ---
// Deve vir ANTES do express.json() para não corromper a assinatura
app.post(
  '/api/pagamento/webhook',
  express.raw({ type: 'application/json' }),
  pagamentoController.webhookStripe
);

// --- 3. PARSERS JSON ---
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- 4. INICIALIZAÇÃO E SINCRONIZAÇÃO DO BANCO ---
const inicializarBanco = async () => {
  try {
    console.log('--- 🔄 Iniciando Conexão com o Banco ---');
    await db.query('SELECT NOW()');
    
    // 1. Criar Tabelas Base
    await db.query(`
      CREATE TABLE IF NOT EXISTS public.usuarios (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(255),
        email VARCHAR(255) UNIQUE NOT NULL,
        senha VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        status VARCHAR(50) DEFAULT 'Ativo',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS public.produtores (
        email VARCHAR(255) PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        senha VARCHAR(255) NOT NULL,
        data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS public.eventos (
        id SERIAL PRIMARY KEY,
        produtor_email VARCHAR(255) REFERENCES public.produtores(email) ON DELETE CASCADE,
        nome VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'Ativo',
        data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // --- 2. MIGRAÇÕES STRIPE CONNECT (ESSENCIAL) ---
    console.log('--- 💳 Sincronizando Colunas Stripe ---');
    await db.query(`ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS stripe_account_id VARCHAR(255)`);
    await db.query(`ALTER TABLE public.produtores ADD COLUMN IF NOT EXISTS stripe_account_id VARCHAR(255)`);
    await db.query(`ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS stripe_account_id VARCHAR(255)`);
    await db.query(`ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS preco DECIMAL(10,2) DEFAULT 0`);

    // --- 3. OUTRAS MIGRAÇÕES ---
    await db.query(`ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user'`);
    await db.query(`ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Ativo'`);
    await db.query(`ALTER TABLE public.produtores ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'produtor'`);
    await db.query(`ALTER TABLE public.produtores ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Ativo'`);

    console.log('✅ Banco de dados sincronizado e pronto!');
  } catch (err) {
    console.error('❌ ERRO NA SINCRONIZAÇÃO:', err.message);
  }
};

// --- 5. LÓGICA DA ROTA DE USUÁRIOS (PAINEL STAFF) ---
routerUsuarios.get('/', async (req, res) => {
  try {
    const query = `
      SELECT nome, email, role, status, data_criacao as created_at, stripe_account_id FROM public.produtores
      UNION ALL
      SELECT nome, email, role, status, created_at, stripe_account_id FROM public.usuarios
      ORDER BY created_at DESC
    `;
    const result = await db.query(query);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- 6. MONITORAMENTO ---
app.use((req, res, next) => {
  console.log(`📡 [${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// --- 7. REGISTRO DAS ROTAS DA API ---
app.use('/api/auth', authRoutes);
app.use('/api/eventos', eventoRoutes);
  // AJUSTE: Mudei para SINGULAR para bater com o seu Front-end
app.use('/api/pagamento', pagamentoRoutes); 
app.use('/api/compras', compraRoutes);
app.use('/api/comunidades', comunidadeRoutes); 
app.use('/api/usuarios', routerUsuarios);

app.get('/ping', (req, res) => res.status(200).json({ status: 'Linkah API Online', timestamp: new Date() }));

// --- 8. START DO SERVIDOR ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Linkah API voando na porta: ${PORT}`);
  await inicializarBanco();
});