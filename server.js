require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

// CAMINHOS
const authRoutes = require('./src/routes/authRoutes');
const eventoRoutes = require('./src/routes/eventoRoutes'); 
const compraRoutes = require('./src/routes/compraRoutes'); // Importação adicionada aqui
const db = require('./src/config/database'); 

const app = express();

// --- 1. MIDDLEWARES ---
const allowedOrigins = [
  'https://linkah-frontend-ivory.vercel.app',
  'https://linkah.com.br',
  'https://www.linkah.com.br',
  'http://localhost:3000'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      return callback(new Error('CORS não permitido'), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}));

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ limit: '15mb', extended: true }));

// --- 2. FUNÇÃO DE INICIALIZAÇÃO DO BANCO ---
const inicializarBanco = async () => {
  try {
    console.log('⏳ Sincronizando tabelas com o banco de dados...');

    await db.query(`
      CREATE TABLE IF NOT EXISTS public.produtores (
        email VARCHAR(255) PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        senha VARCHAR(255) NOT NULL,
        cpf_cnpj VARCHAR(20),
        tipo VARCHAR(50),
        telefone VARCHAR(20),
        data_nascimento DATE,
        cep VARCHAR(20),
        rua VARCHAR(255),
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
        complement spacing VARCHAR(255),
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

      -- NOVA TABELA DE COMPRAS ADICIONADA AQUI
      CREATE TABLE IF NOT EXISTS public.compras (
        id SERIAL PRIMARY KEY,
        usuario_email VARCHAR(255) NOT NULL,
        evento_id INTEGER REFERENCES public.eventos(id) ON DELETE SET NULL,
        evento_nome VARCHAR(255),
        data_evento DATE,
        quantidade INTEGER NOT NULL,
        valor_total DECIMAL(10,2),
        status VARCHAR(50) DEFAULT 'Aprovado',
        criado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✅ Estrutura do banco de dados verificada!');
  } catch (err) {
    console.error('❌ ERRO NA INICIALIZAÇÃO:', err.message);
  }
};

// --- 3. MONITORAMENTO ---
app.use((req, res, next) => {
  if (['POST', 'PUT'].includes(req.method)) {
    const bodyLog = { ...req.body };
    if (bodyLog.foto_perfil) bodyLog.foto_perfil = "BASE64_OMITIDA";
    if (bodyLog.imagem_capa) bodyLog.imagem_capa = "BASE64_OMITIDA";
    console.log(`📥 [${req.method}] ${req.url}:`, JSON.stringify(bodyLog));
  }
  next();
});

// --- 4. ROTAS ---
app.use('/api/auth', authRoutes);
app.use('/api/eventos', eventoRoutes);
app.use('/api/compras', compraRoutes); // Ativando a rota de compras

app.get('/ping', (req, res) => res.status(200).send('Linkah API Online 🚀'));

// --- 5. START ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
  console.log(`🚀 Servidor rodando na porta: ${PORT}`);
  await inicializarBanco();
});