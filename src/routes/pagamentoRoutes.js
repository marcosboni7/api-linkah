const express = require('express');
const router = express.Router();
const pagamentoController = require('../controllers/pagamentoController');

// 1. Rota para criar a sessão do Stripe (Chamada quando clica em comprar)
router.post('/checkout', pagamentoController.criarSessaoCheckout);

// 2. Rota para o Webhook (Chamada pelo Stripe após o pagamento aprovado)
// IMPORTANTE: Essa rota deve ser configurada no painel do Stripe com o final /api/pagamentos/webhook
router.post('/webhook', express.raw({ type: 'application/json' }), pagamentoController.webhookStripe);

// 3. NOVA ROTA: Buscar detalhes do ingresso (Chamada pela página de Sucesso no Next.js)
// É esta rota que faz aparecer o nome do evento e a quantidade na tela do usuário
router.get('/detalhes/:sessionId', pagamentoController.buscarDetalhesCompra);

module.exports = router;