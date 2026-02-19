const db = require('../config/database');

// --- 1. LISTAR PARA VITRINE (SITE PÚBLICO) ---
exports.listarTodosEventosParaVitrine = async (req, res) => {
  try {
    const { categoria } = req.query;
    
    let query = `
      SELECT id, nome, categoria, local_nome, cidade, estado, imagem_capa, data_inicio, hora_inicio 
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

// --- 3. CRIAR EVENTO PRESENCIAL (CORRIGIDO: SALVA INGRESSOS JUNTO) ---
exports.criarEventoPresencial = async (req, res) => {
  try {
    const {
      produtor_email, nome, categoria, status, descricao,
      data_inicio, hora_inicio, data_termino, hora_termino,
      local_nome, cep, endereco, numero, complemento,
      cidade, estado, imagem_capa, ingressos // Recebendo ingressos aqui
    } = req.body;

    // 1. Salva o Evento
    const queryEvento = `
      INSERT INTO public.eventos (
        produtor_email, nome, categoria, status, descricao,
        data_inicio, hora_inicio, data_termino, hora_termino,
        local_nome, cep, endereco, numero, complemento, 
        cidade, estado, imagem_capa, tipo
      ) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'Presencial')
      RETURNING id;
    `;

    // Limpeza de data para evitar bug de fuso horário (21h)
    const dataIniLimpa = data_inicio ? data_inicio.substring(0, 10) : null;
    const dataFimLimpa = data_termino ? data_termino.substring(0, 10) : null;

    const valuesEvento = [
      produtor_email, nome, categoria || 'Geral', status || 'Ativo', descricao, 
      dataIniLimpa, hora_inicio || '00:00:00', 
      dataFimLimpa, hora_termino || '23:59:59',
      local_nome, cep, endereco, numero, complemento, cidade, estado, imagem_capa
    ];

    const resultEvento = await db.query(queryEvento, valuesEvento);
    const novoEventoId = resultEvento.rows[0].id;

    // 2. Salva os Ingressos automaticamente se eles vierem no corpo da requisição
    if (ingressos && Array.isArray(ingressos) && ingressos.length > 0) {
      for (const ing of ingressos) {
        await db.query(
          'INSERT INTO public.ingressos (evento_id, nome, preco, quantidade) VALUES ($1, $2, $3, $4)', 
          [novoEventoId, ing.nome, ing.preco || 0, ing.quantidade || 0]
        );
      }
    }

    return res.status(201).json({ id: novoEventoId, message: "Evento e ingressos criados com sucesso!" });

  } catch (err) {
    console.error("❌ ERRO AO CRIAR EVENTO:", err.message);
    return res.status(500).json({ error: "Erro ao salvar evento e ingressos", detalhe: err.message });
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

// --- 5. ATUALIZAR EVENTO (CORRIGIDO) ---
exports.atualizarEvento = async (req, res) => {
  const { id } = req.params;
  const { 
    nome, categoria, descricao, data_inicio, hora_inicio, 
    local_nome, imagem_capa, cidade, estado 
  } = req.body;

  try {
    const query = `
      UPDATE public.eventos 
      SET nome=$1, categoria=$2, descricao=$3, data_inicio=$4, 
          local_nome=$5, imagem_capa=$6, cidade=$7, estado=$8, hora_inicio=$9
      WHERE id=$10
    `;
    
    const dataLimpa = data_inicio ? data_inicio.substring(0, 10) : null;

    await db.query(query, [
      nome, categoria, descricao, dataLimpa, 
      local_nome, imagem_capa, cidade, estado, hora_inicio, id
    ]);

    return res.status(200).json({ message: "Evento atualizado com sucesso" });
  } catch (err) {
    console.error("❌ ERRO AO ATUALIZAR:", err.message);
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
    // IMPORTANTE: Se o seu banco não tiver ON DELETE CASCADE, 
    // você precisa deletar os ingressos antes do evento.
    await db.query('DELETE FROM public.ingressos WHERE evento_id = $1', [id]);
    await db.query('DELETE FROM public.eventos WHERE id = $1', [id]);
    return res.status(200).json({ message: "Removido" });
  } catch (err) { 
    return res.status(500).json({ error: err.message }); 
  }
};

// --- 8. SALVAR INGRESSOS (INDIVIDUALMENTE SE NECESSÁRIO) ---
exports.salvarIngressos = async (req, res) => {
  const { id } = req.params;
  const { ingressos } = req.body;
  try {
    // Limpa os antigos para não duplicar se for uma re-edição
    await db.query('DELETE FROM public.ingressos WHERE evento_id = $1', [id]);
    
    for (const ing of ingressos) {
      await db.query(
        'INSERT INTO public.ingressos (evento_id, nome, preco, quantidade) VALUES ($1, $2, $3, $4)', 
        [id, ing.nome, ing.preco || 0, ing.quantidade || 0]
      );
    }
    return res.status(201).json({ message: "Ingressos salvos com sucesso" });
  } catch (err) { 
    console.error("Erro ao salvar ingressos:", err.message);
    return res.status(500).json({ error: err.message }); 
  }
};