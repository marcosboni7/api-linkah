const express = require('express');
const router = express.Router();
const comunidadeController = require('../controllers/comunidadeController');

// --- ROTA PARA O DASHBOARD ADMIN ---
// Esta deve vir antes das rotas com parâmetros (:id) para não dar conflito.
// O Dashboard vai chamar: fetch(`${API_URL_BASE}/api/comunidades/total`)
router.get('/total', comunidadeController.getTodasComunidades);

// --- ROTA DA HOME (VITRINE) ---
// Retorna apenas 3 com o bônus de marketing de +120 membros
router.get('/', comunidadeController.getComunidadesVitrine);

// --- ROTA DE PRESENÇA ---
router.get('/presenca/:id', comunidadeController.atualizarPresenca);

// --- ENVIAR MENSAGEM ---
router.post('/enviar', comunidadeController.enviarMensagem);

// --- LISTAR MENSAGENS ---
router.get('/:evento_id', comunidadeController.listarMensagensPorEvento);

module.exports = router;