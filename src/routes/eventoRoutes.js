const express = require('express');
const router = express.Router();
const eventoController = require('../controllers/eventoController');
const OnlineController = require('../controllers/OnlineController');

// IMPORTANTE: Importe a sua configuração do Multer aqui
// Se o seu arquivo de config tiver outro nome, ajuste o caminho abaixo
const upload = require('../config/multer'); 

// --- 1. ROTA RAIZ (Público) ---
router.get('/', eventoController.listarTodosEventosParaVitrine);
router.get('/vitrine', eventoController.listarTodosEventosParaVitrine);

// --- 2. ROTAS DE CRIAÇÃO ---
// Nota: Se você quiser subir imagem no "novo-presencial" também, 
// adicione o upload.single('imagem') aqui depois.
router.post('/novo-online', OnlineController.criarEventoOnline);
router.post('/novo-presencial', eventoController.criarEventoPresencial);

// --- 3. DASHBOARD (Privado) ---
router.get('/listar', eventoController.listarEventosPorProdutor);
router.get('/:id', eventoController.buscarEventoPorId);

/**
 * ROTA DE ATUALIZAÇÃO (CORRIGIDA)
 * O 'upload.single('imagem')' DEVE vir antes do 'eventoController.atualizarEvento'.
 * Isso garante que o Multer processe o nome e a foto ANTES do controller tentar ler.
 */
router.put('/:id', upload.single('imagem'), eventoController.atualizarEvento);

router.delete('/:id', eventoController.excluirEvento);
router.put('/:id/status', eventoController.atualizarStatus);

// --- 4. INGRESSOS ---
router.post('/:id/ingressos', eventoController.salvarIngressos);

module.exports = router;