const express = require('express');
const router = express.Router();
const pagamentoController = require('../controllers/pagamentoController');
// Se você tiver um middleware de auth, coloque aqui
const authMiddleware = require('../middlewares/authMiddleware'); 

router.post('/checkout', pagamentoController.criarSessaoCheckout);

module.exports = router;