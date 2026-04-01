const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// --- 🔐 AUTENTICAÇÃO ---

// Rota de Cadastro Inicial 
// Chama a função 'registerProdutor' no authController.js
router.post('/register', authController.registerProdutor);

// Rota de Login 
// Chama a função 'login' no authController.js
router.post('/login', authController.login);


// --- 👤 GERENCIAMENTO DE PERFIL ---

// Buscar os dados do produtor (GET) 
// Chama a função 'getPerfil' no authController.js
router.get('/perfil', authController.getPerfil); 

// Atualizar os dados do produtor (PUT) 
// Chama a função 'updatePerfil' no authController.js
router.put('/perfil', authController.updatePerfil); 

// Rota para o Modal do Chat (Público)
// Busca apenas Nome, Bio e Redes Sociais pelo nome do usuário
router.get('/perfil-publico', authController.getPerfilPublico);


// --- 🛠️ MANUTENÇÃO (Opcional) ---

// Caso precise testar se a rota de autenticação está viva
router.get('/status', (req, res) => {
    res.status(200).json({ message: "API de Autenticação Online" });
});

module.exports = router;