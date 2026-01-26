require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const authRoutes = require('./routes/authRoutes');
const eventoRoutes = require('./routes/eventoRoutes'); 
const db = require('./config/database'); 

const app = express();

// --- FUNÇÃO PARA CRIAR ESTRUTURA COMPLETA DO BANCO ---
const inicializarBanco = async () => {
  try {
    console.log('⏳ Sincronizando tabelas com o código JavaScript...');

    // 1. TABELA DE PRODUTORES (Campos exatos do authController.js)
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
    `);

    // 2. TABELA DE EVENTOS (Campos para Presencial, Online e Dashboard)
    await db.query(`
      CREATE TABLE IF NOT EXISTS public.eventos (
        id SERIAL PRIMARY KEY,
        produtor_email VARCHAR(255) REFERENCES public.produtores(email) ON DELETE CASCADE,
        nome VARCHAR(255) NOT NULL,
        categoria VARCHAR(100) DEFAULT 'Geral',
        status VARCHAR(50) DEFAULT 'Ativo',
        tipo VARCHAR(50), -- 'Presencial' ou 'Online'
        descricao TEXT,
        link_transmissao TEXT, -- Usado pelo OnlineController
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
    `);

    console.log('✅ Estrutura completa (Produtores e Eventos) pronta para uso!');
  } catch (err) {
    console.error('❌ ERRO NA CRIAÇÃO DAS TABELAS:', err.message);
  }
};

// --- MIDDLEWARES ---
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }));
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// --- ROTAS ---
app.use('/api/auth', authRoutes);
app.use('/api/eventos', eventoRoutes);

// Rota de teste para ver se o backend está vivo
app.get('/ping', (req, res) => res.send('pong'));

// --- INICIALIZAÇÃO DO SERVIDOR ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
  console.log(`🚀 Back-end Linkah rodando na porta: ${PORT}`);
  // Roda a verificação de tabelas sempre que o servidor ligar
  await inicializarBanco();
});