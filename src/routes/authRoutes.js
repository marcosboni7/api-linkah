const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// --- AUTENTICAÇÃO ---

// Rota de Cadastro Inicial 
// (Gera a senha, salva no banco e dispara o e-mail de boas-vindas)
router.post('/register', authController.registerProdutor);

// Rota de Login 
// (Valida e-mail/senha e retorna o Token/Session e os dados do usuário)
router.post('/login', authController.login);


// --- GERENCIAMENTO DE PERFIL ---

// Buscar os dados do produtor (GET) 
// Usada no `useEffect` da página de Perfil para preencher os inputs
router.get('/perfil', authController.getPerfil); 

// Atualizar os dados do produtor (PUT) 
// Usada no botão "Salvar Alterações" do Perfil ou Dashboard
router.put('/perfil', authController.updatePerfil); 


// --- SEGURANÇA (Opcional, mas recomendado) ---

// Se você decidir usar recuperação de senha futuramente
// router.post('/forgot-password', authController.forgotPassword);

module.exports = router;