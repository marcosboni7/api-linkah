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
    const result = await db.query(query, [email.replace(/['"]+/g, '').trim().toLowerCase()]);
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

    if (evento.data_inicio) evento.data_inicio = new Date(evento.data_inicio).toISOString().split('T')[0];
    if (evento.hora_inicio) evento.hora_inicio = evento.hora_inicio.toString().substring(0, 5);

    const resIng = await db.query('SELECT * FROM public.ingressos WHERE evento_id = $1 ORDER BY preco ASC', [eventoId]);
    evento.ingressos = resIng.rows;

    return res.status(200).json(evento);
  } catch (err) { 
    return res.status(500).json({ error: err.message }); 
  }
};

// --- 4. CRIAR EVENTO PRESENCIAL ---
exports.criarEventoPresencial = async (req, res) => {
  // Se houver Multer configurado na rota de criação, pegamos req.file
  const imagemFinal = req.file ? (req.file.location || req.file.path) : req.body.imagem_capa;
  
  const { 
    nome, produtor_email, categoria, descricao, data_inicio, 
    hora_inicio, local_nome, cidade, estado, moeda 
  } = req.body;
  
  if (categoria && !CATEGORIAS_VALIDAS.includes(categoria)) {
    return res.status(400).json({ error: `Categoria inválida.` });
  }

  try {
    const query = `
      INSERT INTO public.eventos 
      (nome, produtor_email, categoria, descricao, data_inicio, hora_inicio, local_nome, imagem_capa, cidade, estado, tipo, status, moeda)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'presencial', 'Ativo', $11)
      RETURNING id
    `;
    const result = await db.query(query, [
      nome || 'Novo Evento', 
      produtor_email, 
      categoria || 'Entretenimento', 
      descricao || '', 
      data_inicio, 
      hora_inicio, 
      local_nome || '', 
      imagemFinal || null, 
      cidade || '', 
      estado || '', 
      moeda || 'BRL'
    ]);
    res.status(201).json({ message: "Evento criado!", id: result.rows[0].id });
  } catch (err) {
    console.error("❌ Erro ao criar:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// --- 5. ATUALIZAR EVENTO (SISTEMA ANTI-BUG DE NOME E IMAGEM) ---
exports.atualizarEvento = async (req, res) => {
  const { id } = req.params;

  try {
    // Busca dados atuais para não perder nada se o Front enviar vazio
    const check = await db.query('SELECT * FROM public.eventos WHERE id = $1', [id]);
    if (check.rowCount === 0) return res.status(404).json({ error: "Evento não encontrado" });
    const atual = check.rows[0];

    // Lógica da Imagem: Prioridade 1 (Novo Arquivo), Prioridade 2 (URL enviada), Prioridade 3 (Mantém a que já existe)
    let imagemFinal = atual.imagem_capa;
    if (req.file) {
      imagemFinal = req.file.location || req.file.path || req.file.filename;
      // Se for local, garante a URL
      if (!req.file.location && !imagemFinal.startsWith('http')) {
        imagemFinal = `https://zmn9xuwd4y.us-east-1.awsapprunner.com/uploads/${imagemFinal}`;
      }
    } else if (req.body.imagem_capa) {
      imagemFinal = req.body.imagem_capa;
    }

    // Tratamento de campos para evitar "undefined" no banco
    const nome = (req.body.nome && req.body.nome !== 'undefined') ? req.body.nome : atual.nome;
    const categoria = (req.body.categoria && req.body.categoria !== 'undefined') ? req.body.categoria : atual.categoria;
    const descricao = req.body.descricao !== undefined ? req.body.descricao : atual.descricao;
    const local_nome = req.body.local_nome !== undefined ? req.body.local_nome : atual.local_nome;
    const cidade = req.body.cidade !== undefined ? req.body.cidade : atual.cidade;
    const estado = req.body.estado !== undefined ? req.body.estado : atual.estado;
    const moeda = req.body.moeda !== undefined ? req.body.moeda : atual.moeda;
    const status = req.body.status !== undefined ? req.body.status : atual.status;
    const link_transmissao = req.body.link_transmissao !== undefined ? req.body.link_transmissao : atual.link_transmissao;

    const data_inicio = (req.body.data_inicio && req.body.data_inicio !== "null" && req.body.data_inicio !== "undefined") 
      ? String(req.body.data_inicio).substring(0, 10) 
      : atual.data_inicio;

    const hora_inicio = (req.body.hora_inicio && req.body.hora_inicio !== "undefined") 
      ? String(req.body.hora_inicio).substring(0, 5) 
      : atual.hora_inicio;

    const query = `
      UPDATE public.eventos 
      SET 
        nome = $1, categoria = $2, descricao = $3, data_inicio = $4, 
        local_nome = $5, imagem_capa = $6, cidade = $7, estado = $8, 
        hora_inicio = $9, link_transmissao = $10, status = $11, moeda = $12
      WHERE id = $13
      RETURNING *
    `;
    
    const values = [
      nome, categoria, descricao, data_inicio, 
      local_nome, imagemFinal, cidade, estado, 
      hora_inicio, link_transmissao, status, moeda,
      id
    ];

    const result = await db.query(query, values);
    return res.status(200).json({ message: "Evento atualizado com sucesso", evento: result.rows[0] });

  } catch (err) {
    console.error("❌ Erro ao atualizar:", err.message);
    return res.status(500).json({ error: "Erro interno no servidor" });
  }
};

// --- 6. EXCLUIR EVENTO ---
exports.excluirEvento = async (req, res) => {
  const { id } = req.params;
  try {
    // Exclui ingressos primeiro por causa da chave estrangeira
    await db.query('DELETE FROM public.ingressos WHERE evento_id = $1', [id]);
    const resDel = await db.query('DELETE FROM public.eventos WHERE id = $1', [id]);
    
    if (resDel.rowCount === 0) return res.status(404).json({ error: "Evento não encontrado" });
    
    res.status(200).json({ message: "Excluído com sucesso" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// --- 7. SALVAR INGRESSOS ---
exports.salvarIngressos = async (req, res) => {
  const { id } = req.params;
  const { ingressos, moeda_evento } = req.body; 

  try {
    await db.query('DELETE FROM public.ingressos WHERE evento_id = $1', [id]);
    if (ingressos && Array.isArray(ingressos)) {
      for (const ing of ingressos) {
        await db.query(
          'INSERT INTO public.ingressos (evento_id, nome, preco, quantidade, moeda) VALUES ($1, $2, $3, $4, $5)',
          [id, ing.nome, ing.preco || 0, ing.quantidade || 0, moeda_evento || 'BRL']
        );
      }
    }
    if (moeda_evento) {
      await db.query('UPDATE public.eventos SET moeda = $1 WHERE id = $2', [moeda_evento, id]);
    }
    res.status(200).json({ message: "Ingressos salvos!" });
  } catch (err) {
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