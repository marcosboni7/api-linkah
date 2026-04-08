const express = require('express');
const router = express.Router();
const comunidadeController = require('../controllers/comunidadeController');

/**
 * ==========================================
 * ROTAS DE COMUNIDADES / CHAT
 * ==========================================
 */

// --- ROTA PARA O DASHBOARD ADMIN ---
// IMPORTANTE: Esta rota deve vir ANTES de qualquer rota com parâmetro (ex: /:evento_id)
// O seu AdminDashboard agora deve chamar: fetch(`${API_URL_BASE}/api/comunidades/total`)
router.get('/total', comunidadeController.getTodasComunidades);

// --- ROTA DA HOME (VITRINE) ---
// Retorna os últimos 3 eventos/comunidades ativos para a Landing Page
router.get('/', comunidadeController.getComunidadesVitrine);

// --- ROTA DE PRESENÇA ---
// Gerencia quem está online agora em um chat específico
router.get('/presenca/:id', comunidadeController.atualizarPresenca);

// --- ENVIAR MENSAGEM ---
// Salva novas mensagens no banco e valida se o usuário é o Host (dono do evento)
router.post('/enviar', comunidadeController.enviarMensagem);

// --- LISTAR MENSAGENS ---
// Recupera o histórico de mensagens de uma comunidade específica
router.get('/:evento_id', comunidadeController.listarMensagensPorEvento);

module.exports = router;