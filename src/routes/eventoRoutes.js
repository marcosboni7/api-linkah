const express = require('express');
const router = express.Router();
const eventoController = require('../controllers/eventoController');
const OnlineController = require('../controllers/OnlineController');
const upload = require('../config/multer'); 

// --- 1. ROTAS PÚBLICAS ---
router.get('/', eventoController.listarTodosEventosParaVitrine);
router.get('/vitrine', eventoController.listarTodosEventosParaVitrine);

// --- 2. ROTAS DE CRIAÇÃO ---
// GARANTIR que OnlineController também use 'imagem_capa' no req.file
router.post('/novo-online', upload.single('imagem_capa'), OnlineController.criarEventoOnline);
router.post('/novo-presencial', upload.single('imagem_capa'), eventoController.criarEventoPresencial);

// --- 3. DASHBOARD & BUSCA ---
router.get('/listar', eventoController.listarEventosPorProdutor);
router.get('/:id', eventoController.buscarEventoPorId);

// --- 4. ROTA DE ATUALIZAÇÃO ---
// Aqui é onde o multer extrai o arquivo. Sem isso, req.file vira undefined.
router.put('/:id', upload.single('imagem_capa'), eventoController.atualizarEvento);

// --- 5. GESTÃO DE EVENTO ---
router.delete('/:id', eventoController.excluirEvento);
router.put('/:id/status', eventoController.atualizarStatus);

// --- 6. INGRESSOS ---
router.post('/:id/ingressos', eventoController.salvarIngressos);

module.exports = router;