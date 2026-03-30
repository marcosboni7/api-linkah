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

// --- 2. MIDDLEWARES DE SEGURANÇA E CORS ---
app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(helmet({ 
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false
}));

// --- 3. ROTA DE WEBHOOK (STRIPE) ---
app.post(
  ['/api/pagamento/webhook', '/api/pagamentos/webhook'],
  express.raw({ type: 'application/json' }),
  (req, res) => {
    const webhookHandler = pagamentoController.ouvirStripe || pagamentoController.webhookStripe;
    if (typeof webhookHandler === 'function') {
      return webhookHandler(req, res);
    } else {
      console.error('❌ CRÍTICO: Função de Webhook não encontrada!');
      return res.status(500).send('Webhook handler not configured');
    }
  }
);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- 4. INICIALIZAÇÃO DO BANCO (MIGRAÇÕES) ---
const inicializarBanco = async () => {
  try {
    console.log('--- 🔄 Verificando Banco de Dados ---');
    await db.query('SELECT NOW()');
    
    // Tabelas Base
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
    `);

    // --- 🚀 CORREÇÃO CRÍTICA: ADICIONANDO COLUNAS QUE FALTAVAM ---
    const colunas = [
      // Colunas de Produtores (Onde estava dando erro no seu log)
      "ALTER TABLE public.produtores ADD COLUMN IF NOT EXISTS telefone VARCHAR(255)",
      "ALTER TABLE public.produtores ADD COLUMN IF NOT EXISTS cpf_cnpj VARCHAR(255)",
      "ALTER TABLE public.produtores ADD COLUMN IF NOT EXISTS stripe_account_id VARCHAR(255)",
      "ALTER TABLE public.produtores ADD COLUMN IF NOT EXISTS cep VARCHAR(20)",
      "ALTER TABLE public.produtores ADD COLUMN IF NOT EXISTS rua VARCHAR(255)",
      "ALTER TABLE public.produtores ADD COLUMN IF NOT EXISTS numero VARCHAR(50)",
      "ALTER TABLE public.produtores ADD COLUMN IF NOT EXISTS bairro VARCHAR(255)",
      
      // Colunas de Usuários
      "ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS telefone VARCHAR(255)",
      "ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS stripe_account_id VARCHAR(255)",

      // Colunas de Eventos
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

      // Colunas de Compras
      "ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS valor_total DECIMAL(10,2)",
      "ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS stripe_session_id VARCHAR(255)"
    ];

    for (const sql of colunas) {
      await db.query(sql).catch(err => {
        // Silencioso se a coluna já existir, loga se for outro erro
        if (!err.message.includes('already exists')) {
            console.log('⚠️ Aviso na migração:', err.message);
        }
      });
    }

    console.log('✅ Banco de dados sincronizado e colunas atualizadas!');
  } catch (err) {
    console.error('❌ ERRO NA SINCRONIZAÇÃO:', err.message);
  }
};

// --- 5. MONITORAMENTO ---
app.use((req, res, next) => {
  console.log(`📡 [${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

// --- 6. REGISTRO DAS ROTAS ---
app.use('/api/auth', authRoutes);
app.use('/api/eventos', eventoRoutes);
app.use('/api/pagamento', pagamentoRoutes);
app.use('/api/compras', compraRoutes);
app.use('/api/comunidades', comunidadeRoutes); 

// Painel Staff
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

app.get('/ping', (req, res) => res.status(200).json({ status: 'Linkah API Online', timestamp: new Date() }));

// --- 7. START ---
const PORT = process.env.PORT || 3001;

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Linkah API voando na porta: ${PORT}`);
  await inicializarBanco();
});