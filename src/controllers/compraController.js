const db = require('../config/database');

// --- REGISTRAR UMA NOVA COMPRA (Chamado pelo Webhook) ---
exports.finalizarCompra = async (req, res) => {
  try {
    const { usuario_email, evento_id, evento_nome, data_evento, quantidade, valor_total, status } = req.body;

    const query = `
      INSERT INTO public.compras (usuario_email, evento_id, evento_nome, data_evento, quantidade, valor_total, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id;
    `;

    const result = await db.query(query, [
      usuario_email, evento_id, evento_nome, data_evento, quantidade, valor_total, status || 'Aprovado'
    ]);

    return res.status(201).json({ 
      message: "Compra realizada com sucesso!", 
      id_compra: result.rows[0].id 
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// --- LISTAR COMPRAS DE UM USUÁRIO (Para a Navbar) ---
exports.listarMinhasCompras = async (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ error: "Email não fornecido" });
  }

  try {
    const query = `
      SELECT 
        id, 
        evento_nome as evento, 
        TO_CHAR(data_evento, 'DD/MM/YYYY') as data, 
        quantidade as qtd, 
        COALESCE(status, 'Aprovado') as status 
      FROM public.compras 
      WHERE usuario_email = $1 
      ORDER BY criado_at DESC
    `;
    const result = await db.query(query, [email]);
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error("Erro ao buscar compras:", err.message);
    return res.status(500).json({ error: err.message });
  }
};