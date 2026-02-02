const db = require('../config/database');

exports.enviarMensagem = async (req, res) => {
  try {
    const { evento_id, usuario_nome, texto } = req.body;
    const idLimpo = parseInt(evento_id);

    console.log(`--- POST: Tentando gravar no evento ${idLimpo} ---`);
    
    const result = await db.query(
      `INSERT INTO public.mensagens (evento_id, usuario_nome, texto, criado_em) 
       VALUES ($1, $2, $3, NOW()) 
       RETURNING *`,
      [idLimpo, usuario_nome, texto]
    );

    console.log("✅ Gravado com ID:", result.rows[0].id);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("❌ Erro no POST:", err.message);
    res.status(500).json({ error: err.message });
  }
};

exports.listarMensagensPorEvento = async (req, res) => {
  try {
    const { evento_id } = req.params;
    const idLimpo = parseInt(evento_id);

    console.log(`--- GET: Buscando para o evento ${idLimpo} ---`);

    // Busca total, sem filtros de data por enquanto para garantir que apareça
    const result = await db.query(
      `SELECT * FROM public.mensagens WHERE evento_id = $1`,
      [idLimpo]
    );

    console.log(`📊 Resultado: ${result.rowCount} mensagens encontradas.`);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Erro no GET:", err.message);
    res.status(500).json({ error: err.message });
  }
};