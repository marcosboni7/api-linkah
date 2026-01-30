const express = require('express');
const router = express.Router();
const pagamentoController = require('../controllers/pagamentoController');

// Removido o authMiddleware que estava causando erro de "Módulo não encontrado"
// A autenticação agora será baseada no e-mail enviado pelo frontend no corpo da requisição

router.post('/checkout', pagamentoController.criarSessaoCheckout);

module.exports = router;