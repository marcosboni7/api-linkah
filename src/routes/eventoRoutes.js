const express = require('express');
const router = express.Router();
const eventoController = require('../controllers/eventoController');
const OnlineController = require('../controllers/OnlineController');

// --- ROTA RAIZ (Acessada via /api/eventos) ---
// Adicionamos esta linha para o fetch do frontend funcionar direto
router.get('/', eventoController.listarTodosEventosParaVitrine);

// Vitrine (Público) - Mantida para compatibilidade
router.get('/vitrine', eventoController.listarTodosEventosParaVitrine);

// --- 2. ROTAS DE CRIAÇÃO (SEM MULTER) ---
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