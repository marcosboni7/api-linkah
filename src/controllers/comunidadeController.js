const db = require('../config/database');

exports.enviarMensagem = async (req, res) => {
  try {
    const { evento_id, usuario_nome, texto } = req.body;
    
    // Garante que o ID seja um número inteiro puro
    const idLimpo = parseInt(evento_id);

    const result = await db.query(
      `INSERT INTO public.mensagens (evento_id, usuario_nome, texto, criado_em) 
       VALUES ($1, $2, $3, NOW()) 
       RETURNING *`,
      [idLimpo, usuario_nome, texto]
    );

    console.log("✅ Mensagem salva no banco:", result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("❌ Erro ao enviar:", err.message);
    res.status(500).json({ error: err.message });
  }
};

exports.listarMensagensPorEvento = async (req, res) => {
  try {
    const { evento_id } = req.params;
    
    // O pulo do gato: forçamos o ID que vem da URL a ser um número
    const idLimpo = parseInt(evento_id);

    console.log(`🔍 Buscando mensagens para o evento ID: ${idLimpo}`);

    // Busca simples sem filtros complexos para garantir que apareça
    const result = await db.query(
      `SELECT * FROM public.mensagens WHERE evento_id = $1 ORDER BY criado_em ASC`,
      [idLimpo]
    );

    console.log(`📊 Banco encontrou ${result.rowCount} mensagens.`);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Erro ao buscar:", err.message);
    res.status(500).json({ error: err.message });
  }
};