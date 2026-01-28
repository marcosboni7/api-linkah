const db = require('../config/database');

// --- 1. LISTAR PARA VITRINE (SITE PÚBLICO) ---
// --- LISTAR PARA VITRINE COM FILTRO DE CATEGORIA ---
exports.listarTodosEventosParaVitrine = async (req, res) => {
  try {
    const { categoria } = req.query; // Pega a categoria da URL: ?categoria=Teatro
    
    let query = `
      SELECT id, nome, categoria, local_nome, cidade, estado, imagem_capa, data_inicio 
      FROM public.eventos 
      WHERE status = 'Ativo'
    `;
    
    const params = [];
    if (categoria && categoria !== 'Todos') {
      query += ` AND categoria = $1`;
      params.push(categoria);
    }

    query += ` ORDER BY id DESC`;

    const result = await db.query(query, params);
    const eventos = result.rows;

    for (let evento of eventos) {
      const resPreco = await db.query(
        'SELECT MIN(preco) as min_p FROM public.ingressos WHERE evento_id = $1', 
        [evento.id]
      );
      evento.preco_minimo = resPreco.rows[0]?.min_p || 0;
    }

    return res.status(200).json(eventos);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// --- 2. LISTAR POR PRODUTOR (DASHBOARD) ---
exports.listarEventosPorProdutor = async (req, res) => {
  const { email } = req.query;
  try {
    const query = 'SELECT * FROM public.eventos WHERE produtor_email = $1 ORDER BY id DESC';
    const result = await db.query(query, [email]);
    const eventos = result.rows;

    for (let evento of eventos) {
      const resIng = await db.query('SELECT nome, preco, quantidade FROM public.ingressos WHERE evento_id = $1', [evento.id]);
      evento.ingressos = resIng.rows;
      evento.total_vagas = evento.ingressos.reduce((acc, ing) => acc + (parseInt(ing.quantidade) || 0), 0);
    }
    return res.status(200).json(eventos);
  } catch (err) {
    console.error("Erro ao listar:", err.message);
    return res.status(500).json({ message: "Erro ao listar" });
  }
};

// --- 3. CRIAR EVENTO PRESENCIAL ---
exports.criarEventoPresencial = async (req, res) => {
  let client;
  try {
    // Usamos o pool para garantir que a conexão não "morra" no meio
    const {
      produtor_email, nome, categoria, status, descricao,
      data_inicio, hora_inicio, data_termino, hora_termino,
      local_nome, cep, endereco, numero, complemento,
      cidade, estado, imagem_capa 
    } = req.body;

    // Log de segurança para ver se a data está bizarra
    console.log("📅 Tentando criar evento para data:", data_inicio);

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
      produtor_email, nome, categoria || 'Geral', status || 'Ativo', 
      descricao, 
      data_inicio.substring(0, 10), // Força o formato YYYY-MM-DD
      hora_inicio, 
      data_termino.substring(0, 10), 
      hora_termino,
      local_nome, cep, endereco, numero, complemento, cidade, estado, imagem_capa
    ];

    const result = await db.query(query, values);
    console.log("✅ Evento criado com ID:", result.rows[0].id);
    return res.status(201).json({ id: result.rows[0].id });

  } catch (err) {
    console.error("❌ ERRO CRÍTICO NO BANCO:", err.message);
    return res.status(500).json({ 
      error: "Erro ao salvar no banco de dados", 
      detalhe: err.message 
    });
  }
};

// --- 4. ATUALIZAR STATUS ---
exports.atualizarStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    await db.query('UPDATE public.eventos SET status = $1 WHERE id = $2', [status, id]);
    return res.status(200).json({ message: "Status atualizado" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// --- 5. ATUALIZAR EVENTO ---
exports.atualizarEvento = async (req, res) => {
  const { id } = req.params;
  const campos = req.body;
  try {
    // Uma forma simples de update dinâmico (opcional) ou fixa:
    const query = `
      UPDATE public.eventos 
      SET nome=$1, categoria=$2, descricao=$3, data_inicio=$4, local_nome=$5, imagem_capa=$6
      WHERE id=$7
    `;
    await db.query(query, [
      campos.nome, campos.categoria, campos.descricao, 
      campos.data_inicio, campos.local_nome, campos.imagem_capa, id
    ]);
    return res.status(200).json({ message: "Evento atualizado" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// --- 6. BUSCAR EVENTO POR ID ---
exports.buscarEventoPorId = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('SELECT * FROM public.eventos WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: "Não encontrado" });
    const evento = result.rows[0];
    const resIng = await db.query('SELECT * FROM public.ingressos WHERE evento_id = $1', [id]);
    evento.ingressos = resIng.rows;
    return res.status(200).json(evento);
  } catch (err) { 
    return res.status(500).json({ error: err.message }); 
  }
};

// --- 7. EXCLUIR EVENTO ---
exports.excluirEvento = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM public.eventos WHERE id = $1', [id]);
    return res.status(200).json({ message: "Removido" });
  } catch (err) { 
    return res.status(500).json({ error: err.message }); 
  }
};

// --- 8. SALVAR INGRESSOS ---
exports.salvarIngressos = async (req, res) => {
  const { id } = req.params;
  const { ingressos } = req.body;
  try {
    // Limpa ingressos antigos antes de salvar os novos se for uma atualização
    // await db.query('DELETE FROM public.ingressos WHERE evento_id = $1', [id]);
    
    for (const ing of ingressos) {
      await db.query(
        'INSERT INTO public.ingressos (evento_id, nome, preco, quantidade) VALUES ($1, $2, $3, $4)', 
        [id, ing.nome, ing.preco || 0, ing.quantidade || 0]
      );
    }
    return res.status(201).json({ message: "Salvo" });
  } catch (err) { 
    console.error("Erro ao salvar ingressos:", err.message);
    return res.status(500).json({ error: err.message }); 
  }
};