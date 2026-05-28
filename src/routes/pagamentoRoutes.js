const express = require('express');
const router = express.Router();

const pagamentoController = require('../controllers/pagamentoController');

// ======================================================
// 1. CONFIGURAÇÃO STRIPE CONNECT
// ======================================================

// Conectar conta Stripe Express
router.post(
  '/conectar-stripe',
  pagamentoController.vincularContaStripe
);

// Verificar status da conta Stripe
router.get(
  '/status-stripe',
  pagamentoController.verificarStatusStripe
);

// ======================================================
// 2. CHECKOUT / PAGAMENTO
// ======================================================

// Criar sessão Stripe Checkout
router.post(
  '/checkout',
  pagamentoController.criarSessaoCheckout
);

// ======================================================
// 3. WEBHOOK STRIPE
// ======================================================

// IMPORTANTE:
// No server.js essa rota precisa usar express.raw()
router.post(
  '/webhook',
  pagamentoController.webhookStripe
);

// ======================================================
// 4. CONSULTAS DE COMPRA
// ======================================================

// Buscar detalhes da compra
router.get(
  '/detalhes/:sessionId',
  pagamentoController.buscarDetalhesCompra
);

// Listar ingressos do usuário
router.get(
  '/meus-ingressos',
  pagamentoController.listarMeusIngressos
);

// ======================================================
// 5. PARTICIPANTES DO EVENTO
// ======================================================

// LISTAR PARTICIPANTES / CRACHÁS
router.get(
  '/compras-evento/:idEvento',
  pagamentoController.buscarComprasPorEvento
);

module.exports = router;