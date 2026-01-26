require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const authRoutes = require('./routes/authRoutes');
const eventoRoutes = require('./routes/eventoRoutes'); 
const db = require('./config/database');

const app = express();

// --- CONFIGURAÇÃO DO CORS ---
// Durante o desenvolvimento, o '*' permite que qualquer site (como o Amplify) acesse sua API.
app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(helmet());

// ESSENCIAL: Aumentar o limite para receber a imagem em Base64
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Rotas
app.use('/api/auth', authRoutes);
app.use('/api/eventos', eventoRoutes);

// Teste de conexão
app.get('/ping', (req, res) => res.send('pong'));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Linkah rodando na porta: ${PORT}`);
  console.log(`--- Banco: ${process.env.DB_HOST} ---`);
});