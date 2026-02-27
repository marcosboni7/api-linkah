const express = require('express');
const router = express.Router();
const pagamentoController = require('../controllers/pagamentoController');

// --- 1. CONFIGURAÇÃO DO PRODUTOR (STRIPE CONNECT) ---
// Rota para o produtor vincular a conta bancária
// Chamada no front: /api/pagamento/conectar-stripe
router.post('/conectar-stripe', pagamentoController.vincularContaStripe);

// --- 2. CHECKOUT E COMPRA ---
// Inicia sessão de pagamento (Cartão + Pix)
router.post('/checkout', pagamentoController.criarSessaoCheckout);

// --- 3. WEBHOOK ---
// O Stripe avisa o seu servidor aqui quando o pagamento é aprovado
// OBS: No server.js já tratamos o express.raw, aqui basta passar o controller
router.post('/webhook', pagamentoController.webhookStripe);

// --- 4. CONSULTAS ---
// Detalhes para a página de sucesso
router.get('/detalhes/:sessionId', pagamentoController.buscarDetalhesCompra);

// Lista ingressos no modal da Navbar
router.get('/meus-ingressos', pagamentoController.listarMeusIngressos);

module.exports = router;