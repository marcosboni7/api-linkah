const db = require('../config/database');

// 1. Enviar nova mensagem (Texto + Imagem)
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

// 2. Listar mensagens do chat
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

// 3. Sistema de Presença - QUEM ESTÁ ONLINE AGORA (Estilo Zoom)
exports.atualizarPresenca = async (req, res) => {
  const { id } = req.params; // ID do evento
  const { usuario_nome } = req.query; // Nome de quem está acessando

  if (!usuario_nome) return res.status(400).json({ error: "Nome necessário" });

  try {
    // A. Registra ou Atualiza a presença do usuário (Heartbeat)
    await db.query(`
      INSERT INTO presenca (evento_id, usuario_nome, ultima_vez)
      VALUES ($1, $2, NOW())
      ON CONFLICT (evento_id, usuario_nome) 
      DO UPDATE SET ultima_vez = NOW()
    `, [id, usuario_nome]);

    // B. Limpa usuários que não dão sinal de vida há mais de 15 segundos
    await db.query("DELETE FROM presenca WHERE ultima_vez < NOW() - INTERVAL '15 seconds'");

    // C. Busca todos que sobraram online neste evento
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