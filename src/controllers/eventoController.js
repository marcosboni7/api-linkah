const db = require('../config/database');

// --- BUSCAR EVENTO POR ID ---
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

    // --- CORREÇÃO AQUI: NÃO USE 'new Date()' ---
    // Se o campo no banco for DATE ou TIMESTAMP, ele vem como objeto. 
    // Convertemos para String e pegamos apenas os 10 primeiros caracteres (YYYY-MM-DD)
    if (evento.data_inicio) {
      const d = new Date(evento.data_inicio);
      const ano = d.getFullYear();
      const mes = String(d.getMonth() + 1).padStart(2, '0');
      const dia = String(d.getDate()).padStart(2, '0');
      evento.data_inicio = `${ano}-${mes}-${dia}`;
    }

    // Garante que a hora_inicio não venha com fuso doido (pega apenas HH:mm)
    if (evento.hora_inicio && typeof evento.hora_inicio === 'string') {
      evento.hora_inicio = evento.hora_inicio.substring(0, 5);
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
    // Garante que estamos salvando apenas a data sem interferência de fuso
    const dataLimpa = data_inicio ? data_inicio.substring(0, 10) : null;
    
    // Garante que a hora seja apenas HH:mm
    const horaLimpa = hora_inicio ? hora_inicio.substring(0, 5) : null;

    const query = `
      UPDATE public.eventos 
      SET nome=$1, categoria=$2, descricao=$3, data_inicio=$4, local_nome=$5, imagem_capa=$6, cidade=$7, estado=$8, hora_inicio=$9, tipo=$10, link_transmissao=$11
      WHERE id=$12
    `;
    
    await db.query(query, [
      nome, categoria, descricao, dataLimpa, local_nome, 
      imagem_capa, cidade, estado, horaLimpa, tipo, link_transmissao, id
    ]);

    return res.status(200).json({ message: "Evento atualizado com sucesso" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};