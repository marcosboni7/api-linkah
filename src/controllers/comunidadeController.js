const db = require('../config/database');

// --- 1. VITRINE DE COMUNIDADES (Para a Home) ---
exports.getComunidadesVitrine = async (req, res) => {
  try {
    // Busca 3 comunidades para destacar na Home
    const result = await db.query('SELECT * FROM comunidades ORDER BY total_membros DESC LIMIT 3');
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('❌ Erro ao buscar vitrine de comunidades:', err.message);
    res.status(500).json({ error: 'Erro ao buscar comunidades' });
  }
};

// --- 2. ENVIAR MENSAGEM (Chat) ---
exports.enviarMensagem = async (req, res) => {
  const { evento_id, usuario_nome, texto, imagem } = req.body;
  try {
    const query = `
      INSERT INTO mensagens_v2 (evento_id, usuario_nome, texto, imagem) 
      VALUES ($1, $2, $3, $4) 
      RETURNING *
    `;
    const values = [evento_id, usuario_nome, texto, imagem || null];
    const result = await db.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao salvar mensagem:', err);
    res.status(500).json({ error: 'Erro interno ao salvar mensagem' });
  }
};

// --- 3. LISTAR MENSAGENS (Chat) ---
exports.listarMensagensPorEvento = async (req, res) => {
  const { evento_id } = req.params;
  try {
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

// --- 4. SISTEMA DE PRESENÇA (Online) ---
exports.atualizarPresenca = async (req, res) => {
  const { id } = req.params; 
  const { usuario_nome } = req.query;
  if (!usuario_nome) return res.status(400).json({ error: "Nome necessário" });

  try {
    await db.query(`
      INSERT INTO presenca (evento_id, usuario_nome, ultima_vez)
      VALUES ($1, $2, NOW())
      ON CONFLICT (evento_id, usuario_nome) 
      DO UPDATE SET ultima_vez = NOW()
    `, [id, usuario_nome]);

    await db.query("DELETE FROM presenca WHERE ultima_vez < NOW() - INTERVAL '15 seconds'");

    const online = await db.query(
      "SELECT usuario_nome FROM presenca WHERE evento_id = $1", 
      [id]
    );
    res.json(online.rows);
  } catch (err) {
    console.error('Erro na presença:', err);
    res.status(500).json({ error: 'Erro ao processar presença' });
  }
};