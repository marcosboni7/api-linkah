const db = require('../config/database');

// --- 1. CRIAR EVENTO ---
exports.criarEventoPresencial = async (req, res) => {
  try {
    const {
      produtor_email, nome, categoria, status, descricao,
      data_inicio, hora_inicio, data_termino, hora_termino,
      local_nome, cep, endereco, numero, complemento,
      cidade, estado, imagem_capa 
    } = req.body;

    if (!produtor_email) {
      return res.status(400).json({ message: "Email do produtor e obrigatorio" });
    }

    const query = `
      INSERT INTO public.eventos (
        produtor_email, nome, categoria, status, descricao,
        data_inicio, hora_inicio, data_termino, hora_termino,
        local_nome, cep, endereco, numero, complemento, 
        cidade, estado, imagem_capa, tipo
      ) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'Presencial')
      RETURNING id;
    `;

    const values = [
      produtor_email, nome || 'Sem Nome', categoria || 'Outros',
      status || 'Ativo', descricao || '', data_inicio || null,
      hora_inicio || null, data_termino || null, hora_termino || null,
      local_nome || '', cep || '', endereco || '', numero || '',
      complemento || '', cidade || '', estado || '', imagem_capa || null
    ];

    const result = await db.query(query, values);
    return res.status(201).json({ message: "Sucesso", id: result.rows[0].id });
  } catch (err) {
    console.error("Erro ao criar:", err.message);
    return res.status(500).json({ message: "Erro interno", error: err.message });
  }
};

// --- 2. SALVAR INGRESSOS ---
exports.salvarIngressos = async (req, res) => {
  const { id } = req.params;
  const { ingressos } = req.body;
  try {
    if (!ingressos || ingressos.length === 0) {
      return res.status(200).json({ message: "Sem ingressos" });
    }
    for (const ing of ingressos) {
      const query = `INSERT INTO public.ingressos (evento_id, nome, preco, quantidade) VALUES ($1, $2, $3, $4)`;
      await db.query(query, [id, ing.nome, ing.preco || 0, ing.quantidade || 0]);
    }
    return res.status(201).json({ message: "Ingressos salvos" });
  } catch (err) {
    console.error("Erro ingressos:", err.message);
    return res.status(500).json({ message: "Erro nos ingressos" });
  }
};

// --- 3. LISTAR EVENTOS (AGORA COM INGRESSOS) ---
exports.listarEventosPorProdutor = async (req, res) => {
  const { email } = req.query;
  try {
    // 1. Busca os eventos
    const queryEventos = 'SELECT * FROM public.eventos WHERE produtor_email = $1 ORDER BY id DESC';
    const resultEventos = await db.query(queryEventos, [email]);
    const eventos = resultEventos.rows;

    // 2. Para cada evento, busca seus respectivos ingressos
    for (let evento of eventos) {
      const queryIngressos = 'SELECT nome, preco, quantidade FROM public.ingressos WHERE evento_id = $1';
      const resultIng = await db.query(queryIngressos, [evento.id]);
      evento.ingressos = resultIng.rows; // Adiciona a lista de ingressos dentro do objeto do evento
    }

    return res.status(200).json(eventos);
  } catch (err) {
    console.error("Erro ao listar:", err.message);
    return res.status(500).json({ message: "Erro ao listar" });
  }
};

// --- 4. BUSCAR POR ID (AGORA COM INGRESSOS) ---
exports.buscarEventoPorId = async (req, res) => {
  const { id } = req.params;
  try {
    const query = 'SELECT * FROM public.eventos WHERE id = $1';
    const result = await db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Nao encontrado" });
    }

    const evento = result.rows[0];
    // Busca os ingressos deste evento específico
    const queryIngressos = 'SELECT nome, preco, quantidade FROM public.ingressos WHERE evento_id = $1';
    const resultIng = await db.query(queryIngressos, [id]);
    evento.ingressos = resultIng.rows;

    return res.status(200).json(evento);
  } catch (err) {
    return res.status(500).json({ message: "Erro ao buscar" });
  }
};

// --- 5. ATUALIZAR EVENTO ---
exports.atualizarEvento = async (req, res) => {
  const { id } = req.params;
  const { 
    nome, categoria, status, descricao, 
    data_inicio, hora_inicio, local_nome, 
    cidade, estado 
  } = req.body;
  try {
    const query = `
      UPDATE public.eventos 
      SET nome=$1, categoria=$2, status=$3, descricao=$4, 
          data_inicio=$5, hora_inicio=$6, local_nome=$7, 
          cidade=$8, estado=$9
      WHERE id=$10
    `;
    await db.query(query, [nome, categoria, status, descricao, data_inicio, hora_inicio, local_nome, cidade, estado, id]);
    return res.status(200).json({ message: "Atualizado" });
  } catch (err) {
    return res.status(500).json({ message: "Erro ao atualizar" });
  }
};

// --- 6. EXCLUIR EVENTO ---
exports.excluirEvento = async (req, res) => {
  const { id } = req.params;
  try {
    // Primeiro removemos os ingressos para evitar erro de chave estrangeira
    await db.query('DELETE FROM public.ingressos WHERE evento_id = $1', [id]);
    // Depois removemos o evento
    await db.query('DELETE FROM public.eventos WHERE id = $1', [id]);
    return res.status(200).json({ message: "Removido" });
  } catch (err) {
    return res.status(500).json({ message: "Erro ao excluir" });
  }
};

// --- 7. EDITAR STATUS ---
exports.atualizarStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    await db.query('UPDATE public.eventos SET status = $1 WHERE id = $2', [status, id]);
    return res.status(200).json({ message: "Status OK" });
  } catch (err) {
    console.error("Erro status:", err.message);
    return res.status(500).json({ message: "Erro status" });
  }
};