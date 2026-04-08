require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

// ROTAS
const authRoutes = require('./src/routes/authRoutes');
const eventoRoutes = require('./src/routes/eventoRoutes');
const compraRoutes = require('./src/routes/compraRoutes');
const pagamentoRoutes = require('./src/routes/pagamentoRoutes');
const comunidadeRoutes = require('./src/routes/comunidadeRoutes');
const usuarioRoutes = require('./src/routes/usuarioRoutes'); // <-- ADICIONADO

const pagamentoController = require('./src/controllers/pagamentoController');
const db = require('./src/config/database');

const app = express();
app.set('trust proxy', 1);

// ========================================
// CONFIGURAÇÃO DE ORIGENS (CORS)
// ========================================
const allowedOrigins = [
  'https://linkah.eu',
  'https://www.linkah.eu',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

const corsOptions = {
  origin: function (origin, callback) {
    // Permite requests sem origin (como mobile apps ou curl)
    if (!origin) return callback(null, true);

    // Checa se está na lista fixa
    const isAllowed = allowedOrigins.includes(origin);
    
    // Checa se é um preview da Vercel (Regex para aceitar subdomínios da Vercel do seu projeto)
    const isVercelPreview = origin.includes('vercel.app') && origin.includes('linkah');

    if (isAllowed || isVercelPreview) {
      return callback(null, true);
    }

    console.log('❌ CORS bloqueado para:', origin);
    return callback(new Error(`CORS bloqueado para ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ========================================
// HELMET (Segurança de Headers)
// ========================================
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false
  })
);

// ========================================
// WEBHOOK STRIPE (Precisa vir ANTES do express.json)
// ========================================
app.post(
  ['/api/pagamento/webhook', '/api/pagamentos/webhook'],
  express.raw({ type: 'application/json' }),
  (req, res) => {
    const webhookHandler = pagamentoController.ouvirStripe || pagamentoController.webhookStripe;
    if (typeof webhookHandler === 'function') {
      return webhookHandler(req, res);
    }
    console.error('❌ Webhook não configurado no Controller');
    return res.status(500).send('Webhook handler not configured');
  }
);

// ========================================
// PARSERS
// ========================================
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ========================================
// ARQUIVOS ESTÁTICOS
// ========================================
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ========================================
// MIDDLEWARE DE LOG DE ACESSOS
// ========================================
app.use((req, res, next) => {
  console.log(
    `📡 [${new Date().toLocaleTimeString()}] ${req.method} ${req.url} | Origem: ${req.headers.origin || 'sem-origin'}`
  );
  next();
});

// ========================================
// SYNC DO BANCO DE DADOS
// ========================================
const inicializarBanco = async () => {
  try {
    console.log('🔄 Sincronizando tabelas e colunas...');
    await db.query('SELECT NOW()');

    // Criação das tabelas base
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
        role VARCHAR(50) DEFAULT 'produtor',
        status VARCHAR(50) DEFAULT 'Ativo',
        data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS public.eventos (
        id SERIAL PRIMARY KEY,
        produtor_email VARCHAR(255) REFERENCES public.produtores(email) ON DELETE CASCADE,
        nome VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'Ativo'
      );
    `);

    // Migrações Automáticas (Colunas Adicionais)
    const migrations = [
      // Eventos (Suporte para Presencial e Banner de Patrocínio)
      "ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS descricao TEXT",
      "ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS preco DECIMAL(10,2) DEFAULT 0",
      "ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS imagem_capa TEXT",
      "ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS banner_patrocinio TEXT",
      "ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS categoria VARCHAR(100)",
      "ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS data_inicio DATE",
      "ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS hora_inicio TIME",
      "ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS data_termino DATE",
      "ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS hora_termino TIME",
      "ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS tipo VARCHAR(50) DEFAULT 'Presencial'",
      "ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS local_nome VARCHAR(255)",
      "ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS cep VARCHAR(20)",
      "ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS endereco VARCHAR(255)",
      "ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS numero VARCHAR(50)",
      "ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS cidade VARCHAR(255)",
      "ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS estado VARCHAR(10)",
      "ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS capacidade INTEGER",
      
      // Produtores
      "ALTER TABLE public.produtores ADD COLUMN IF NOT EXISTS cpf_cnpj VARCHAR(255)",
      "ALTER TABLE public.produtores ADD COLUMN IF NOT EXISTS bio TEXT",
      
      // Usuarios
      "ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS foto TEXT",
      "ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS bio TEXT"
    ];

    for (const sql of migrations) {
      try {
        await db.query(sql);
      } catch (err) {
        // Ignora erro se a coluna já existir
      }
    }

    console.log('✅ Estrutura do Banco de Dados pronta!');
  } catch (err) {
    console.error('❌ Erro Crítico no Banco:', err.message);
  }
};

// ========================================
// ROTAS DA API
// ========================================
app.use('/api/auth', authRoutes);
app.use('/api/eventos', eventoRoutes);
app.use('/api/pagamento', pagamentoRoutes);
app.use('/api/compras', compraRoutes);
app.use('/api/comunidades', comunidadeRoutes);
app.use('/api/usuarios', usuarioRoutes); // <-- ADICIONADO

// Health Check
app.get('/ping', (req, res) => {
  res.status(200).json({ status: 'Linkah API Online', timestamp: new Date() });
});

// ========================================
// TRATAMENTO DE ERROS GLOBAIS
// ========================================
app.use((err, req, res, next) => {
  console.error('❌ ERRO DETECTADO:', err.message);
  
  if (err.message.includes('CORS')) {
    return res.status(403).json({ 
      error: 'CORS Error', 
      message: 'Origem não permitida pela Linkah API' 
    });
  }

  res.status(500).json({
    error: 'Internal Server Error',
    details: process.env.NODE_ENV === 'development' ? err.message : 'Consulte o suporte'
  });
});

// ========================================
// INICIALIZAÇÃO
// ========================================
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Linkah API em órbita na porta ${PORT}`);
  await inicializarBanco();
});