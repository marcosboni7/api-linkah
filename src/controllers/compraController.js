const db = require('../config/database');

// --- REGISTRAR UMA NOVA COMPRA ---
exports.finalizarCompra = async (req, res) => {
  try {
    const { usuario_email, evento_id, evento_nome, data_evento, quantidade, valor_total } = req.body;

    const query = `
      INSERT INTO public.compras (usuario_email, evento_id, evento_nome, data_evento, quantidade, valor_total)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id;
    `;

    const result = await db.query(query, [
      usuario_email, evento_id, evento_nome, data_evento, quantidade, valor_total
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
  const { email } = req.query; // Pega o email enviado pela Navbar
  try {
    const query = `
      SELECT id, evento_nome as evento, TO_CHAR(data_evento, 'DD/MM/YYYY') as data, quantidade as qtd, status 
      FROM public.compras 
      WHERE usuario_email = $1 
      ORDER BY criado_at DESC
    `;
    const result = await db.query(query, [email]);
    return res.status(200).json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};