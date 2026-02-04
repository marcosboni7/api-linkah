const express = require('express');
const router = express.Router();
const comunidadeController = require('../controllers/comunidadeController');

// 1. Lista as mensagens de um evento específico
// (O parâmetro :evento_id deve ser o mesmo que o controller espera)
router.get('/:evento_id', comunidadeController.listarMensagensPorEvento);

// 2. Envia a mensagem (Corrigido de 'salvarMensagem' para 'enviarMensagem')
router.post('/enviar', comunidadeController.enviarMensagem);

// 3. NOVA ROTA PARA USUÁRIOS ONLINE
// (Utiliza o id do evento para verificar/atualizar quem está online)
router.get('/:id/online', comunidadeController.atualizarPresenca);

module.exports = router;