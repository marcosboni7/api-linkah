const db = require('../config/database');

// Lista oficial de categorias (Sincronizada com o Front-end)
const CATEGORIAS_VALIDAS = [
  'Arte & Cultura',
  'Entretenimento',
  'Negócios',
  'Educação & Desenvolvimento',
  'Esportes & Bem-estar',
  'Experiências & Lifestyle',
  'Família & Comunidade'
];

// --- 1. LISTAR TODOS OS EVENTOS (VITRINE COM PREÇO E MOEDA) ---
exports.listarTodosEventosParaVitrine = async (req, res) => {
  try {
    const query = `
      SELECT 
        e.id, e.nome, e.imagem_capa, e.data_inicio, e.hora_inicio, 
        e.local_nome, e.cidade, e.estado, e.categoria, e.tipo, e.status, e.moeda,
        MIN(i.preco) as preco_minimo
      FROM public.eventos e
      LEFT JOIN public.ingressos i ON e.id = i.evento_id
      WHERE e.status = 'Ativo'
      GROUP BY e.id, e.moeda
      ORDER BY e.id DESC
    `;
    const result = await db.query(query);
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error("❌ Erro ao listar vitrine:", err.message);
    return res.status(500).json({ error: err.message });
  }
};

// --- 2. LISTAR EVENTOS POR PRODUTOR (DASHBOARD) ---
exports.listarEventosPorProdutor = async (req, res) => {
  const { email } = req.query; 
  if (!email) return res.status(400).json({ error: "Email não fornecido" });

  try {
    const query = `
      SELECT * FROM public.eventos 
      WHERE produtor_email = $1 
      ORDER BY data_inicio DESC
    `;
    const result = await db.query(query, [email]);
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error("❌ Erro ao listar eventos do produtor:", err.message);
    return res.status(500).json({ error: err.message });
  }
};

// --- 3. BUSCAR EVENTO POR ID (DETALHES) ---
exports.buscarEventoPorId = async (req, res) => {
  const { id } = req.params;
  const eventoId = parseInt(id);

  if (isNaN(eventoId)) return res.status(400).json({ message: "ID inválido" });

  try {
    const query = `
      SELECT e.*, p.nome as produtor_nome, p.foto_perfil as produtor_foto
      FROM public.eventos e
      LEFT JOIN public.produtores p ON e.produtor_email = p.email
      WHERE e.id = $1
    `;
    const result = await db.query(query, [eventoId]);

    if (result.rows.length === 0) return res.status(404).json({ message: "Evento não encontrado" });

    const evento = result.rows[0];

    // Formatação de data/hora para o Front
    if (evento.data_inicio) evento.data_inicio = new Date(evento.data_inicio).toISOString().split('T')[0];
    if (evento.hora_inicio) evento.hora_inicio = evento.hora_inicio.toString().substring(0, 5);

    const resIng = await db.query('SELECT * FROM public.ingressos WHERE evento_id = $1 ORDER BY preco ASC', [eventoId]);
    evento.ingressos = resIng.rows;

    return res.status(200).json(evento);
  } catch (err) { 
    return res.status(500).json({ error: err.message }); 
  }
};

// --- 4. CRIAR EVENTO ---
exports.criarEventoPresencial = async (req, res) => {
  const { nome, produtor_email, categoria, descricao, data_inicio, hora_inicio, local_nome, imagem_capa, cidade, estado } = req.body;
  
  if (!CATEGORIAS_VALIDAS.includes(categoria)) {
    return res.status(400).json({ error: `Categoria inválida. Use uma destas: ${CATEGORIAS_VALIDAS.join(', ')}` });
  }

  try {
    const query = `
      INSERT INTO public.eventos 
      (nome, produtor_email, categoria, descricao, data_inicio, hora_inicio, local_nome, imagem_capa, cidade, estado, tipo, status, moeda)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'presencial', 'Ativo', 'BRL')
      RETURNING id
    `;
    const result = await db.query(query, [nome, produtor_email, categoria, descricao, data_inicio, hora_inicio, local_nome, imagem_capa, cidade, estado]);
    res.status(201).json({ message: "Evento criado!", id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// --- 5. ATUALIZAR EVENTO ---
exports.atualizarEvento = async (req, res) => {
  const { id } = req.params;
  const { 
    nome, categoria, descricao, data_inicio, hora_inicio, 
    local_nome, imagem_capa, cidade, estado, tipo, link_transmissao, status 
  } = req.body;

  if (categoria && !CATEGORIAS_VALIDAS.includes(categoria)) {
    return res.status(400).json({ error: "A categoria fornecida não é permitida pelo novo sistema." });
  }

  try {
    const dataLimpa = (data_inicio && data_inicio.trim() !== "") ? data_inicio.substring(0, 10) : null;
    const horaLimpa = (hora_inicio && hora_inicio.toString().trim() !== "") ? hora_inicio.toString().substring(0, 5) : null;

    const query = `
      UPDATE public.eventos 
      SET 
        nome = $1, categoria = $2, descricao = $3, data_inicio = $4, 
        local_nome = $5, imagem_capa = $6, cidade = $7, estado = $8, 
        hora_inicio = $9, tipo = $10, link_transmissao = $11, status = $12
      WHERE id = $13
      RETURNING *
    `;
    
    const values = [
      nome || 'Sem nome', 
      categoria || 'Entretenimento', 
      descricao || '', 
      dataLimpa, 
      local_nome || '', 
      imagem_capa || null, 
      cidade || '', 
      estado || '', 
      horaLimpa, 
      tipo || 'presencial', 
      link_transmissao || null, 
      status || 'Ativo', 
      id
    ];

    const result = await db.query(query, values);
    if (result.rowCount === 0) return res.status(404).json({ error: "Evento não encontrado." });

    return res.status(200).json({ message: "Atualizado com sucesso", evento: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ error: "Erro interno no servidor", detalhes: err.message });
  }
};

// --- 6. EXCLUIR EVENTO ---
exports.excluirEvento = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM public.ingressos WHERE evento_id = $1', [id]);
    await db.query('DELETE FROM public.eventos WHERE id = $1', [id]);
    res.status(200).json({ message: "Excluído com sucesso" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// --- 7. SALVAR INGRESSOS (PREÇOS E MOEDA) ---
exports.salvarIngressos = async (req, res) => {
  const { id } = req.params;
  const { ingressos, moeda_evento } = req.body; // moeda_evento vem do Front agora

  try {
    // 1. Limpa ingressos antigos
    await db.query('DELETE FROM public.ingressos WHERE evento_id = $1', [id]);

    // 2. Salva os novos ingressos com a moeda individual
    if (ingressos && Array.isArray(ingressos)) {
      for (const ing of ingressos) {
        await db.query(
          'INSERT INTO public.ingressos (evento_id, nome, preco, quantidade, moeda) VALUES ($1, $2, $3, $4, $5)',
          [id, ing.nome, ing.preco || 0, ing.quantidade || 0, ing.moeda || 'BRL']
        );
      }
    }

    // 3. ATUALIZA A MOEDA PRINCIPAL DO EVENTO (Para a Vitrine funcionar)
    if (moeda_evento) {
      await db.query('UPDATE public.eventos SET moeda = $1 WHERE id = $2', [moeda_evento, id]);
    }

    res.status(200).json({ message: "Ingressos e moeda do evento salvos com sucesso!" });
  } catch (err) {
    console.error("❌ Erro ao salvar ingressos/moeda:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// --- 8. ATUALIZAR STATUS ---
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