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
 * 2️⃣ ENVIAR MENSAGEM (Com suporte a Status e Host)
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
    status // Novo: Vem do seletor de emojis do front
  } = req.body;

  if (!evento_id || !usuario_nome || !texto) {
    return res.status(400).json({ error: "Campos obrigatórios faltando" });
  }

  // --- LÓGICA DA BORDA DOURADA ---
  // Define quem é o host. Se for você, o banco salva como TRUE.
  const isHost = (usuario_nome === "Marcos Boni");

  try {
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
      status || '✨', // Salva o emoji de humor
      isHost         // Salva se tem a borda dourada
    ]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('❌ ERRO SALVAR MENSAGEM:', err.message);
    res.status(500).json({ error: 'Erro ao salvar mensagem' });
  }
};

/**
 * ==========================================
 * 3️⃣ LISTAR MENSAGENS (Retornando Status e Host)
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
 * 4️⃣ SISTEMA DE PRESENÇA (ONLINE COM HUMOR)
 * ==========================================
 */
exports.atualizarPresenca = async (req, res) => {
  const { id } = req.params;
  const { usuario_nome, foto, status } = req.query; // Status também via query para o Polling

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
          status = EXCLUDED.status,
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

    // Remove usuários inativos (mais de 20 segundos)
    await db.query(`
      DELETE FROM public.presenca
      WHERE ultima_vez < NOW() - INTERVAL '20 seconds'
    `);

    const online = await db.query(`
      SELECT DISTINCT
        usuario_nome,
        status,
        COALESCE(usuario_foto, $2) AS usuario_foto,
        -- Verifica se esse usuário online também é Host
        (usuario_nome = 'Marcos Boni') as is_host
      FROM public.presenca
      WHERE evento_id = $1
    `, [id, AVATAR_FALLBACK]);

    res.status(200).json(online.rows);
  } catch (err) {
    console.error('❌ ERRO PRESENÇA:', err.message);
    res.status(500).json({ error: 'Erro ao processar presença' });
  }
};