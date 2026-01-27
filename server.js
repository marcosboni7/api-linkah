require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

// CAMINHOS: Apontando para dentro da pasta 'src'
const authRoutes = require('./src/routes/authRoutes');
const eventoRoutes = require('./src/routes/eventoRoutes'); 
const db = require('./src/config/database'); 

const app = express();

// --- 1. MIDDLEWARES (ORDEM IMPORTANTE) ---

// CORS: Permite que o Front-end fale com o Back-end sem ser bloqueado
app.use(cors()); 

// HELMET: Segurança básica para os headers
app.use(helmet({ contentSecurityPolicy: false }));

// PARSERS: Necessário para o servidor conseguir ler os dados (JSON) que você envia no formulário
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
    `);

    console.log('✅ Estrutura do banco de dados verificada/criada!');
  } catch (err) {
    console.error('❌ ERRO NA INICIALIZAÇÃO DO BANCO:', err.message);
  }
};

// --- 3. LOG DE MONITORAMENTO (DEBUG) ---
app.use((req, res, next) => {
  if (req.method === 'POST' || req.method === 'PUT') {
    console.log(`📥 [${req.method}] Rota: ${req.url}`);
    console.log(`📦 Dados Recebidos:`, JSON.stringify(req.body));
  }
  next();
});

// --- 4. ROTAS ---
app.use('/api/auth', authRoutes);
app.use('/api/eventos', eventoRoutes);

// Rota de teste
app.get('/ping', (req, res) => res.status(200).send('Linkah API Online 🚀'));

// --- 5. INICIALIZAÇÃO DO SERVIDOR ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
  console.log(`🚀 Servidor rodando na porta: ${PORT}`);
  await inicializarBanco();
});