const express = require('express');
const router = express.Router();
const eventoController = require('../controllers/eventoController');
const OnlineController = require('../controllers/OnlineController');

// --- ROTA PÚBLICA (PARA O SITE/VITRINE) ---
// Esta é a rota que seu app/page.tsx vai chamar
router.get('/vitrine', eventoController.listarTodosEventosParaVitrine);

// --- EVENTOS ONLINE ---
router.post('/novo-online', OnlineController.criarEventoOnline);

// --- EVENTOS PRESENCIAIS ---
router.post('/novo-presencial', eventoController.criarEventoPresencial);

// --- GERENCIAMENTO GERAL (Dashboard) ---
router.get('/listar', eventoController.listarEventosPorProdutor);
router.get('/:id', eventoController.buscarEventoPorId);
router.put('/:id', eventoController.atualizarEvento);
router.delete('/:id', eventoController.excluirEvento);
router.put('/:id/status', eventoController.atualizarStatus);

// --- INGRESSOS ---
router.post('/:id/ingressos', eventoController.salvarIngressos);

module.exports = router;