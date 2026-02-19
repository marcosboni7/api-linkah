const db = require('../config/database');

// --- LISTAR TODOS OS EVENTOS (VITRINE) ---
exports.listarTodosEventosParaVitrine = async (req, res) => {
  try {
    const query = `
      SELECT id, nome, imagem_capa, data_inicio, hora_inicio, local_nome, cidade, estado, categoria, tipo, status
      FROM public.eventos 
      WHERE status = 'Ativo'
      ORDER BY data_inicio ASC
    `;
    const result = await db.query(query);
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error("❌ Erro ao listar vitrine:", err.message);
    return res.status(500).json({ error: err.message });
  }
};

// --- LISTAR EVENTOS POR PRODUTOR (DASHBOARD) ---
exports.listarEventosPorProdutor = async (req, res) => {
  const { email } = req.query; 
  
  if (!email) {
    return res.status(400).json({ error: "Email do produtor não fornecido" });
  }

  console.log(`\n--- 📊 BUSCANDO EVENTOS PARA O PRODUTOR: ${email} ---`);

  try {
    const query = `
      SELECT * FROM public.eventos 
      WHERE produtor_email = $1 
      ORDER BY data_inicio DESC
    `;
    const result = await db.query(query, [email]);
    
    console.log(`✅ Sucesso! Encontrados ${result.rowCount} eventos.`);
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error("❌ Erro ao listar eventos do produtor:", err.message);
    return res.status(500).json({ error: err.message });
  }
};

// --- BUSCAR EVENTO POR ID (PARA PÁGINA DE DETALHES) ---
exports.buscarEventoPorId = async (req, res) => {
  const { id } = req.params;

  // Garante que o ID é um número para não dar erro de sintaxe no Postgres
  const eventoId = parseInt(id);

  if (isNaN(eventoId)) {
    return res.status(400).json({ message: "ID inválido" });
  }

  try {
    console.log(`🔍 Buscando evento ID: ${eventoId}`);

    const query = `
      SELECT e.*, p.nome as produtor_nome, p.foto_perfil as produtor_foto
      FROM public.eventos e
      LEFT JOIN public.produtores p ON e.produtor_email = p.email
      WHERE e.id = $1
    `;
    const result = await db.query(query, [eventoId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Evento não encontrado" });
    }

    const evento = result.rows[0];

    // Tratamento de Data seguro (formato YYYY-MM-DD)
    if (evento.data_inicio) {
      const d = new Date(evento.data_inicio);
      evento.data_inicio = d.toISOString().split('T')[0];
    }

    // Tratamento de Hora seguro (HH:mm)
    if (evento.hora_inicio) {
      evento.hora_inicio = evento.hora_inicio.toString().substring(0, 5);
    }

    // Busca ingressos vinculados
    const resIng = await db.query(
      'SELECT * FROM public.ingressos WHERE evento_id = $1 ORDER BY preco ASC', 
      [eventoId]
    );
    evento.ingressos = resIng.rows;

    return res.status(200).json(evento);
  } catch (err) { 
    console.error("❌ Erro ao buscar ID:", err.message);
    return res.status(500).json({ error: err.message }); 
  }
};

// --- ATUALIZAR EVENTO ---
exports.atualizarEvento = async (req, res) => {
  const { id } = req.params;
  const { 
    nome, categoria, descricao, data_inicio, hora_inicio, 
    local_nome, imagem_capa, cidade, estado, tipo, link_transmissao, status 
  } = req.body;

  try {
    const dataLimpa = data_inicio ? data_inicio.substring(0, 10) : null;
    const horaLimpa = hora_inicio ? hora_inicio.toString().substring(0, 5) : null;

    const query = `
      UPDATE public.eventos 
      SET nome=$1, categoria=$2, descricao=$3, data_inicio=$4::DATE, 
          local_nome=$5, imagem_capa=$6, cidade=$7, estado=$8, 
          hora_inicio=$9::TIME, tipo=$10, link_transmissao=$11, status=$12
      WHERE id=$13
    `;
    
    const values = [
        nome, categoria, descricao, dataLimpa, local_nome, 
        imagem_capa, cidade, estado, horaLimpa, tipo, link_transmissao, status, id
    ];

    await db.query(query, values);
    return res.status(200).json({ message: "Evento atualizado com sucesso" });
  } catch (err) {
    console.error("❌ Erro ao atualizar:", err.message);
    return res.status(500).json({ error: err.message });
  }
};

// --- EXCLUIR EVENTO ---
exports.excluirEvento = async (req, res) => {
  const { id } = req.params;
  try {
    // Se o banco não tiver ON DELETE CASCADE, você precisaria deletar os ingressos primeiro aqui
    await db.query('DELETE FROM public.ingressos WHERE evento_id = $1', [id]);
    await db.query('DELETE FROM public.eventos WHERE id = $1', [id]);
    
    res.status(200).json({ message: "Excluído com sucesso" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// --- ATUALIZAR STATUS ---
exports.atualizarStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    await db.query('UPDATE public.eventos SET status = $1 WHERE id = $2', [status, id]);
    res.status(200).json({ message: "Status atualizado" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// --- SALVAR INGRESSOS ---
exports.salvarIngressos = async (req, res) => {
  const { id } = req.params;
  const { ingressos } = req.body; // Espera um array de objetos

  try {
    // Deleta os antigos e insere os novos (estratégia simples)
    await db.query('DELETE FROM public.ingressos WHERE evento_id = $1', [id]);

    for (const ing of ingressos) {
      await db.query(
        'INSERT INTO public.ingressos (evento_id, nome, preco, quantidade) VALUES ($1, $2, $3, $4)',
        [id, ing.nome, ing.preco, ing.quantidade]
      );
    }

    res.status(200).json({ message: "Ingressos salvos com sucesso" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// --- CRIAR EVENTO PRESENCIAL ---
exports.criarEventoPresencial = async (req, res) => {
    const { nome, produtor_email, categoria, descricao, data_inicio, hora_inicio, local_nome, imagem_capa, cidade, estado } = req.body;
    try {
        const query = `
            INSERT INTO public.eventos 
            (nome, produtor_email, categoria, descricao, data_inicio, hora_inicio, local_nome, imagem_capa, cidade, estado, tipo, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'presencial', 'Ativo')
            RETURNING id
        `;
        const result = await db.query(query, [nome, produtor_email, categoria, descricao, data_inicio, hora_inicio, local_nome, imagem_capa, cidade, estado]);
        res.status(201).json({ message: "Evento criado!", id: result.rows[0].id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};