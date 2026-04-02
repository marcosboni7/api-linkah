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

const pagamentoController = require('./src/controllers/pagamentoController');
const db = require('./src/config/database');

const app = express();
app.set('trust proxy', 1);

// ========================================
// ORIGENS PERMITIDAS (CORS ATUALIZADO)
// ========================================
const allowedOrigins = [
  'https://linkah.eu',
  'https://www.linkah.eu',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://linkah-frontend-3i4uq5o6n-marcos-projects-b325b3f0.vercel.app'
];

// ========================================
// CORS
// ========================================
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    console.log('❌ CORS bloqueado:', origin);
    return callback(new Error(`CORS bloqueado para ${origin}`));
  },
  methods: ['GET','POST','PUT','DELETE','PATCH','OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type','Authorization'],
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ========================================
// HELMET
// ========================================
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false
  })
);

// ========================================
// WEBHOOK STRIPE
// ========================================
app.post(
  ['/api/pagamento/webhook','/api/pagamentos/webhook'],
  express.raw({ type: 'application/json' }),
  (req,res)=>{
    const webhookHandler =
      pagamentoController.ouvirStripe ||
      pagamentoController.webhookStripe;

    if(typeof webhookHandler === 'function'){
      return webhookHandler(req,res);
    }

    console.error('❌ Webhook não configurado');
    return res.status(500).send('Webhook handler not configured');
  }
);

// ========================================
// BODY PARSER
// ========================================
app.use(express.json({limit:'50mb'}));
app.use(express.urlencoded({limit:'50mb',extended:true}));

// ========================================
// ARQUIVOS ESTÁTICOS
// ========================================
app.use('/uploads', express.static(path.join(__dirname,'uploads')));

// ========================================
// LOG DE REQUESTS
// ========================================
app.use((req,res,next)=>{
  console.log(
    `📡 [${new Date().toLocaleTimeString()}] ${req.method} ${req.url} | Origem: ${req.headers.origin || 'sem-origin'}`
  );
  next();
});

// ========================================
// INICIALIZAÇÃO DO BANCO
// ========================================
const inicializarBanco = async () => {
  try {
    console.log('🔄 Verificando banco...');
    await db.query('SELECT NOW()');

    // ========================================
    // TABELAS BASE (ESTRUTURA ATUALIZADA)
    // ========================================
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

      CREATE TABLE IF NOT EXISTS public.compras (
        id SERIAL PRIMARY KEY,
        usuario_email VARCHAR(255),
        evento_id INTEGER REFERENCES public.eventos(id),
        quantidade INTEGER,
        status VARCHAR(50),
        data_compra TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS public.ingressos (
        id SERIAL PRIMARY KEY,
        evento_id INTEGER REFERENCES public.eventos(id),
        usuario_email VARCHAR(255),
        codigo_ingresso VARCHAR(100) UNIQUE,
        status VARCHAR(50) DEFAULT 'Ativo',
        data_emissao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS public.mensagens_v2 (
        id SERIAL PRIMARY KEY,
        evento_id INTEGER,
        usuario_nome VARCHAR(255),
        usuario_foto TEXT,
        texto TEXT,
        imagem TEXT,
        tipo VARCHAR(50) DEFAULT 'chat',
        status VARCHAR(10) DEFAULT '✨',
        is_host BOOLEAN DEFAULT false,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS public.presenca (
        id SERIAL PRIMARY KEY,
        evento_id INTEGER,
        usuario_nome VARCHAR(255),
        usuario_foto TEXT,
        status VARCHAR(10) DEFAULT '✨',
        ultima_vez TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(evento_id, usuario_nome)
      );
    `);

    // ========================================
    // MIGRAÇÃO AUTOMÁTICA DE COLUNAS
    // ========================================
    const colunas = [
      // PRODUTORES
      "ALTER TABLE public.produtores ADD COLUMN IF NOT EXISTS telefone VARCHAR(255)",
      "ALTER TABLE public.produtores ADD COLUMN IF NOT EXISTS tipo VARCHAR(50)",
      "ALTER TABLE public.produtores ADD COLUMN IF NOT EXISTS data_nascimento DATE",
      "ALTER TABLE public.produtores ADD COLUMN IF NOT EXISTS cpf_cnpj VARCHAR(255)",
      "ALTER TABLE public.produtores ADD COLUMN IF NOT EXISTS bio TEXT",
      "ALTER TABLE public.produtores ADD COLUMN IF NOT EXISTS instagram VARCHAR(255)",
      "ALTER TABLE public.produtores ADD COLUMN IF NOT EXISTS linkedin VARCHAR(255)",
      "ALTER TABLE public.produtores ADD COLUMN IF NOT EXISTS cep VARCHAR(20)",
      "ALTER TABLE public.produtores ADD COLUMN IF NOT EXISTS rua VARCHAR(255)",
      "ALTER TABLE public.produtores ADD COLUMN IF NOT EXISTS numero VARCHAR(50)",
      "ALTER TABLE public.produtores ADD COLUMN IF NOT EXISTS bairro VARCHAR(255)",
      "ALTER TABLE public.produtores ADD COLUMN IF NOT EXISTS cidade VARCHAR(255)",
      "ALTER TABLE public.produtores ADD COLUMN IF NOT EXISTS estado VARCHAR(255)",

      // USUARIOS
      "ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS telefone VARCHAR(255)",
      "ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS bio TEXT",
      "ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS instagram VARCHAR(255)",
      "ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS linkedin VARCHAR(255)",
      "ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS foto TEXT",

      // EVENTOS
      "ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS descricao TEXT",
      "ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS preco DECIMAL(10,2) DEFAULT 0",
      "ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS imagem_capa TEXT",
      "ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS categoria VARCHAR(100)",
      "ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS data_inicio DATE",
      "ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS hora_inicio TIME",
      "ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS usuario_nome VARCHAR(255)", // Para lógica de Host

      // COMPRAS
      "ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS valor_total DECIMAL(10,2)",
      "ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS stripe_session_id VARCHAR(255)",

      // MENSAGENS V2 - Garantindo colunas do novo chat
      "ALTER TABLE public.mensagens_v2 ADD COLUMN IF NOT EXISTS evento_id INTEGER",
      "ALTER TABLE public.mensagens_v2 ADD COLUMN IF NOT EXISTS usuario_foto TEXT",
      "ALTER TABLE public.mensagens_v2 ADD COLUMN IF NOT EXISTS texto TEXT",
      "ALTER TABLE public.mensagens_v2 ADD COLUMN IF NOT EXISTS imagem TEXT",
      "ALTER TABLE public.mensagens_v2 ADD COLUMN IF NOT EXISTS tipo VARCHAR(50) DEFAULT 'chat'",
      "ALTER TABLE public.mensagens_v2 ADD COLUMN IF NOT EXISTS status VARCHAR(10) DEFAULT '✨'",
      "ALTER TABLE public.mensagens_v2 ADD COLUMN IF NOT EXISTS is_host BOOLEAN DEFAULT false",
      "ALTER TABLE public.mensagens_v2 ADD COLUMN IF NOT EXISTS criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP",

      // PRESENCA - Garantindo colunas do novo online
      "ALTER TABLE public.presenca ADD COLUMN IF NOT EXISTS usuario_foto TEXT",
      "ALTER TABLE public.presenca ADD COLUMN IF NOT EXISTS status VARCHAR(10) DEFAULT '✨'"
    ];

    for(const sql of colunas){
      try{
        await db.query(sql);
      }
      catch(err){
        if(!err.message.includes('already exists')){
          console.error('⚠️ erro coluna:',err.message);
        }
      }
    }

    console.log('✅ Banco sincronizado!');
  }
  catch(err){
    console.error('❌ ERRO BANCO:',err.message);
  }
};

// ========================================
// ROTAS
// ========================================
app.use('/api/auth', authRoutes);
app.use('/api/eventos', eventoRoutes);
app.use('/api/pagamento', pagamentoRoutes);
app.use('/api/compras', compraRoutes);
app.use('/api/comunidades', comunidadeRoutes);

// ========================================
// HEALTH CHECK
// ========================================
app.get('/ping',(req,res)=>{
  res.status(200).json({
    status:'Linkah API Online',
    timestamp:new Date()
  });
});

// ========================================
// ERRO GLOBAL
// ========================================
app.use((err,req,res,next)=>{
  if(err){
    console.error('❌ ERRO GLOBAL:',err.message);
    if(err.message.includes('CORS')){
      return res.status(403).json({error:err.message});
    }
    return res.status(500).json({
      error:'Erro interno',
      details:err.message
    });
  }
  next();
});

// ========================================
// START SERVER
// ========================================
const PORT = process.env.PORT || 3001;
app.listen(PORT,'0.0.0.0',async ()=>{
  console.log(`🚀 Linkah API rodando na porta ${PORT}`);
  await inicializarBanco();
});