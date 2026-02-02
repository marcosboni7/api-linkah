const db = require('../config/database');

exports.enviarMensagem = async (req, res) => {
  try {
    const { evento_id, usuario_nome, texto } = req.body;
    const idLimpo = parseInt(evento_id);

    console.log(`--- TENTATIVA DE GRAVAÇÃO: Evento ${idLimpo} ---`);

    const result = await db.query(
      `INSERT INTO public.mensagens (evento_id, usuario_nome, texto, criado_at) 
       VALUES ($1, $2, $3, NOW()) 
       RETURNING *`,
      [idLimpo, usuario_nome, texto]
    );

    console.log("✅ MSG GRAVADA COM SUCESSO NO POSTGRES:", result.rows[0]);
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("❌ ERRO NO INSERT:", err.message);
    return res.status(500).json({ error: err.message });
  }
};

exports.listarMensagensPorEvento = async (req, res) => {
  try {
    const { evento_id } = req.params;
    const idLimpo = parseInt(evento_id);

    const result = await db.query(
      `SELECT * FROM public.mensagens 
       WHERE evento_id = $1 
       ORDER BY criado_at ASC`,
      [idLimpo]
    );

    console.log(`🔍 Busca para ID ${idLimpo} retornou ${result.rowCount} linhas.`);
    return res.json(result.rows);
  } catch (err) {
    console.error("❌ ERRO NO SELECT:", err.message);
    return res.status(500).json({ error: err.message });
  }
};