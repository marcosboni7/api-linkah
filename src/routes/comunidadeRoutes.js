const express = require('express');
const router = express.Router();
const comunidadeController = require('../controllers/comunidadeController');

router.get('/:evento_id', comunidadeController.listarMensagensPorEvento);
router.post('/enviar', comunidadeController.salvarMensagem);

module.exports = router;