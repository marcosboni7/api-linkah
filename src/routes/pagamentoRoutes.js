const express = require('express');
const router = express.Router();
const pagamentoController = require('../controllers/pagamentoController');

// 1. Rota para criar a sessão do Stripe
router.post('/checkout', pagamentoController.criarSessaoCheckout);

// 2. Rota para o Webhook
router.post('/webhook', express.raw({ type: 'application/json' }), pagamentoController.webhookStripe);

// 3. Rota para detalhes da compra (Página de Sucesso)
router.get('/detalhes/:sessionId', pagamentoController.buscarDetalhesCompra);

// --- 4. NOVA ROTA: LISTAR INGRESSOS DO USUÁRIO ---
// É esta linha que faz o modal da Navbar funcionar!
router.get('/meus-ingressos', pagamentoController.listarMeusIngressos);

module.exports = router;