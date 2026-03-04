const express = require('express');
const router = express.Router();
const eventoController = require('../controllers/eventoController');
const OnlineController = require('../controllers/OnlineController');

// IMPORTANTE: Este require deve apontar exatamente para o arquivo que criamos em src/config/multer.js
const upload = require('../config/multer'); 

// --- 1. ROTAS PÚBLICAS ---
router.get('/', eventoController.listarTodosEventosParaVitrine);
router.get('/vitrine', eventoController.listarTodosEventosParaVitrine);

// --- 2. ROTAS DE CRIAÇÃO ---
// Adicionado upload.single para garantir que o req.body não chegue vazio no POST
router.post('/novo-online', upload.single('imagem'), OnlineController.criarEventoOnline);
router.post('/novo-presencial', upload.single('imagem'), eventoController.criarEventoPresencial);

// --- 3. DASHBOARD & BUSCA ---
router.get('/listar', eventoController.listarEventosPorProdutor);
router.get('/:id', eventoController.buscarEventoPorId);

/**
 * ROTA DE ATUALIZAÇÃO (PUT)
 * O Multer processa o 'multipart/form-data'. 
 * Sem o 'upload.single', o Node não consegue ler o texto (nome, descrição, etc) 
 * quando há uma imagem sendo enviada junto.
 */
router.put('/:id', upload.single('imagem'), eventoController.atualizarEvento);

// --- 4. GESTÃO DE EVENTO ---
router.delete('/:id', eventoController.excluirEvento);
router.put('/:id/status', eventoController.atualizarStatus);

// --- 5. INGRESSOS ---
router.post('/:id/ingressos', eventoController.salvarIngressos);

module.exports = router;