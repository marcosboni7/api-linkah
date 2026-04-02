const express = require('express');
const router = express.Router();
const eventoController = require('../controllers/eventoController');
const OnlineController = require('../controllers/OnlineController');

// ✅ Middleware de configuração do Multer
const { uploadEvento } = require('../config/multer');

/**
 * DEFINIÇÃO DOS CAMPOS DE UPLOAD
 * Agora aceitamos tanto a 'imagem_capa' quanto o 'banner_patrocinio'
 */
const uploadCamposEvento = uploadEvento.fields([
  { name: 'imagem_capa', maxCount: 1 },
  { name: 'banner_patrocinio', maxCount: 1 }
]);

// --- 1. ROTAS PÚBLICAS ---
router.get('/', eventoController.listarTodosEventosParaVitrine);
router.get('/vitrine', eventoController.listarTodosEventosParaVitrine);

// --- 2. ROTAS DE CRIAÇÃO ---
// Mudamos de .single() para .fields() usando a constante definida acima
router.post('/novo-online', uploadCamposEvento, OnlineController.criarEventoOnline);
router.post('/novo-presencial', uploadCamposEvento, eventoController.criarEventoPresencial);

// --- 3. DASHBOARD & BUSCA ---
router.get('/listar', eventoController.listarEventosPorProdutor);
router.get('/:id', eventoController.buscarEventoPorId);

// --- 4. ROTA DE ATUALIZAÇÃO ---
// Também atualizado para permitir trocar o banner na edição
router.put('/:id', uploadCamposEvento, eventoController.atualizarEvento);

// --- 5. GESTÃO DE EVENTO ---
router.delete('/:id', eventoController.excluirEvento);
router.put('/:id/status', eventoController.atualizarStatus);

// --- 6. INGRESSOS ---
router.post('/:id/ingressos', eventoController.salvarIngressos);

module.exports = router;