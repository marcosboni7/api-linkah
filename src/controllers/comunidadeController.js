const db = require('../config/database');

exports.enviarMensagem = async (req, res) => {
  try {
    const { evento_id, usuario_nome, texto } = req.body;

    // Log para você ver no terminal do Render se os dados chegaram
    console.log("Recebendo mensagem para salvar:", { evento_id, usuario_nome, texto });

    const result = await db.query(
      `INSERT INTO public.mensagens (evento_id, usuario_nome, texto) 
       VALUES ($1, $2, $3) 
       RETURNING *`, // O RETURNING é essencial para confirmar o save
      [parseInt(evento_id), usuario_nome, texto]
    );

    console.log("Mensagem salva com sucesso:", result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("ERRO NO BANCO AO SALVAR:", err.message);
    res.status(500).json({ error: err.message });
  }
};

exports.listarMensagensPorEvento = async (req, res) => {
  try {
    const { evento_id } = req.params;
    const result = await db.query(
      `SELECT * FROM public.mensagens 
       WHERE evento_id = $1 
       ORDER BY criado_at ASC`,
      [parseInt(evento_id)]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};