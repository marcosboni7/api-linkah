const express = require('express');
const router = express.Router();
const eventoController = require('../controllers/eventoController');
const OnlineController = require('../controllers/OnlineController');
const upload = require('../config/multer'); 

// --- 1. ROTAS PÚBLICAS ---
router.get('/', eventoController.listarTodosEventosParaVitrine);
router.get('/vitrine', eventoController.listarTodosEventosParaVitrine);

// --- 2. ROTAS DE CRIAÇÃO ---
/** * ✅ CORREÇÃO CRÍTICA: 
 * Para 'novo-online', removemos o 'upload.single' porque o Frontend agora envia JSON (Base64).
 * O Multer (upload) impediria o Express de ler o campo 'link_reuniao' dentro do JSON.
 */
router.post('/novo-online', OnlineController.criarEventoOnline);

// Mantemos o upload para o presencial caso ele ainda use FormData/Arquivo real
router.post('/novo-presencial', upload.single('imagem_capa'), eventoController.criarEventoPresencial);

// --- 3. DASHBOARD & BUSCA ---
router.get('/listar', eventoController.listarEventosPorProdutor);
router.get('/:id', eventoController.buscarEventoPorId);

// --- 4. ROTA DE ATUALIZAÇÃO ---
router.put('/:id', upload.single('imagem_capa'), eventoController.atualizarEvento);

// --- 5. GESTÃO DE EVENTO ---
router.delete('/:id', eventoController.excluirEvento);
router.put('/:id/status', eventoController.atualizarStatus);

// --- 6. INGRESSOS ---
router.post('/:id/ingressos', eventoController.salvarIngressos);

module.exports = router;