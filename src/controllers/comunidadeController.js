const db = require('../config/database');

exports.enviarMensagem = async (req, res) => {
  try {
    const { evento_id, usuario_nome, texto } = req.body;
    const idLimpo = parseInt(evento_id);

    console.log(`--- INÍCIO ENVIO ---`);
    console.log(`Tentando inserir: Evento ${idLimpo}, Usuário ${usuario_nome}`);

    // Usamos o RETURNING * para forçar o Postgres a confirmar a gravação
    const result = await db.query(
      `INSERT INTO public.mensagens (evento_id, usuario_nome, texto, criado_at) 
       VALUES ($1, $2, $3, NOW()) 
       RETURNING *`,
      [idLimpo, usuario_nome, texto]
    );

    console.log(`✅ Sucesso! ID da nova mensagem: ${result.rows[0].id}`);
    console.log(`--- FIM ENVIO ---`);
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("❌ ERRO NO INSERT:", err.message);
    res.status(500).json({ error: err.message });
  }
};

exports.listarMensagensPorEvento = async (req, res) => {
  try {
    const { evento_id } = req.params;
    const idLimpo = parseInt(evento_id);

    console.log(`🔍 Buscando mensagens para o evento: ${idLimpo}`);

    const result = await db.query(
      `SELECT * FROM public.mensagens 
       WHERE evento_id = $1 
       ORDER BY criado_at ASC`,
      [idLimpo]
    );

    console.log(`📊 Total de mensagens encontradas no banco: ${result.rowCount}`);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ ERRO NO SELECT:", err.message);
    res.status(500).json({ error: err.message });
  }
};