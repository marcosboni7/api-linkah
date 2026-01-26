require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const fs = require('fs');
const path = require('path');
const authRoutes = require('./routes/authRoutes');
const eventoRoutes = require('./routes/eventoRoutes'); 
const db = require('./config/database'); 

const app = express();

// --- SCRIPT DE INICIALIZAÇÃO DO BANCO (BACKUP) ---
const inicializarBanco = async () => {
  try {
    // AJUSTE AQUI: '../' sobe uma pasta para achar o arquivo na raiz do projeto
    const sqlPath = path.join(__dirname, '../backup_linkah.sql');
    
    console.log(`🔍 Procurando arquivo em: ${sqlPath}`);

    if (fs.existsSync(sqlPath)) {
      console.log('⏳ Executando backup_linkah.sql no banco...');
      const sql = fs.readFileSync(sqlPath, 'utf8');
      
      // Executa o conteúdo do seu SQL
      await db.query(sql); 
      
      console.log('🚀 Tabelas e dados do backup carregados com sucesso!');
    } else {
      console.log('⚠️ Arquivo backup_linkah.sql não encontrado na raiz. Pulando inicialização.');
    }
  } catch (err) {
    // Tratamento para evitar que o erro de "tabela já existe" pare o servidor
    if (err.message.includes('already exists')) {
      console.log('ℹ️ As tabelas já existem no banco. Tudo pronto!');
    } else {
      console.error('❌ Erro ao rodar backup SQL:', err.message);
    }
  }
};

// --- CONFIGURAÇÃO DO CORS ---
app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(helmet({
  contentSecurityPolicy: false, // Facilita testes iniciais com imagens externas
}));

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