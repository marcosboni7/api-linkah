const db = require('../config/database');

exports.enviarMensagem = async (req, res) => {
  try {
    const { evento_id, usuario_nome, texto } = req.body;
    const idLimpo = parseInt(evento_id);

    // Usando exatamente os nomes que o seu banco mostrou no log
    const result = await db.query(
      `INSERT INTO public.mensagens (evento_id, usuario_nome, texto, criado_em) 
       VALUES ($1, $2, $3, NOW()) 
       RETURNING *`,
      [idLimpo, usuario_nome, texto]
    );

    console.log("✅ Gravado:", result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("❌ Erro no Insert:", err.message);
    res.status(500).json({ error: err.message });
  }
};

exports.listarMensagensPorEvento = async (req, res) => {
  try {
    const { evento_id } = req.params;
    const idLimpo = parseInt(evento_id);

    // Busca simples sem ORDER BY por enquanto para testar a conexão pura
    const result = await db.query(
      `SELECT * FROM public.mensagens WHERE evento_id = $1`,
      [idLimpo]
    );

    console.log(`🔍 Buscando ID ${idLimpo} - Encontradas: ${result.rowCount}`);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Erro no Select:", err.message);
    res.status(500).json({ error: err.message });
  }
};