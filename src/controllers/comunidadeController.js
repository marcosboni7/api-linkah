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
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('❌ Erro na Vitrine:', err.message);
    res.status(500).json({ error: 'Erro ao carregar salas' });
  }
};

/**
 * 2. ENVIAR MENSAGEM (CORRIGIDO)
 * Agora recebe e salva a 'usuario_foto' vinda do frontend.
 */
exports.enviarMensagem = async (req, res) => {
  const { evento_id, usuario_nome, usuario_foto, texto, imagem, tipo } = req.body;
  
  if (!evento_id || !usuario_nome || !texto) {
    return res.status(400).json({ error: "Campos obrigatórios faltando." });
  }

  try {
    const query = `
      INSERT INTO public.mensagens_v2 (evento_id, usuario_nome, usuario_foto, texto, imagem, tipo) 
      VALUES ($1, $2, $3, $4, $5, $6) 
      RETURNING *
    `;
    
    // O array de valores agora inclui o índice $3 (usuario_foto)
    const values = [
      evento_id, 
      usuario_nome, 
      usuario_foto || null, 
      texto, 
      imagem || null, 
      tipo || 'chat'
    ];

    const result = await db.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('❌ Erro ao salvar mensagem:', err.message);
    res.status(500).json({ error: 'Erro ao salvar mensagem' });
  }
};

/**
 * 3. LISTAR MENSAGENS (REVISADO)
 * Garante que o campo usuario_foto seja retornado para o chat.
 */
exports.listarMensagensPorEvento = async (req, res) => {
  const { evento_id } = req.params;
  try {
    // Selecionamos usuario_foto explicitamente
    const query = `
      SELECT id, evento_id, usuario_nome, usuario_foto, texto, imagem, tipo, criado_em 
      FROM public.mensagens_v2 
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
 * 4. SISTEMA DE PRESENÇA (CORRIGIDO)
 * Salva a foto do usuário para que os outros vejam na lista de "Online".
 */
exports.atualizarPresenca = async (req, res) => {
  const { id } = req.params; // ID do evento
  const { usuario_nome, foto } = req.query; // 'foto' vem da URL via frontend

  try {
    if (usuario_nome && usuario_nome !== 'undefined' && usuario_nome !== 'null') {
      await db.query(`
        INSERT INTO public.presenca (evento_id, usuario_nome, usuario_foto, ultima_vez)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (evento_id, usuario_nome) 
        DO UPDATE SET ultima_vez = NOW(), usuario_foto = EXCLUDED.usuario_foto
      `, [id, usuario_nome, foto || null]);
    }

    // Limpeza de inativos (20 segundos)
    await db.query("DELETE FROM public.presenca WHERE ultima_vez < NOW() - INTERVAL '20 seconds'");

    // Retorna Nome e Foto para preencher a barra lateral
    const online = await db.query(
      "SELECT DISTINCT usuario_nome, usuario_foto FROM public.presenca WHERE evento_id = $1", 
      [id]
    );

    res.json(online.rows);
  } catch (err) {
    console.error('❌ Erro no sistema de presença:', err.message);
    res.status(500).json({ error: 'Erro ao processar presença' });
  }
};