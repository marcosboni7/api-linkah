const db = require('../config/database');

exports.salvarMensagem = async (req, res) => {
  try {
    const { evento_id, usuario_id, texto } = req.body;
    const result = await db.query(
      'INSERT INTO mensagens (evento_id, usuario_id, texto) VALUES ($1, $2, $3) RETURNING *',
      [evento_id, usuario_id, texto]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.listarMensagensPorEvento = async (req, res) => {
  try {
    const { evento_id } = req.params;
    // O JOIN serve para pegar o nome do usuário junto com a mensagem
    const result = await db.query(`
      SELECT m.*, u.nome as usuario_nome 
      FROM mensagens m 
      JOIN produtores u ON m.usuario_id = u.id 
      WHERE m.evento_id = $1 
      ORDER BY m.criado_em ASC`, 
      [evento_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};