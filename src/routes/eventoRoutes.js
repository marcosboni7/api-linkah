const express = require('express');
const router = express.Router();

// Importa os controllers separados para manter a organização
const eventoController = require('../controllers/eventoController'); // Geral e Presencial
const OnlineController = require('../controllers/OnlineController'); // Específico para Online

// --- EVENTOS ONLINE ---

// Criar Evento Online (Passo 1)
router.post('/novo-online', OnlineController.criarEventoOnline);


// --- EVENTOS PRESENCIAIS ---

// Criar Evento Presencial (Passo 1)
router.post('/novo-presencial', eventoController.criarEventoPresencial);


// --- GERENCIAMENTO GERAL (Dashboard) ---

// Listar todos os eventos do produtor (Tabela Dashboard)
router.get('/listar', eventoController.listarEventosPorProdutor);

// Buscar detalhes de UM evento (Usado para abrir o Modal ou editar)
router.get('/:id', eventoController.buscarEventoPorId);

// Atualizar Evento Completo (O que o botão "Salvar" do Modal chama)
router.put('/:id', eventoController.atualizarEvento);

// Excluir Evento
router.delete('/:id', eventoController.excluirEvento);

// Editar apenas o Status (Switch Ativo/Pausado)
router.put('/:id/status', eventoController.atualizarStatus);


// --- INGRESSOS (Reutilizável para Online e Presencial) ---

// Salvar Ingressos (Passo 2 ou Edição de ingressos)
// Note que usamos o mesmo controller, pois a lógica de preço/qtd é a mesma
router.post('/:id/ingressos', eventoController.salvarIngressos);

module.exports = router;