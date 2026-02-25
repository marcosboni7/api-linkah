const db = require('../config/database');

/**
 * 1. VITRINE DE COMUNIDADES
 * Retorna as salas de chat para a Home.
 */
exports.getComunidadesVitrine = async (req, res) => {
  try {
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
    console.log(`📡 API Comunidades: ${result.rows.length} salas enviadas.`);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('❌ Erro na Vitrine:', err.message);
    res.status(500).json({ error: 'Erro ao carregar salas' });
  }
};

/**
 * 2. ENVIAR MENSAGEM
 * Suporta chat comum e mensagens de sistema (tipo: 'status').
 */
exports.enviarMensagem = async (req, res) => {
  const { evento_id, usuario_nome, texto, imagem, tipo } = req.body;
  
  if (!evento_id || !usuario_nome || !texto) {
    return res.status(400).json({ error: "Campos obrigatórios faltando." });
  }

  try {
    const query = `
      INSERT INTO public.mensagens_v2 (evento_id, usuario_nome, texto, imagem, tipo) 
      VALUES ($1, $2, $3, $4, $5) 
      RETURNING *
    `;
    // 'chat' é o padrão se o tipo não for enviado
    const values = [evento_id, usuario_nome, texto, imagem || null, tipo || 'chat'];
    const result = await db.query(query, values);
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('❌ Erro ao salvar mensagem:', err.message);
    res.status(500).json({ error: 'Erro ao salvar mensagem' });
  }
};

/**
 * 3. LISTAR MENSAGENS
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
 * 4. SISTEMA DE PRESENÇA (REVISADO)
 * Gerencia o "quem está online" em tempo real.
 */
exports.atualizarPresenca = async (req, res) => {
  const { id } = req.params; // ID do evento
  const { usuario_nome } = req.query;

  try {
    // 1. Só registra se o nome for válido e não for string "undefined" do front
    if (usuario_nome && usuario_nome !== 'undefined' && usuario_nome !== 'null') {
      await db.query(`
        INSERT INTO public.presenca (evento_id, usuario_nome, ultima_vez)
        VALUES ($1, $2, NOW())
        ON CONFLICT (evento_id, usuario_nome) 
        DO UPDATE SET ultima_vez = NOW()
      `, [id, usuario_nome]);
    }

    // 2. Limpeza: Remove quem não deu sinal de vida nos últimos 20 segundos
    // Aumentamos para 20s para evitar que usuários com net lenta sumam muito rápido
    await db.query("DELETE FROM public.presenca WHERE ultima_vez < NOW() - INTERVAL '20 seconds'");

    // 3. Retorna a lista de nomes únicos que sobraram
    const online = await db.query(
      "SELECT DISTINCT usuario_nome FROM public.presenca WHERE evento_id = $1", 
      [id]
    );

    res.json(online.rows);
  } catch (err) {
    console.error('❌ Erro no sistema de presença:', err.message);
    res.status(500).json({ error: 'Erro ao processar presença' });
  }
};