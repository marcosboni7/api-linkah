const db = require('../config/database');

exports.enviarMensagem = async (req, res) => {
  try {
    const { evento_id, usuario_nome, texto } = req.body;

    // Log de segurança para conferir no Render
    console.log("📥 Tentando salvar mensagem:", { evento_id, usuario_nome, texto });

    // Validação básica para evitar que o banco receba valores nulos
    if (!evento_id || !usuario_nome || !texto) {
      return res.status(400).json({ error: "Campos obrigatórios faltando (evento_id, nome ou texto)." });
    }

    const query = `
      INSERT INTO public.mensagens (evento_id, usuario_nome, texto, criado_at) 
      VALUES ($1, $2, $3, NOW()) 
      RETURNING *
    `;
    
    const values = [parseInt(evento_id), usuario_nome, texto];

    const result = await db.query(query, values);

    console.log("✅ Mensagem salva no Postgres:", result.rows[0]);
    res.status(201).json(result.rows[0]);

  } catch (err) {
    console.error("❌ ERRO NO INSERT:", err.message);
    
    // Se o erro for de Chave Estrangeira, avisamos que o evento não existe
    if (err.message.includes('foreign key constraint')) {
      return res.status(400).json({ error: "Este evento não existe no banco de dados." });
    }

    res.status(500).json({ error: err.message });
  }
};

exports.listarMensagensPorEvento = async (req, res) => {
  try {
    const { evento_id } = req.params;

    if (!evento_id) {
      return res.status(400).json({ error: "ID do evento não fornecido." });
    }

    const result = await db.query(
      `SELECT * FROM public.mensagens 
       WHERE evento_id = $1 
       ORDER BY criado_at ASC`,
      [parseInt(evento_id)]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("❌ ERRO AO BUSCAR MENSAGENS:", err.message);
    res.status(500).json({ error: err.message });
  }
};