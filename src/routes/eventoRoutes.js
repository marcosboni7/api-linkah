const express = require('express');
const router = express.Router();
const eventoController = require('../controllers/eventoController');
const OnlineController = require('../controllers/OnlineController');
const upload = require('../config/multer'); 

// --- 1. ROTAS PÚBLICAS ---
// Usadas para a página inicial e busca geral
router.get('/', eventoController.listarTodosEventosParaVitrine);
router.get('/vitrine', eventoController.listarTodosEventosParaVitrine);

// --- 2. ROTAS DE CRIAÇÃO ---
// Note que o 'upload.single' deve bater exatamente com o nome enviado pelo FormData no Front-end
router.post('/novo-online', upload.single('imagem_capa'), OnlineController.criarEventoOnline);
router.post('/novo-presencial', upload.single('imagem_capa'), eventoController.criarEventoPresencial);

// --- 3. DASHBOARD & BUSCA ---
// Rota de listagem por produtor (onde o Front chama com ?email=...)
router.get('/listar', eventoController.listarEventosPorProdutor);
router.get('/:id', eventoController.buscarEventoPorId);

// --- 4. ROTA DE ATUALIZAÇÃO ---
// O segredo aqui é o 'upload.single'. Se o usuário não mandar foto, 
// o multer deixa o req.file vazio, e o Controller deve tratar isso.
router.put('/:id', upload.single('imagem_capa'), eventoController.atualizarEvento);

// --- 5. GESTÃO DE EVENTO ---
router.delete('/:id', eventoController.excluirEvento);
router.put('/:id/status', eventoController.atualizarStatus);

// --- 6. INGRESSOS ---
// Salva as modalidades de ingressos (Gratuito, Pago, Pix - que estávamos integrando)
router.post('/:id/ingressos', eventoController.salvarIngressos);

module.exports = router;