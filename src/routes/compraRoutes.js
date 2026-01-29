const express = require('express');
const router = express.Router();
const compraController = require('../controllers/compraController');

// Rota para salvar a compra (chamada pelo botão "Comprar Ingressos")
router.post('/checkout', compraController.finalizarCompra);

// Rota que a Navbar chama para o modal
router.get('/meus-ingressos', compraController.listarMinhasCompras);

module.exports = router;