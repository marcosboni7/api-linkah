require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const authRoutes = require('./routes/authRoutes');
const eventoRoutes = require('./routes/eventoRoutes'); 
const db = require('./config/database'); 

const app = express();

// --- CRIAÇÃO DAS TABELAS SEM DEPENDER DE ARQUIVO EXTERNO ---
const inicializarBanco = async () => {
  try {
    console.log('⏳ Verificando estrutura do banco no Render...');
    
    // Tabela de Produtores
    await db.query(`
      CREATE TABLE IF NOT EXISTS produtores (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        senha VARCHAR(255) NOT NULL,
        foto_perfil TEXT,
        data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Tabela de Eventos (ajustada para o que vi no seu dump)
    await db.query(`
      CREATE TABLE IF NOT EXISTS eventos (
        id SERIAL PRIMARY KEY,
        produtor_email VARCHAR(255) REFERENCES produtores(email) ON DELETE CASCADE,
        nome VARCHAR(255) NOT NULL,
        categoria VARCHAR(100),
        status VARCHAR(50) DEFAULT 'Ativo',
        descricao TEXT,
        thumbnail_url TEXT,
        data_inicio DATE,
        hora_inicio TIME,
        local_nome VARCHAR(255),
        endereco VARCHAR(255),
        data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✅ Banco de dados pronto para uso!');
  } catch (err) {
    console.error('⚠️ Erro na inicialização:', err.message);
  }
};

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }));
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/eventos', eventoRoutes);

app.get('/ping', (req, res) => res.send('pong'));

const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
  console.log(`🚀 Linkah rodando na porta: ${PORT}`);
  await inicializarBanco();
});