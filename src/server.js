require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const authRoutes = require('./routes/authRoutes');
const eventoRoutes = require('./routes/eventoRoutes'); 
const db = require('./config/database');

const app = express();

app.use(helmet());
app.use(cors());

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
  console.log(`🚀 Linkah rodando em http://localhost:${PORT}`);
  console.log(`--- Banco: ${process.env.DB_HOST} ---`);
});