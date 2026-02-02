const db = require('../config/database');

// 1. Enviar nova mensagem 📩
exports.enviarMensagem = async (req, res) => {
  try {
    const { evento_id, usuario_nome, texto } = req.body;
    
    // Garantimos que o ID seja um número inteiro para o banco 🔢
    const idLimpo = parseInt(evento_id);

    console.log(`--- POST: Tentando gravar na mensagens_v2 para o evento ${idLimpo} ---`);

    const result = await db.query(
      `INSERT INTO public.mensagens_v2 (evento_id, usuario_nome, texto, criado_em) 
       VALUES ($1, $2, $3, NOW()) 
       RETURNING *`,
      [idLimpo, usuario_nome, texto]
    );

    console.log("✅ Mensagem gravada com sucesso:", result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("❌ Erro ao salvar mensagem:", err.message);
    res.status(500).json({ error: "Erro interno ao salvar a mensagem." });
  }
};

// 2. Listar mensagens por evento 📋
exports.listarMensagensPorEvento = async (req, res) => {
  try {
    const { evento_id } = req.params;
    const idLimpo = parseInt(evento_id);

    console.log(`--- GET: Buscando mensagens_v2 para o evento ${idLimpo} ---`);

    // Buscamos na tabela v2 e ordenamos pela data de criação ⏱️
    const result = await db.query(
      `SELECT * FROM public.mensagens_v2 
       WHERE evento_id = $1 
       ORDER BY criado_em ASC`, 
      [idLimpo]
    );

    console.log(`📊 Banco retornou ${result.rowCount} mensagens.`);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Erro ao buscar mensagens:", err.message);
    res.status(500).json({ error: "Erro interno ao carregar as mensagens." });
  }
};