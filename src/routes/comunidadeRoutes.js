const express = require('express');
const router = express.Router();
const comunidadeController = require('../controllers/comunidadeController');

// --- ROTA DA HOME ---
// Busca as salas para exibir na vitrine da Home
router.get('/', comunidadeController.getComunidadesVitrine);

// --- ROTAS DO CHAT ---
// Lista o histórico de mensagens de uma sala
router.get('/:evento_id', comunidadeController.listarMensagensPorEvento);

// Envia uma nova mensagem (Texto, Imagem ou Convite de Call)
router.post('/enviar', comunidadeController.enviarMensagem);

// --- ROTA DE PRESENÇA (AJUSTADA) ---
// O Front-end chama /api/comunidades/presenca/123
// Mudamos de '/:id/online' para '/presenca/:id' para bater com o Front
router.get('/presenca/:id', comunidadeController.atualizarPresenca);

module.exports = router;