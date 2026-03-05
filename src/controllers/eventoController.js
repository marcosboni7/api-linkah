const db = require('../config/database');

const CATEGORIAS_VALIDAS = [
  'Arte & Cultura', 'Entretenimento', 'Negócios', 
  'Educação & Desenvolvimento', 'Esportes & Bem-estar', 
  'Experiências & Lifestyle', 'Família & Comunidade'
];

// Função de limpeza para evitar lixo no banco
const limparCampo = (valor, fallback) => {
  if (
    valor === undefined || 
    valor === null || 
    valor === 'undefined' || 
    valor === 'null' || 
    String(valor).trim() === '' ||
    String(valor).includes('[object Object]')
  ) {
    return fallback;
  }
  return valor;
};

// --- 1. LISTAR TODOS OS EVENTOS (VITRINE) ---
exports.listarTodosEventosParaVitrine = async (req, res) => {
  try {
    const query = `
      SELECT 
        e.id, e.nome, 
        CASE 
          WHEN e.imagem_capa ILIKE '%undefined%' OR e.imagem_capa ILIKE '%null%' THEN NULL 
          ELSE e.imagem_capa 
        END as imagem_capa, 
        e.data_inicio, e.hora_inicio, 
        e.local_nome, e.cidade, e.estado, e.categoria, e.tipo, e.status, e.moeda,
        COALESCE(MIN(i.preco), 0) as preco_minimo
      FROM public.eventos e
      LEFT JOIN public.ingressos i ON e.id = i.evento_id
      WHERE e.status ILIKE 'Ativo'
      GROUP BY e.id, e.nome, e.imagem_capa, e.data_inicio, e.hora_inicio, 
                e.local_nome, e.cidade, e.estado, e.categoria, e.tipo, e.status, e.moeda
      ORDER BY e.id DESC
    `;
    const result = await db.query(query);
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error("❌ Erro ao listar vitrine:", err.message);
    return res.status(500).json({ error: err.message });
  }
};

// --- 2. LISTAR EVENTOS POR PRODUTOR ---
exports.listarEventosPorProdutor = async (req, res) => {
  const { email } = req.query; 
  if (!email) return res.status(400).json({ error: "Email não fornecido" });

  try {
    const emailLimpo = email.replace(/['"]+/g, '').trim().toLowerCase();
    const query = `
      SELECT *, 
      CASE 
        WHEN imagem_capa ILIKE '%undefined%' OR imagem_capa ILIKE '%null%' THEN NULL 
        ELSE imagem_capa 
      END as imagem_capa 
      FROM public.eventos 
      WHERE produtor_email = $1 
      ORDER BY id DESC
    `;
    const result = await db.query(query, [emailLimpo]);
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error("❌ Erro ao listar por produtor:", err.message);
    return res.status(500).json({ error: err.message });
  }
};

// --- 3. BUSCAR EVENTO POR ID ---
exports.buscarEventoPorId = async (req, res) => {
  const { id } = req.params;
  try {
    const query = `
      SELECT e.*, 
      CASE 
        WHEN e.imagem_capa ILIKE '%undefined%' OR e.imagem_capa ILIKE '%null%' THEN NULL 
        ELSE e.imagem_capa 
      END as imagem_capa,
      p.nome as produtor_nome, p.foto_perfil as produtor_foto
      FROM public.eventos e
      LEFT JOIN public.produtores p ON e.produtor_email = p.email
      WHERE e.id = $1
    `;
    const result = await db.query(query, [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: "Evento não encontrado" });

    const evento = result.rows[0];
    if (evento.data_inicio) {
        evento.data_inicio = new Date(evento.data_inicio).toISOString().split('T')[0];
    }
    
    const resIng = await db.query('SELECT * FROM public.ingressos WHERE evento_id = $1 ORDER BY preco ASC', [id]);
    evento.ingressos = resIng.rows;

    return res.status(200).json(evento);
  } catch (err) { 
    console.error("❌ Erro ao buscar por ID:", err.message);
    return res.status(500).json({ error: err.message }); 
  }
};

// --- 4. CRIAR EVENTO PRESENCIAL (CORRIGIDO PARA 22 COLUNAS) ---
exports.criarEventoPresencial = async (req, res) => {
  console.log("--- 🚀 INICIANDO CRIAÇÃO DE EVENTO ---");
  
  let imagemFinal = null;
  if (req.file) {
    imagemFinal = req.file.location || req.file.filename || req.file.path;
    if (imagemFinal && !String(imagemFinal).startsWith('http')) {
      imagemFinal = req.file.filename;
    }
  }

  const { 
    nome, produtor_email, categoria, descricao, data_inicio, 
    hora_inicio, data_termino, hora_termino, local_nome, 
    cep, endereco, numero, complemento, cidade, estado, 
    capacidade, moeda, tipo, regras, visibilidade 
  } = req.body;

  try {
    const query = `
      INSERT INTO public.eventos 
      (
        nome, produtor_email, categoria, descricao, data_inicio, 
        hora_inicio, data_termino, hora_termino, local_nome, 
        cep, endereco, numero, complemento, cidade, estado, 
        capacidade, imagem_capa, tipo, status, moeda, 
        regras, visibilidade
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
      RETURNING id
    `;
    
    const values = [
      limparCampo(nome, 'Novo Evento'), 
      produtor_email ? produtor_email.toLowerCase() : null, 
      limparCampo(categoria, 'Entretenimento'), 
      limparCampo(descricao, ''), 
      data_inicio || null, 
      hora_inicio || null,
      data_termino || null,
      hora_termino || null,
      limparCampo(local_nome, ''), 
      limparCampo(cep, ''),
      limparCampo(endereco, ''),
      limparCampo(numero, ''),
      limparCampo(complemento, ''),
      limparCampo(cidade, ''), 
      limparCampo(estado, ''), 
      parseInt(capacidade) || 0,
      imagemFinal, 
      tipo || 'Presencial',
      'Ativo', 
      moeda || 'BRL',
      limparCampo(regras, ''),
      visibilidade || 'Publico'
    ];

    const result = await db.query(query, values);
    console.log("✅ Evento salvo com sucesso! ID:", result.rows[0].id);
    res.status(201).json({ message: "Evento criado!", id: result.rows[0].id });

  } catch (err) {
    console.error("❌ ERRO NO INSERT (500):", err.message);
    res.status(500).json({ error: err.message, detail: err.detail });
  }
};

// --- 5. ATUALIZAR EVENTO ---
exports.atualizarEvento = async (req, res) => {
  const { id } = req.params;
  
  try {
    const check = await db.query('SELECT * FROM public.eventos WHERE id = $1', [id]);
    if (check.rowCount === 0) return res.status(404).json({ error: "Evento não encontrado" });
    const atual = check.rows[0];

    let imagemFinal = atual.imagem_capa;

    if (req.file) {
      const arquivo = req.file.location || req.file.filename || req.file.path;
      imagemFinal = String(arquivo).startsWith('http') ? arquivo : req.file.filename;
    } else if (req.body.imagem_capa) {
      const imgBody = req.body.imagem_capa;
      const isLixo = !imgBody || imgBody === "undefined" || imgBody === "null" || String(imgBody).includes("/undefined");
      if (!isLixo) {
        imagemFinal = typeof imgBody === 'string' && imgBody.includes('/uploads/') ? imgBody.split('/uploads/').pop() : imgBody;
      }
    }

    const values = [
      limparCampo(req.body.nome, atual.nome),
      limparCampo(req.body.categoria, atual.categoria),
      limparCampo(req.body.descricao, atual.descricao),
      (req.body.data_inicio && req.body.data_inicio !== "null") ? String(req.body.data_inicio).substring(0, 10) : (atual.data_inicio ? new Date(atual.data_inicio).toISOString().substring(0, 10) : null),
      limparCampo(req.body.local_nome, atual.local_nome),
      imagemFinal,
      limparCampo(req.body.cidade, atual.cidade),
      limparCampo(req.body.estado, atual.estado),
      limparCampo(req.body.status, atual.status),
      limparCampo(req.body.moeda, atual.moeda),
      id
    ];

    const queryUpdate = `
      UPDATE public.eventos 
      SET nome = $1, categoria = $2, descricao = $3, data_inicio = $4, 
          local_nome = $5, imagem_capa = $6, cidade = $7, estado = $8, 
          status = $9, moeda = $10
      WHERE id = $11
      RETURNING *
    `;
    
    const result = await db.query(queryUpdate, values);
    res.status(200).json({ message: "Atualizado!", evento: result.rows[0] });

  } catch (err) {
    console.error("❌ ERRO NO UPDATE:", err.message);
    return res.status(500).json({ error: err.message });
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
    console.error("❌ Erro ao excluir:", err.message);
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
    console.error("❌ Erro ao salvar ingressos:", err.message);
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
    console.error("❌ Erro status:", err.message);
    res.status(500).json({ error: err.message }); 
  }
};