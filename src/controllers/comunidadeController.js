const db = require('../config/database');

// Fallback de avatar para usuários sem foto
const AVATAR_FALLBACK = 'https://i.pinimg.com/originals/ec/a5/a7/eca5a7c991e8fa52554e953593faba2d.gif';

/**
 * ==========================================
 * 1️⃣ VITRINE DE COMUNIDADES (HOME)
 * ==========================================
 */
exports.getComunidadesVitrine = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        e.id,
        e.nome,
        e.descricao,
        e.imagem_capa AS imagem_url,
        (
          SELECT COUNT(DISTINCT usuario_nome)
          FROM public.mensagens_v2
          WHERE evento_id = e.id
        ) + 120 AS total_membros
      FROM public.eventos e
      WHERE e.status = 'Ativo'
         OR e.status IS NULL
         OR e.status = ''
      ORDER BY e.id DESC
      LIMIT 3
    `);

    res.status(200).json(result.rows);
  } catch (err) {
    console.error('❌ ERRO VITRINE:', err.message);
    res.status(500).json({ error: 'Erro ao carregar comunidades' });
  }
};

/**
 * ==========================================
 * 2️⃣ ENVIAR MENSAGEM (HOST DINÂMICO)
 * ==========================================
 */
exports.enviarMensagem = async (req, res) => {
  const {
    evento_id,
    usuario_nome,
    usuario_foto,
    texto,
    imagem,
    tipo,
    status 
  } = req.body;

  if (!evento_id || !usuario_nome || !texto) {
    return res.status(400).json({ error: "Campos obrigatórios faltando" });
  }

  try {
    // --- LÓGICA AUTOMÁTICA DE HOST ---
    // Buscamos quem criou este evento específico para validar o selo de Host
    const queryEvento = await db.query(
        'SELECT usuario_nome FROM public.eventos WHERE id = $1', 
        [evento_id]
    );
    
    const donoDoEvento = queryEvento.rows[0]?.usuario_nome;
    
    // Se quem está enviando for o dono, marca como Host
    const isHost = (usuario_nome && donoDoEvento && usuario_nome.trim() === donoDoEvento.trim());

    const result = await db.query(`
      INSERT INTO public.mensagens_v2
      (
        evento_id,
        usuario_nome,
        usuario_foto,
        texto,
        imagem,
        tipo,
        status,
        is_host
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *
    `,
    [
      evento_id,
      usuario_nome,
      usuario_foto || AVATAR_FALLBACK,
      texto,
      imagem || null,
      tipo || 'chat',
      status || '✨',
      isHost 
    ]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('❌ ERRO SALVAR MENSAGEM:', err.message);
    res.status(500).json({ error: 'Erro ao salvar mensagem' });
  }
};

/**
 * ==========================================
 * 3️⃣ LISTAR MENSAGENS
 * ==========================================
 */
exports.listarMensagensPorEvento = async (req, res) => {
  const { evento_id } = req.params;

  try {
    const result = await db.query(`
      SELECT
        id,
        evento_id,
        usuario_nome,
        COALESCE(usuario_foto, $2) AS usuario_foto,
        texto,
        imagem,
        tipo,
        status,
        is_host,
        criado_em
      FROM public.mensagens_v2
      WHERE evento_id = $1
      ORDER BY criado_em ASC
    `, [evento_id, AVATAR_FALLBACK]);

    res.status(200).json(result.rows);
  } catch (err) {
    console.error('❌ ERRO LISTAR MENSAGENS:', err.message);
    res.status(500).json({ error: 'Erro ao buscar mensagens' });
  }
};

/**
 * ==========================================
 * 4️⃣ SISTEMA DE PRESENÇA (ONLINE DINÂMICO)
 * ==========================================
 */
exports.atualizarPresenca = async (req, res) => {
  const { id } = req.params;
  const { usuario_nome, foto, status } = req.query;

  try {
    if (usuario_nome && usuario_nome !== 'undefined' && usuario_nome !== 'null') {
      await db.query(`
        INSERT INTO public.presenca
        (
          evento_id,
          usuario_nome,
          usuario_foto,
          status,
          ultima_vez
        )
        VALUES ($1,$2,$3,$4,NOW())
        ON CONFLICT (evento_id, usuario_nome)
        DO UPDATE SET
          ultima_vez = NOW(),
          status = COALESCE(EXCLUDED.status, public.presenca.status),
          usuario_foto = COALESCE(EXCLUDED.usuario_foto, $5)
      `,
      [
        id,
        usuario_nome,
        foto || AVATAR_FALLBACK,
        status || '✨',
        AVATAR_FALLBACK
      ]);
    }

    // Limpeza automática de usuários inativos (timeout de 20s)
    await db.query(`
      DELETE FROM public.presenca
      WHERE ultima_vez < NOW() - INTERVAL '20 seconds'
    `);

    // Busca o dono do evento para marcar na lista lateral também
    const queryDono = await db.query('SELECT usuario_nome FROM public.eventos WHERE id = $1', [id]);
    const nomeDono = queryDono.rows[0]?.usuario_nome;

    const online = await db.query(`
      SELECT DISTINCT
        usuario_nome,
        status,
        COALESCE(usuario_foto, $2) AS usuario_foto,
        (usuario_nome = $3) as is_host
      FROM public.presenca
      WHERE evento_id = $1
    `, [id, AVATAR_FALLBACK, nomeDono]);

    res.status(200).json(online.rows);
  } catch (err) {
    console.error('❌ ERRO PRESENÇA:', err.message);
    res.status(500).json({ error: 'Erro ao processar presença' });
  }
};

/**
 * ==========================================
 * 5️⃣ LISTAR TODAS (DASHBOARD ADMIN)
 * ==========================================
 */
exports.getTodasComunidades = async (req, res) => {
  try {
    // Retorna todos os eventos para contagem total no Dashboard
    const result = await db.query('SELECT id FROM public.eventos');
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('❌ ERRO DASHBOARD TOTAL:', err.message);
    res.status(500).json({ error: 'Erro ao listar todas as comunidades' });
  }
};