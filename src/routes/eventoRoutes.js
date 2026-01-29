const express = require('express');
const router = express.Router();
const eventoController = require('../controllers/eventoController');
const OnlineController = require('../controllers/OnlineController');

// 1. IMPORTANTE: Precisamos do middleware de upload.
// Verifique se no seu eventoController você exportou o 'upload'.
// Se sim, usamos eventoController.upload. Se não, importe o arquivo do multer.
const upload = eventoController.upload || require('../middlewares/multer'); 

// Vitrine (Público)
router.get('/vitrine', eventoController.listarTodosEventosParaVitrine);

// 2. AJUSTE NAS ROTAS DE CRIAÇÃO:
// Adicionamos o 'upload.single('imagem_capa')' para ele interceptar a foto
router.post('/novo-online', upload.single('imagem_capa'), OnlineController.criarEventoOnline);
router.post('/novo-presencial', upload.single('imagem_capa'), eventoController.criarEventoPresencial);

// Dashboard (Privado)
router.get('/listar', eventoController.listarEventosPorProdutor);
router.get('/:id', eventoController.buscarEventoPorId);
router.put('/:id', eventoController.atualizarEvento);
router.delete('/:id', eventoController.excluirEvento);
router.put('/:id/status', eventoController.atualizarStatus);

// Ingressos
router.post('/:id/ingressos', eventoController.salvarIngressos);

module.exports = router;