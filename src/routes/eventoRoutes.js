const express = require('express');
const router = express.Router();
const eventoController = require('../controllers/eventoController');
const OnlineController = require('../controllers/OnlineController');

// Vitrine (Público)
router.get('/vitrine', eventoController.listarTodosEventosParaVitrine);

// Criação
router.post('/novo-online', OnlineController.criarEventoOnline);
router.post('/novo-presencial', eventoController.criarEventoPresencial);

// Dashboard (Privado)
router.get('/listar', eventoController.listarEventosPorProdutor);
router.get('/:id', eventoController.buscarEventoPorId);
router.put('/:id', eventoController.atualizarEvento);
router.delete('/:id', eventoController.excluirEvento);
router.put('/:id/status', eventoController.atualizarStatus);

// Ingressos
router.post('/:id/ingressos', eventoController.salvarIngressos);

module.exports = router;