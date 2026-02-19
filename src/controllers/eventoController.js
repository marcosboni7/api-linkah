const db = require('../config/database');

// --- BUSCAR EVENTO POR ID (Foco em dados atualizados) ---
exports.buscarEventoPorId = async (req, res) => {
  const { id } = req.params;
  try {
    const query = `
      SELECT e.*, p.nome as produtor_nome, p.foto_perfil as produtor_foto
      FROM public.eventos e
      LEFT JOIN public.produtores p ON e.produtor_email = p.email
      WHERE e.id = $1
    `;
    const result = await db.query(query, [id]);

    if (result.rows.length === 0) return res.status(404).json({ message: "Não encontrado" });

    const evento = result.rows[0];

    // Garante que a data saia como YYYY-MM-DD para o Front não se perder
    if (evento.data_inicio) {
      evento.data_inicio = new Date(evento.data_inicio).toISOString().split('T')[0];
    }

    const resIng = await db.query('SELECT * FROM public.ingressos WHERE evento_id = $1 ORDER BY preco ASC', [id]);
    evento.ingressos = resIng.rows;

    return res.status(200).json(evento);
  } catch (err) { 
    return res.status(500).json({ error: err.message }); 
  }
};

// --- ATUALIZAR EVENTO ---
exports.atualizarEvento = async (req, res) => {
  const { id } = req.params;
  const { nome, categoria, descricao, data_inicio, hora_inicio, local_nome, imagem_capa, cidade, estado, tipo, link_transmissao } = req.body;

  try {
    const dataLimpa = data_inicio ? data_inicio.substring(0, 10) : null;
    const query = `
      UPDATE public.eventos 
      SET nome=$1, categoria=$2, descricao=$3, data_inicio=$4, local_nome=$5, imagem_capa=$6, cidade=$7, estado=$8, hora_inicio=$9, tipo=$10, link_transmissao=$11
      WHERE id=$12
    `;
    await db.query(query, [nome, categoria, descricao, dataLimpa, local_nome, imagem_capa, cidade, estado, hora_inicio, tipo, link_transmissao, id]);
    return res.status(200).json({ message: "Evento atualizado com sucesso" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};