require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

// --- 1. IMPORTAÇÃO DE ROTAS E CONFIGS ---
const authRoutes = require('./src/routes/authRoutes');
const eventoRoutes = require('./src/routes/eventoRoutes');
const compraRoutes = require('./src/routes/compraRoutes');
const pagamentoRoutes = require('./src/routes/pagamentoRoutes');
const comunidadeRoutes = require('./src/routes/comunidadeRoutes');

const pagamentoController = require('./src/controllers/pagamentoController');
const db = require('./src/config/database');

const app = express();

app.set('trust proxy', 1);

// --- 2. ORIGENS PERMITIDAS ---
const allowedOrigins = [
  'https://linkah.eu',
  'https://www.linkah.eu',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

// --- 3. CORS ---
const corsOptions = {
  origin: function (origin, callback) {
    // Permite curl, Postman, uptime checks e requests sem Origin
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.log('❌ CORS bloqueado para origin:', origin);
    return callback(new Error(`CORS bloqueado para origin: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// --- 4. HELMET ---
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
  })
);

// --- 5. WEBHOOK STRIPE ---
app.post(
  ['/api/pagamento/webhook', '/api/pagamentos/webhook'],
  express.raw({ type: 'application/json' }),
  (req, res) => {
    const webhookHandler =
      pagamentoController.ouvirStripe || pagamentoController.webhookStripe;

    if (typeof webhookHandler === 'function') {
      return webhookHandler(req, res);
    } else {
      console.error('❌ CRÍTICO: Função de Webhook não encontrada!');
      return res.status(500).send('Webhook handler not configured');
    }
  }
);

// --- 6. BODY PARSERS ---
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- 7. ARQUIVOS ESTÁTICOS ---
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- 8. MONITORAMENTO ---
app.use((req, res, next) => {
  console.log(
    `📡 [${new Date().toLocaleTimeString()}] ${req.method} ${req.url} | Origin: ${
      req.headers.origin || 'sem-origin'
    }`
  );
  next();
});

// --- 9. INICIALIZAÇÃO DO BANCO ---
const inicializarBanco = async () => {
  try {
    console.log('--- 🔄 Verificando Banco de Dados ---');
    await db.query('SELECT NOW()');

    // Tabelas base
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
        comunidade_id INTEGER,
        usuario_nome VARCHAR(255),
        conteudo TEXT,
        data_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Migrações de colunas
    const colunas = [
      // PRODUTORES
      "ALTER TABLE public.produtores ADD COLUMN IF NOT EXISTS telefone VARCHAR(255)",
      "ALTER TABLE public.produtores ADD COLUMN IF NOT EXISTS tipo VARCHAR(50)",
      "ALTER TABLE public.produtores ADD COLUMN IF NOT EXISTS data_nascimento DATE",
      "ALTER TABLE public.produtores ADD COLUMN IF NOT EXISTS cpf_cnpj VARCHAR(255)",
      "ALTER TABLE public.produtores ADD COLUMN IF NOT EXISTS rg VARCHAR(50)",
      "ALTER TABLE public.produtores ADD COLUMN IF NOT EXISTS genero VARCHAR(50)",
      "ALTER TABLE public.produtores ADD COLUMN IF NOT EXISTS stripe_account_id VARCHAR(255)",
      "ALTER TABLE public.produtores ADD COLUMN IF NOT EXISTS cep VARCHAR(20)",
      "ALTER TABLE public.produtores ADD COLUMN IF NOT EXISTS rua VARCHAR(255)",
      "ALTER TABLE public.produtores ADD COLUMN IF NOT EXISTS numero VARCHAR(50)",
      "ALTER TABLE public.produtores ADD COLUMN IF NOT EXISTS bairro VARCHAR(255)",
      "ALTER TABLE public.produtores ADD COLUMN IF NOT EXISTS cidade VARCHAR(255)",
      "ALTER TABLE public.produtores ADD COLUMN IF NOT EXISTS estado VARCHAR(255)",
      "ALTER TABLE public.produtores ADD COLUMN IF NOT EXISTS complemento VARCHAR(255)",

      // USUÁRIOS
      "ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS telefone VARCHAR(255)",
      "ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS data_nascimento DATE",
      "ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS tipo VARCHAR(50)",
      "ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS cpf_cnpj VARCHAR(255)",
      "ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS stripe_account_id VARCHAR(255)",

      // EVENTOS
      "ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS link_reuniao TEXT",
      "ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS tipo VARCHAR(50)",
      "ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS preco DECIMAL(10,2) DEFAULT 0",
      "ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS imagem_capa TEXT",
      "ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS categoria VARCHAR(100)",
      "ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS descricao TEXT",
      "ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS data_inicio DATE",
      "ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS hora_inicio TIME",
      "ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS local_nome VARCHAR(255)",
      "ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS cidade VARCHAR(100)",
      "ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS estado VARCHAR(100)",
      "ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS stripe_account_id VARCHAR(255)",

      // COMPRAS
      "ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS valor_total DECIMAL(10,2)",
      "ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS stripe_session_id VARCHAR(255)"
    ];

    for (const sql of colunas) {
      try {
        await db.query(sql);
      } catch (err) {
        if (!err.message.includes('already exists')) {
          console.error(`⚠️ Falha na coluna: ${sql} -> ${err.message}`);
        }
      }
    }

    console.log('✅ Banco de dados sincronizado e blindado!');
  } catch (err) {
    console.error('❌ ERRO NA SINCRONIZAÇÃO:', err.message);
  }
};

// --- 10. ROTAS ---
app.use('/api/auth', authRoutes);
app.use('/api/eventos', eventoRoutes);
app.use('/api/pagamento', pagamentoRoutes);
app.use('/api/compras', compraRoutes);
app.use('/api/comunidades', comunidadeRoutes);

// Painel staff
app.use('/api/usuarios', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT nome, email, role, status, data_criacao as created_at FROM public.produtores
      UNION ALL
      SELECT nome, email, role, status, created_at FROM public.usuarios
      ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/ping', (req, res) => {
  res.status(200).json({
    status: 'Linkah API Online',
    timestamp: new Date(),
  });
});

// --- 11. HANDLER DE ERRO CORS / GERAL ---
app.use((err, req, res, next) => {
  if (err) {
    console.error('❌ Erro global:', err.message);

    if (err.message && err.message.includes('CORS')) {
      return res.status(403).json({
        error: err.message,
      });
    }

    return res.status(500).json({
      error: 'Erro interno no servidor',
      details: err.message,
    });
  }

  next();
});

// --- 12. START ---
const PORT = process.env.PORT || 3001;

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Linkah API voando na porta: ${PORT}`);
  await inicializarBanco();
});