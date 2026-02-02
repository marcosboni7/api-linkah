const db = require('../config/database');

// 1. Enviar nova mensagem 📩
exports.enviarMensagem = async (req, res) => {
  try {
    const { evento_id, usuario_nome, texto } = req.body;
    
    // Garantimos que o ID seja um número inteiro puro 🔢
    const idLimpo = parseInt(evento_id);

    console.log(`--- POST: Gravando na mensagens_v2 para o evento ${idLimpo} ---`);

    const result = await db.query(
      `INSERT INTO public.mensagens_v2 (evento_id, usuario_nome, texto, criado_em) 
       VALUES ($1, $2, $3, NOW()) 
       RETURNING *`,
      [idLimpo, usuario_nome, texto]
    );

    console.log("✅ Mensagem salva:", result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("❌ Erro no POST:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// 2. Listar mensagens por evento 📋
exports.listarMensagensPorEvento = async (req, res) => {
  try {
    const { evento_id } = req.params;
    const idLimpo = parseInt(evento_id);

    console.log(`--- GET: Buscando mensagens_v2 para o evento ${idLimpo} ---`);

    // Buscamos as mensagens ordenadas pelo tempo de criação ⏱️
    const result = await db.query(
      `SELECT * FROM public.mensagens_v2 
       WHERE evento_id = $1 
       ORDER BY criado_em ASC`, 
      [idLimpo]
    );

    console.log(`📊 Resultado: ${result.rowCount} mensagens encontradas.`);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Erro no GET:", err.message);
    res.status(500).json({ error: err.message });
  }
};