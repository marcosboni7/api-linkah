require('dotenv').config();
const express = require('express'); 
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

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
// ✅ IMPORTANTE: Deve vir antes do express.json()
app.post(
  '/api/pagamento/webhook',
  express.raw({ type: 'application/json' }),
  pagamentoController.webhookStripe
);

// --- 3. PARSERS JSON E PASTA ESTÁTICA ---
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Libera o acesso público às imagens da pasta uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- 4. INICIALIZAÇÃO E SINCRONIZAÇÃO DO BANCO ---
const inicializarBanco = async () => {
  try {
    console.log('--- 🔄 Iniciando Conexão com o Banco ---');
    await db.query('SELECT NOW()');
    
    // 1. Criar Tabelas Base (se não existirem)
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
        data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        imagem_capa TEXT,
        categoria VARCHAR(100),
        descricao TEXT,
        data_inicio DATE,
        hora_inicio TIME,
        local_nome VARCHAR(255),
        cidade VARCHAR(100),
        estado VARCHAR(50), 
        tipo VARCHAR(50),
        moeda VARCHAR(10) DEFAULT 'BRL'
      );
    `);

    // --- 2. MIGRAÇÕES DE COLUNAS (Garante que colunas novas existam em tabelas velhas) ---
    console.log('--- 💳 Sincronizando Migrações e Ajustes de Coluna ---');
    
    // Ajuste do tamanho do campo Estado (Evita o Erro 500 de "value too long")
    await db.query(`ALTER TABLE public.eventos ALTER COLUMN estado TYPE VARCHAR(100)`);
    
    // Colunas Stripe
    await db.query(`ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS stripe_account_id VARCHAR(255)`);
    await db.query(`ALTER TABLE public.produtores ADD COLUMN IF NOT EXISTS stripe_account_id VARCHAR(255)`);
    await db.query(`ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS stripe_account_id VARCHAR(255)`);
    await db.query(`ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS preco DECIMAL(10,2) DEFAULT 0`);

    // Campos de Perfil Produtor (Endereço e Documento)
    await db.query(`ALTER TABLE public.produtores ADD COLUMN IF NOT EXISTS cpf_cnpj VARCHAR(20)`);
    await db.query(`ALTER TABLE public.produtores ADD COLUMN IF NOT EXISTS cep VARCHAR(15)`);
    await db.query(`ALTER TABLE public.produtores ADD COLUMN IF NOT EXISTS rua VARCHAR(255)`);
    await db.query(`ALTER TABLE public.produtores ADD COLUMN IF NOT EXISTS numero VARCHAR(20)`);
    await db.query(`ALTER TABLE public.produtores ADD COLUMN IF NOT EXISTS bairro VARCHAR(100)`);

    // Roles e Status
    await db.query(`ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user'`);
    await db.query(`ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Ativo'`);
    await db.query(`ALTER TABLE public.produtores ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'produtor'`);
    await db.query(`ALTER TABLE public.produtores ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Ativo'`);

    console.log('✅ Banco de dados sincronizado e protegido!');
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
app.use('/api/pagamento', pagamentoRoutes); // ✅ Sincronizado com o Front-end (singular)
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