const db = require('../config/database');

// Lista oficial de categorias
const CATEGORIAS_VALIDAS = [
  'Arte & Cultura',
  'Entretenimento',
  'Negócios',
  'Educação & Desenvolvimento',
  'Esportes & Bem-estar',
  'Experiências & Lifestyle',
  'Família & Comunidade'
];

// Função auxiliar para evitar que strings de erro do Front-end entrem no Banco
const limparCampo = (valor, fallback, label) => {
  if (valor === undefined || valor === null || valor === 'undefined' || valor === 'null' || valor === '') {
    // console.log(`[DEBUG] Campo ${label} inválido, usando fallback.`);
    return fallback;
  }
  return valor;
};

// --- 1. LISTAR TODOS OS EVENTOS (VITRINE) ---
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
  console.log("[DEBUG] Listando eventos para o email:", email);

  if (!email) return res.status(400).json({ error: "Email não fornecido" });

  try {
    const emailLimpo = email.replace(/['"]+/g, '').trim().toLowerCase();
    const query = `
      SELECT * FROM public.eventos 
      WHERE produtor_email = $1 
      ORDER BY id DESC
    `;
    const result = await db.query(query, [emailLimpo]);
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error("❌ Erro ao listar eventos do produtor:", err.message);
    return res.status(500).json({ error: err.message });
  }
};

// --- 3. BUSCAR EVENTO POR ID ---
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
    if (result.rows.length === 0) return res.status(404).json({ message: "Evento não encontrado" });

    const evento = result.rows[0];
    if (evento.data_inicio) evento.data_inicio = new Date(evento.data_inicio).toISOString().split('T')[0];
    
    const resIng = await db.query('SELECT * FROM public.ingressos WHERE evento_id = $1 ORDER BY preco ASC', [id]);
    evento.ingressos = resIng.rows;

    return res.status(200).json(evento);
  } catch (err) { 
    return res.status(500).json({ error: err.message }); 
  }
};

// --- 4. CRIAR EVENTO ---
exports.criarEventoPresencial = async (req, res) => {
  console.log("[DEBUG] Criando evento. Body:", req.body);
  console.log("[DEBUG] Arquivo recebido:", req.file ? req.file.originalname : "Nenhum");

  const imagemFinal = req.file ? (req.file.location || req.file.path) : req.body.imagem_capa;
  
  const { 
    nome, produtor_email, categoria, descricao, data_inicio, 
    hora_inicio, local_nome, cidade, estado, moeda 
  } = req.body;

  try {
    const query = `
      INSERT INTO public.eventos 
      (nome, produtor_email, categoria, descricao, data_inicio, hora_inicio, local_nome, imagem_capa, cidade, estado, tipo, status, moeda)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'presencial', 'Ativo', $11)
      RETURNING id
    `;
    const result = await db.query(query, [
      limparCampo(nome, 'Novo Evento', 'nome'), 
      produtor_email, 
      limparCampo(categoria, 'Entretenimento', 'categoria'), 
      limparCampo(descricao, '', 'descricao'), 
      data_inicio, 
      hora_inicio, 
      limparCampo(local_nome, '', 'local_nome'), 
      imagemFinal || null, 
      limparCampo(cidade, '', 'cidade'), 
      limparCampo(estado, '', 'estado'), 
      moeda || 'BRL'
    ]);
    res.status(201).json({ message: "Evento criado!", id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// --- 5. ATUALIZAR EVENTO (COM DEBUG E ANTI-BUG) ---
exports.atualizarEvento = async (req, res) => {
  const { id } = req.params;

  // LOGS DE DEBUG NO TERMINAL AWS
  console.log(`\n--- [DEBUG START] ATUALIZANDO EVENTO ID: ${id} ---`);
  console.log("Headers:", req.headers['content-type']);
  console.log("Body Recebido:", JSON.stringify(req.body));
  console.log("Arquivo (req.file):", req.file ? {
    nome: req.file.originalname,
    path: req.file.path,
    location: req.file.location
  } : "Nenhum arquivo enviado");

  try {
    // Busca dados atuais para persistência
    const check = await db.query('SELECT * FROM public.eventos WHERE id = $1', [id]);
    if (check.rowCount === 0) {
      console.log("[DEBUG] Evento não encontrado no Banco.");
      return res.status(404).json({ error: "Evento não encontrado" });
    }
    const atual = check.rows[0];

    // Lógica da Imagem
    let imagemFinal = atual.imagem_capa;
    if (req.file) {
      imagemFinal = req.file.location || req.file.path || req.file.filename;
      if (!req.file.location && !imagemFinal.startsWith('http')) {
        imagemFinal = `https://zmn9xuwd4y.us-east-1.awsapprunner.com/uploads/${imagemFinal}`;
      }
      console.log("[DEBUG] Nova imagem processada:", imagemFinal);
    } else {
      imagemFinal = limparCampo(req.body.imagem_capa, atual.imagem_capa, 'imagem_capa');
    }

    // Tratamento Anti-Bug
    const nome = limparCampo(req.body.nome, atual.nome, 'nome');
    const categoria = limparCampo(req.body.categoria, atual.categoria, 'categoria');
    const descricao = limparCampo(req.body.descricao, atual.descricao, 'descricao');
    const local_nome = limparCampo(req.body.local_nome, atual.local_nome, 'local_nome');
    const cidade = limparCampo(req.body.cidade, atual.cidade, 'cidade');
    const estado = limparCampo(req.body.estado, atual.estado, 'estado');
    const moeda = limparCampo(req.body.moeda, atual.moeda, 'moeda');
    const status = limparCampo(req.body.status, atual.status, 'status');

    const data_inicio = (req.body.data_inicio && req.body.data_inicio !== "null" && req.body.data_inicio !== "undefined") 
      ? String(req.body.data_inicio).substring(0, 10) 
      : atual.data_inicio;

    const query = `
      UPDATE public.eventos 
      SET 
        nome = $1, categoria = $2, descricao = $3, data_inicio = $4, 
        local_nome = $5, imagem_capa = $6, cidade = $7, estado = $8, 
        status = $9, moeda = $10
      WHERE id = $11
      RETURNING *
    `;
    
    const values = [
      nome, categoria, descricao, data_inicio, 
      local_nome, imagemFinal, cidade, estado, 
      status, moeda, id
    ];

    const result = await db.query(query, values);
    
    console.log("[DEBUG] Update concluído. Nome salvo:", result.rows[0].nome);
    console.log("--- [DEBUG END] ---\n");

    return res.status(200).json({ message: "Atualizado!", evento: result.rows[0] });

  } catch (err) {
    console.error("❌ ERRO CRÍTICO NO UPDATE:", err);
    return res.status(500).json({ error: "Erro interno no servidor" });
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