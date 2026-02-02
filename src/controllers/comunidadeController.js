const db = require('../config/database');

exports.enviarMensagem = async (req, res) => {
  // 1. Desestrutura o campo 'imagem' que vem do Front-end
  const { evento_id, usuario_nome, texto, imagem } = req.body;

  try {
    // 2. Atualiza a Query para incluir a coluna 'imagem' e o marcador $4
    const query = `
      INSERT INTO mensagens_v2 (evento_id, usuario_nome, texto, imagem) 
      VALUES ($1, $2, $3, $4) 
      RETURNING *
    `;
    
    // 3. Adiciona a variável 'imagem' no array de valores
    const values = [evento_id, usuario_nome, texto, imagem || null];

    const result = await db.query(query, values);
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao salvar mensagem:', err);
    res.status(500).json({ error: 'Erro interno ao salvar mensagem' });
  }
};

exports.listarMensagensPorEvento = async (req, res) => {
  const { evento_id } = req.params;

  try {
    // Certifique-se de que o SELECT também traga a coluna imagem
    const result = await db.query(
      "SELECT * FROM mensagens_v2 WHERE evento_id = $1 ORDER BY criado_em ASC",
      [evento_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao listar mensagens:', err);
    res.status(500).json({ error: 'Erro ao buscar mensagens' });
  }
};