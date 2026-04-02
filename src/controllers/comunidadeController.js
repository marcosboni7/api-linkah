const db = require('../config/database');

// Fallback de avatar
const AVATAR_FALLBACK = 'https://i.pinimg.com/originals/ec/a5/a7/eca5a7c991e8fa52554e953593faba2d.gif';

/**
 * ==========================================
 * 1️⃣ VITRINE DE COMUNIDADES
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
 * 2️⃣ ENVIAR MENSAGEM
 * ==========================================
 */
exports.enviarMensagem = async (req, res) => {
  const {
    evento_id,
    usuario_nome,
    usuario_foto,
    texto,
    imagem,
    tipo
  } = req.body;

  if (!evento_id || !usuario_nome || !texto) {
    return res.status(400).json({ error: "Campos obrigatórios faltando" });
  }

  try {
    const result = await db.query(`
      INSERT INTO public.mensagens_v2
      (
        evento_id,
        usuario_nome,
        usuario_foto,
        texto,
        imagem,
        tipo
      )
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *
    `,
    [
      evento_id,
      usuario_nome,
      usuario_foto || AVATAR_FALLBACK,
      texto,
      imagem || null,
      tipo || 'chat'
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
 * 4️⃣ SISTEMA DE PRESENÇA (ONLINE)
 * ==========================================
 */
exports.atualizarPresenca = async (req, res) => {
  const { id } = req.params;
  const { usuario_nome, foto } = req.query;

  try {
    if (usuario_nome && usuario_nome !== 'undefined' && usuario_nome !== 'null') {
      await db.query(`
        INSERT INTO public.presenca
        (
          evento_id,
          usuario_nome,
          usuario_foto,
          ultima_vez
        )
        VALUES ($1,$2,$3,NOW())
        ON CONFLICT (evento_id, usuario_nome)
        DO UPDATE SET
          ultima_vez = NOW(),
          usuario_foto = COALESCE(EXCLUDED.usuario_foto, $4)
      `,
      [
        id,
        usuario_nome,
        foto || AVATAR_FALLBACK,
        AVATAR_FALLBACK
      ]);
    }

    // Remove usuários inativos
    await db.query(`
      DELETE FROM public.presenca
      WHERE ultima_vez < NOW() - INTERVAL '20 seconds'
    `);

    const online = await db.query(`
      SELECT DISTINCT
        usuario_nome,
        COALESCE(usuario_foto, $2) AS usuario_foto
      FROM public.presenca
      WHERE evento_id = $1
    `, [id, AVATAR_FALLBACK]);

    res.status(200).json(online.rows);
  } catch (err) {
    console.error('❌ ERRO PRESENÇA:', err.message);
    res.status(500).json({ error: 'Erro ao processar presença' });
  }
};