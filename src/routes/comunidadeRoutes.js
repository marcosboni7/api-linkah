const express = require('express');
const router = express.Router();
const comunidadeController = require('../controllers/comunidadeController');

// --- ROTA DA HOME ---
router.get('/', comunidadeController.getComunidadesVitrine);

// --- ROTA DE PRESENÇA ---
router.get('/presenca/:id', comunidadeController.atualizarPresenca);

// --- ENVIAR MENSAGEM ---
router.post('/enviar', comunidadeController.enviarMensagem);

// --- LISTAR MENSAGENS ---
router.get('/:evento_id', comunidadeController.listarMensagensPorEvento);

module.exports = router;