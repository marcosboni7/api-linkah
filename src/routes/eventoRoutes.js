const express = require('express');
const router = express.Router();
const eventoController = require('../controllers/eventoController');
const OnlineController = require('../controllers/OnlineController');

const { uploadEvento } = require('../config/multer');

const uploadCamposEvento = uploadEvento.fields([
  { name: 'imagem_capa', maxCount: 1 },
  { name: 'banner_patrocinio', maxCount: 1 }
]);

// --- 1. ROTAS PÚBLICAS ---
router.get('/', eventoController.listarTodosEventosParaVitrine);
router.get('/vitrine', eventoController.listarTodosEventosParaVitrine);

// --- 2. IA & AUTOMAÇÃO ---
router.post('/gerar-ia', eventoController.gerarComIA);

// --- 3. ROTAS DE CRIAÇÃO ---
router.post('/novo-online', uploadCamposEvento, OnlineController.criarEventoOnline);
router.post('/novo-presencial', uploadCamposEvento, eventoController.criarEventoPresencial);

// --- 4. DASHBOARD & BUSCA ---
router.get('/listar', eventoController.listarEventosPorProdutor);
router.get('/:id', eventoController.buscarEventoPorId);

// --- 5. ROTA DE ATUALIZAÇÃO ---
router.put('/:id', uploadCamposEvento, eventoController.atualizarEvento);

// --- 6. GESTÃO DE EVENTO ---
router.delete('/:id', eventoController.excluirEvento);
router.patch('/:id/status', eventoController.atualizarStatus);

// --- 7. INGRESSOS ---
router.post('/:id/ingressos', eventoController.salvarIngressos);

module.exports = router;