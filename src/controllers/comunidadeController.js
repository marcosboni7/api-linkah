const db = require('../config/database');

exports.enviarMensagem = async (req, res) => {
  try {
    const { evento_id, usuario_nome, texto } = req.body;
    const idLimpo = parseInt(evento_id);

    // Salvando na v2
    const result = await db.query(
      `INSERT INTO public.mensagens_v2 (evento_id, usuario_nome, texto, criado_em) 
       VALUES ($1, $2, $3, NOW()) 
       RETURNING *`,
      [idLimpo, usuario_nome, texto]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Erro no POST:", err.message);
    res.status(500).json({ error: err.message });
  }
};

exports.listarMensagensPorEvento = async (req, res) => {
  try {
    const { evento_id } = req.params;
    const idLimpo = parseInt(evento_id);

    // Buscando na v2
    const result = await db.query(
      `SELECT * FROM public.mensagens_v2 WHERE evento_id = $1 ORDER BY criado_em ASC`,
      [idLimpo]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Erro no GET:", err.message);
    res.status(500).json({ error: err.message });
  }
};