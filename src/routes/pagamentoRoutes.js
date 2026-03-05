const express = require('express');
const router = express.Router();
const pagamentoController = require('../controllers/pagamentoController');

// --- 1. CONFIGURAÇÃO DO PRODUTOR (STRIPE CONNECT) ---
// Inicia o processo de criação de conta Express
router.post('/conectar-stripe', pagamentoController.vincularContaStripe);

// Verifica se o produtor já completou o onboarding e está ativo
router.get('/status-stripe', pagamentoController.verificarStatusStripe);

// --- 2. CHECKOUT E COMPRA ---
// Inicia sessão de pagamento (Cartão + Pix liberados agora)
router.post('/checkout', pagamentoController.criarSessaoCheckout);

// --- 3. WEBHOOK ---
// O Stripe avisa o seu servidor aqui sobre pagamentos e atualizações de conta
// IMPORTANTE: No server.js, esta rota deve usar express.raw()
router.post('/webhook', pagamentoController.webhookStripe);

// --- 4. CONSULTAS ---
// Detalhes da compra para a página de sucesso (pós-checkout)
router.get('/detalhes/:sessionId', pagamentoController.buscarDetalhesCompra);

// Lista ingressos comprados pelo usuário (modal Navbar/Perfil)
router.get('/meus-ingressos', pagamentoController.listarMeusIngressos);

module.exports = router;