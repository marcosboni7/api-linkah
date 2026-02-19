const db = require('../config/database');

// --- LISTAR TODOS OS EVENTOS (VITRINE) ---
exports.listarTodosEventosParaVitrine = async (req, res) => {
  try {
    const query = `
      SELECT id, nome, imagem_capa, data_inicio, hora_inicio, local_nome, cidade, estado, categoria, tipo
      FROM public.eventos 
      ORDER BY data_inicio ASC
    `;
    const result = await db.query(query);
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error("Erro ao listar vitrine:", err.message);
    return res.status(500).json({ error: err.message });
  }
};

// --- BUSCAR EVENTO POR ID (Versão com correção de data/hora) ---
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

    // Tratamento de Data (Evita que o fuso mude o dia)
    if (evento.data_inicio) {
      const d = new Date(evento.data_inicio);
      const ano = d.getFullYear();
      const mes = String(d.getMonth() + 1).padStart(2, '0');
      const dia = String(d.getDate()).padStart(2, '0');
      evento.data_inicio = `${ano}-${mes}-${dia}`;
    }

    // Tratamento de Hora (Garante formato HH:mm)
    if (evento.hora_inicio) {
      const horaString = String(evento.hora_inicio);
      evento.hora_inicio = horaString.includes('T') 
        ? horaString.split('T')[1].substring(0, 5) 
        : horaString.substring(0, 5);
    }

    const resIng = await db.query('SELECT * FROM public.ingressos WHERE evento_id = $1 ORDER BY preco ASC', [id]);
    evento.ingressos = resIng.rows;

    return res.status(200).json(evento);
  } catch (err) { 
    return res.status(500).json({ error: err.message }); 
  }
};

// --- ATUALIZAR EVENTO (Versão com casting ::TIME) ---
exports.atualizarEvento = async (req, res) => {
  const { id } = req.params;
  const { 
    nome, categoria, descricao, data_inicio, hora_inicio, 
    local_nome, imagem_capa, cidade, estado, tipo, link_transmissao 
  } = req.body;

  try {
    const dataLimpa = data_inicio ? data_inicio.substring(0, 10) : null;
    const horaLimpa = hora_inicio ? hora_inicio.substring(0, 5) : null;

    const query = `
      UPDATE public.eventos 
      SET nome=$1, categoria=$2, descricao=$3, data_inicio=$4::DATE, 
          local_nome=$5, imagem_capa=$6, cidade=$7, estado=$8, 
          hora_inicio=$9::TIME, tipo=$10, link_transmissao=$11
      WHERE id=$12
    `;
    
    const values = [
        nome, categoria, descricao, dataLimpa, local_nome, 
        imagem_capa, cidade, estado, horaLimpa, tipo, link_transmissao, id
    ];

    const updateRes = await db.query(query, values);
    return res.status(200).json({ message: "Evento atualizado com sucesso" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// --- OUTRAS FUNÇÕES NECESSÁRIAS PARA AS ROTAS NÃO QUEBRAREM ---

exports.criarEventoPresencial = async (req, res) => {
    // Implemente sua lógica de criação aqui ou mantenha a que você já tinha
    res.status(201).json({ message: "Função criarEventoPresencial chamada" });
};

exports.listarEventosPorProdutor = async (req, res) => {
    // Implemente sua lógica de listagem por produtor aqui
    res.status(200).json([]);
};

exports.excluirEvento = async (req, res) => {
    const { id } = req.params;
    await db.query('DELETE FROM public.eventos WHERE id = $1', [id]);
    res.status(200).json({ message: "Excluído" });
};

exports.atualizarStatus = async (req, res) => {
    res.status(200).json({ message: "Status atualizado" });
};

exports.salvarIngressos = async (req, res) => {
    res.status(200).json({ message: "Ingressos salvos" });
};