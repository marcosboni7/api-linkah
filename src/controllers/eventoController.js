const db = require('../config/database');

// --- BUSCAR EVENTO POR ID ---
exports.buscarEventoPorId = async (req, res) => {
  const { id } = req.params;
  console.log(`[GET] Buscando evento ID: ${id}`);

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
    
    console.log("--- DADOS BRUTOS DO BANCO ---");
    console.log("data_inicio (raw):", evento.data_inicio);
    console.log("hora_inicio (raw):", evento.hora_inicio);

    // Tratamento de Data
    if (evento.data_inicio) {
      const d = new Date(evento.data_inicio);
      const ano = d.getFullYear();
      const mes = String(d.getMonth() + 1).padStart(2, '0');
      const dia = String(d.getDate()).padStart(2, '0');
      evento.data_inicio = `${ano}-${mes}-${dia}`;
    }

    // Tratamento de Hora
    if (evento.hora_inicio) {
      // Força virar string e pega apenas HH:mm
      evento.hora_inicio = String(evento.hora_inicio).substring(0, 5);
    }

    console.log("--- DADOS TRATADOS ENVIADOS PARA O FRONT ---");
    console.log("data_inicio (final):", evento.data_inicio);
    console.log("hora_inicio (final):", evento.hora_inicio);

    const resIng = await db.query('SELECT * FROM public.ingressos WHERE evento_id = $1 ORDER BY preco ASC', [id]);
    evento.ingressos = resIng.rows;

    return res.status(200).json(evento);
  } catch (err) { 
    console.error("[ERRO GET]:", err.message);
    return res.status(500).json({ error: err.message }); 
  }
};

// --- ATUALIZAR EVENTO ---
exports.atualizarEvento = async (req, res) => {
  const { id } = req.params;
  const { nome, categoria, descricao, data_inicio, hora_inicio, local_nome, imagem_capa, cidade, estado, tipo, link_transmissao } = req.body;

  console.log(`[PUT] Atualizando evento ID: ${id}`);
  console.log("BODY RECEBIDO DO FRONT:", { data_inicio, hora_inicio });

  try {
    const dataLimpa = data_inicio ? data_inicio.substring(0, 10) : null;
    const horaLimpa = hora_inicio ? hora_inicio.substring(0, 5) : null;

    console.log("VALORES QUE SERÃO SALVOS NO DB:", { dataLimpa, horaLimpa });

    const query = `
      UPDATE public.eventos 
      SET nome=$1, categoria=$2, descricao=$3, data_inicio=$4, local_nome=$5, imagem_capa=$6, cidade=$7, estado=$8, hora_inicio=$9, tipo=$10, link_transmissao=$11
      WHERE id=$12
    `;
    
    const values = [
        nome, categoria, descricao, dataLimpa, local_nome, 
        imagem_capa, cidade, estado, horaLimpa, tipo, link_transmissao, id
    ];

    const updateRes = await db.query(query, values);
    
    console.log("Resultado do UPDATE (rowCount):", updateRes.rowCount);

    return res.status(200).json({ message: "Evento atualizado com sucesso" });
  } catch (err) {
    console.error("[ERRO PUT]:", err.message);
    return res.status(500).json({ error: err.message });
  }
};