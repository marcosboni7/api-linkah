const express = require('express');
const router = express.Router();
const comunidadeController = require('../controllers/comunidadeController');

// --- ROTA DA HOME (A que estava faltando!) ---
// Quando o frontend der GET em /api/comunidades, ele cai aqui
router.get('/', comunidadeController.getComunidadesVitrine);

// --- ROTAS DO CHAT ---
router.get('/:evento_id', comunidadeController.listarMensagensPorEvento);
router.post('/enviar', comunidadeController.enviarMensagem);

// --- ROTA DE PRESENÇA ---
router.get('/:id/online', comunidadeController.atualizarPresenca);

module.exports = router;