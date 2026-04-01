const express = require('express');
const router = express.Router();
const eventoController = require('../controllers/eventoController');
const OnlineController = require('../controllers/OnlineController');

// ✅ CORREÇÃO AQUI: Desestruturando para pegar o middleware específico de eventos
const { uploadEvento } = require('../config/multer');

// --- 1. ROTAS PÚBLICAS ---
router.get('/', eventoController.listarTodosEventosParaVitrine);
router.get('/vitrine', eventoController.listarTodosEventosParaVitrine);

// --- 2. ROTAS DE CRIAÇÃO ---
// Substituído 'upload' por 'uploadEvento' que é a instância correta do Multer
router.post('/novo-online', uploadEvento.single('imagem_capa'), OnlineController.criarEventoOnline);
router.post('/novo-presencial', uploadEvento.single('imagem_capa'), eventoController.criarEventoPresencial);

// --- 3. DASHBOARD & BUSCA ---
router.get('/listar', eventoController.listarEventosPorProdutor);
router.get('/:id', eventoController.buscarEventoPorId);

// --- 4. ROTA DE ATUALIZAÇÃO ---
router.put('/:id', uploadEvento.single('imagem_capa'), eventoController.atualizarEvento);

// --- 5. GESTÃO DE EVENTO ---
router.delete('/:id', eventoController.excluirEvento);
router.put('/:id/status', eventoController.atualizarStatus);

// --- 6. INGRESSOS ---
router.post('/:id/ingressos', eventoController.salvarIngressos);

module.exports = router;