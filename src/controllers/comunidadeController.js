const db = require('../config/database');

exports.enviarMensagem = async (req, res) => {
  try {
    const { evento_id, usuario_nome, texto } = req.body;
    
    // Forçar o ID a ser número puro
    const idLimpo = parseInt(evento_id);

    const result = await db.query(
      `INSERT INTO public.mensagens (evento_id, usuario_nome, texto, criado_at) 
       VALUES ($1, $2, $3, NOW()) 
       RETURNING *`,
      [idLimpo, usuario_nome, texto]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Erro no Insert:", err.message);
    res.status(500).json({ error: err.message });
  }
};

exports.listarMensagensPorEvento = async (req, res) => {
  try {
    const { evento_id } = req.params;
    const idLimpo = parseInt(evento_id); // Garante que a busca seja por número

    const result = await db.query(
      `SELECT * FROM public.mensagens 
       WHERE evento_id = $1 
       ORDER BY criado_at ASC`,
      [idLimpo]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};