require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const fs = require('fs');
const path = require('path');
const authRoutes = require('./routes/authRoutes');
const eventoRoutes = require('./routes/eventoRoutes'); 
const db = require('./config/database'); // Aqui é o seu Pool do pg

const app = express();

// --- SCRIPT DE INICIALIZAÇÃO DO BANCO (BACKUP) ---
const inicializarBanco = async () => {
  try {
    const sqlPath = path.join(__dirname, 'backup_linkah.sql');
    
    // Verifica se o arquivo existe antes de tentar ler
    if (fs.existsSync(sqlPath)) {
      console.log('⏳ Executando backup_linkah.sql no banco...');
      const sql = fs.readFileSync(sqlPath, 'utf8');
      await db.query(sql); // Executa o conteúdo do seu SQL
      console.log('🚀 Tabelas e dados do backup carregados com sucesso!');
    } else {
      console.log('⚠️ Arquivo backup_linkah.sql não encontrado. Pulando inicialização.');
    }
  } catch (err) {
    console.error('❌ Erro ao rodar backup SQL:', err.message);
  }
};

// --- CONFIGURAÇÃO DO CORS ---
app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(helmet());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Rotas
app.use('/api/auth', authRoutes);
app.use('/api/eventos', eventoRoutes);

// Teste de conexão
app.get('/ping', (req, res) => res.send('pong'));

const PORT = process.env.PORT || 3001;

app.listen(PORT, async () => {
  console.log(`🚀 Linkah rodando na porta: ${PORT}`);
  
  // Roda o script assim que o servidor subir
  await inicializarBanco();
});