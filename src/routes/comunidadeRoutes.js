const express = require('express');
const router = express.Router();
const comunidadeController = require('../controllers/comunidadeController');

// Lista as mensagens (O parâmetro :evento_id deve ser o mesmo que o controller espera)
router.get('/:evento_id', comunidadeController.listarMensagensPorEvento);

// Envia a mensagem (Corrigido de 'salvarMensagem' para 'enviarMensagem')
router.post('/enviar', comunidadeController.enviarMensagem);

module.exports = router;const express = require('express');
const router = express.Router();
const comunidadeController = require('../controllers/comunidadeController');

router.get('/:evento_id', comunidadeController.listarMensagensPorEvento);
router.post('/enviar', comunidadeController.enviarMensagem);

// NOVA ROTA PARA USUÁRIOS ONLINE
router.get('/:id/online', comunidadeController.atualizarPresenca);

module.exports = router;