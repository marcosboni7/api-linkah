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

// --- NOVO: Rota de Usuários para o Staff ---
const express = require('express');
const routerUsuarios = express.Router();

// CONTROLLERS
const pagamentoController = require('./src/controllers/pagamentoController');
const db = require('./src/config/database');

const app = express();

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

// --- 2. ROTA DE WEBHOOK ---
app.post(
  '/api/pagamentos/webhook',
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
    
    // Adicionei a tabela "usuarios" que estava faltando no seu script
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
        cpf_cnpj VARCHAR(20),
        tipo VARCHAR(50),
        telefone VARCHAR(20),
        data_nascimento DATE,
        cep VARCHAR(20),
        ruu VARCHAR(255),
        numero VARCHAR(20),
        bairro VARCHAR(100),
        estado VARCHAR(50),
        instagram VARCHAR(255),
        facebook VARCHAR(255),
        descricao TEXT,
        razao_social VARCHAR(255),
        foto_perfil TEXT,
        data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS public.eventos (
        id SERIAL PRIMARY KEY,
        produtor_email VARCHAR(255) REFERENCES public.produtores(email) ON DELETE CASCADE,
        nome VARCHAR(255) NOT NULL,
        categoria VARCHAR(100) DEFAULT 'Geral',
        status VARCHAR(50) DEFAULT 'Ativo',
        tipo VARCHAR(50), 
        descricao TEXT,
        link_transmissao TEXT, 
        data_inicio DATE,
        hora_inicio TIME,
        data_termino DATE,
        hora_termino TIME,
        local_nome VARCHAR(255),
        cep VARCHAR(20),
        endereco VARCHAR(255),
        numero VARCHAR(20),
        complemento VARCHAR(255),
        cidade VARCHAR(100),
        estado VARCHAR(50),
        imagem_capa TEXT,
        data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS public.ingressos (
        id SERIAL PRIMARY KEY,
        evento_id INTEGER REFERENCES public.eventos(id) ON DELETE CASCADE,
        nome VARCHAR(255) NOT NULL,
        preco DECIMAL(10,2) DEFAULT 0.00,
        quantidade INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS public.compras (
        id SERIAL PRIMARY KEY,
        usuario_email VARCHAR(255) NOT NULL,
        evento_id INTEGER REFERENCES public.eventos(id) ON DELETE SET NULL,
        evento_nome VARCHAR(255),
        data_evento DATE,
        quantidade INTEGER NOT NULL,
        valor_total DECIMAL(10,2),
        status VARCHAR(50) DEFAULT 'Pendente',
        stripe_session_id VARCHAR(255),
        criado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS public.mensagens_v2 (
        id SERIAL PRIMARY KEY,
        evento_id INTEGER REFERENCES public.eventos(id) ON DELETE CASCADE,
        usuario_nome VARCHAR(255) NOT NULL,
        texto TEXT NOT NULL,
        imagem TEXT,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP 
      );

      CREATE TABLE IF NOT EXISTS public.presenca (
        evento_id INTEGER REFERENCES public.eventos(id) ON DELETE CASCADE,
        usuario_nome VARCHAR(255) NOT NULL,
        ultima_vez TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (evento_id, usuario_nome)
      );
    `);

    console.log('✅ Estrutura do banco de dados verificada!');
    console.log('🐘 BANCO DE DADOS CONECTADO COM SUCESSO!');
  } catch (err) {
    console.error('❌ ERRO NA INICIALIZAÇÃO DO BANCO:', err.message);
  }
};

// --- 5. LOGICA DA ROTA DE USUÁRIOS (DIRETO NO SERVER PARA TESTE RÁPIDO) ---
routerUsuarios.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT id, nome, email, role, status, created_at FROM public.usuarios ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

routerUsuarios.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nome, role, status, password } = req.body;
  try {
    if (password) {
      await db.query(
        'UPDATE public.usuarios SET nome = $1, role = $2, status = $3, senha = $4 WHERE id = $5',
        [nome, role, status, password, id]
      );
    } else {
      await db.query(
        'UPDATE public.usuarios SET nome = $1, role = $2, status = $3 WHERE id = $4',
        [nome, role, status, id]
      );
    }
    res.json({ message: 'Atualizado com sucesso' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- 6. MONITORAMENTO ---
app.use((req, res, next) => {
  console.log(`📡 [${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// --- 7. REGISTRO DAS ROTAS ---
app.use('/api/auth', authRoutes);
app.use('/api/eventos', eventoRoutes);
app.use('/api/compras', compraRoutes);
app.use('/api/pagamentos', pagamentoRoutes);
app.use('/api/comunidades', comunidadeRoutes); 
app.use('/api/usuarios', routerUsuarios); // <-- AQUI ESTÁ A MÁGICA

app.get('/ping', (req, res) => res.status(200).json({ status: 'Linkah API Online', timestamp: new Date() }));

// --- 8. START ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Servidor rodando na porta: ${PORT}`);
  await inicializarBanco();
});