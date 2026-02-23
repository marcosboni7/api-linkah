const db = require('../config/database');

/**
 * 1. VITRINE DE COMUNIDADES
 * Transforma seus eventos em "Salas de Chat" para a Home.
 */
exports.getComunidadesVitrine = async (req, res) => {
  try {
    // Buscamos da tabela public.eventos (que você confirmou estar funcionando)
    // O SELECT inclui uma contagem de membros fake (+120) para dar volume visual
    const query = `
      SELECT 
        e.id, 
        e.nome, 
        e.descricao,
        e.imagem_capa AS imagem_url,
        (SELECT COUNT(DISTINCT usuario_nome) FROM public.mensagens_v2 WHERE evento_id = e.id) + 120 AS total_membros
      FROM public.eventos e
      WHERE e.status = 'Ativo' 
         OR e.status IS NULL 
         OR e.status = ''
      ORDER BY e.id DESC
      LIMIT 3
    `;
    
    const result = await db.query(query);
    
    // Log útil para monitorar no Render se a query está trazendo dados
    console.log(`📡 API Comunidades: ${result.rows.length} salas enviadas para o frontend.`);
    
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('❌ Erro no Controller de Comunidades (Vitrine):', err.message);
    res.status(500).json({ error: 'Erro ao carregar salas de chat' });
  }
};

/**
 * 2. ENVIAR MENSAGEM
 * Salva a interação do usuário no banco.
 */
exports.enviarMensagem = async (req, res) => {
  const { evento_id, usuario_nome, texto, imagem } = req.body;
  
  // Validação básica
  if (!evento_id || !usuario_nome || !texto) {
    return res.status(400).json({ error: "Campos obrigatórios faltando." });
  }

  try {
    const query = `
      INSERT INTO public.mensagens_v2 (evento_id, usuario_nome, texto, imagem) 
      VALUES ($1, $2, $3, $4) 
      RETURNING *
    `;
    const values = [evento_id, usuario_nome, texto, imagem || null];
    const result = await db.query(query, values);
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('❌ Erro ao salvar mensagem:', err.message);
    res.status(500).json({ error: 'Erro interno ao salvar mensagem' });
  }
};

/**
 * 3. LISTAR MENSAGENS
 * Carrega o histórico do chat de um evento específico.
 */
exports.listarMensagensPorEvento = async (req, res) => {
  const { evento_id } = req.params;
  try {
    const query = `
      SELECT * FROM public.mensagens_v2 
      WHERE evento_id = $1 
      ORDER BY criado_em ASC
    `;
    const result = await db.query(query, [evento_id]);
    
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Erro ao listar mensagens:', err.message);
    res.status(500).json({ error: 'Erro ao buscar mensagens' });
  }
};

/**
 * 4. SISTEMA DE PRESENÇA
 * Gerencia quem está online nos últimos 15 segundos.
 */
exports.atualizarPresenca = async (req, res) => {
  const { id } = req.params; // ID do evento
  const { usuario_nome } = req.query;

  if (!usuario_nome) {
    return res.status(400).json({ error: "Nome do usuário é necessário." });
  }

  try {
    // 1. Registra ou atualiza o pulso do usuário
    await db.query(`
      INSERT INTO public.presenca (evento_id, usuario_nome, ultima_vez)
      VALUES ($1, $2, NOW())
      ON CONFLICT (evento_id, usuario_nome) 
      DO UPDATE SET ultima_vez = NOW()
    `, [id, usuario_nome]);

    // 2. Remove usuários inativos (limpeza automática)
    await db.query("DELETE FROM public.presenca WHERE ultima_vez < NOW() - INTERVAL '15 seconds'");

    // 3. Retorna a lista de quem sobrou (está online)
    const online = await db.query(
      "SELECT usuario_nome FROM public.presenca WHERE evento_id = $1", 
      [id]
    );

    res.json(online.rows);
  } catch (err) {
    console.error('❌ Erro no sistema de presença:', err.message);
    res.status(500).json({ error: 'Erro ao processar presença' });
  }
};