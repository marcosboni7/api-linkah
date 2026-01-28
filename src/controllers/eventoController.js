const db = require('../config/database');

// --- 1. LISTAR PARA VITRINE (SITE PÚBLICO) ---
exports.listarTodosEventosParaVitrine = async (req, res) => {
  try {
    // Seleciona as colunas conforme seu CREATE TABLE
    const query = `
      SELECT id, nome, categoria, local_nome, cidade, estado, imagem_capa, data_inicio 
      FROM public.eventos 
      WHERE status = 'Ativo' 
      ORDER BY id DESC
    `;
    const result = await db.query(query);
    const eventos = result.rows;

    // Busca o menor preço para cada evento
    for (let evento of eventos) {
      const resPreco = await db.query(
        'SELECT MIN(preco) as min_p FROM public.ingressos WHERE evento_id = $1', 
        [evento.id]
      );
      evento.preco_minimo = resPreco.rows[0]?.min_p || 0;
    }

    return res.status(200).json(eventos);
  } catch (err) {
    console.error("Erro na vitrine:", err.message);
    return res.status(500).json({ error: "Erro interno", detalhe: err.message });
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
    return res.status(500).json({ message: "Erro ao listar" });
  }
};

// --- 3. CRIAR EVENTO ---
exports.criarEventoPresencial = async (req, res) => {
  try {
    const {
      produtor_email, nome, categoria, status, descricao,
      data_inicio, hora_inicio, data_termino, hora_termino,
      local_nome, cep, endereco, numero, complemento,
      cidade, estado, imagem_capa 
    } = req.body;

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
      descricao, data_inicio, hora_inicio, data_termino, hora_termino,
      local_nome, cep, endereco, numero, complemento, cidade, estado, imagem_capa
    ];

    const result = await db.query(query, values);
    return res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// --- FUNÇÕES DE APOIO (STATUS, BUSCA, EXCLUIR) ---
exports.buscarEventoPorId = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('SELECT * FROM public.eventos WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: "Não encontrado" });
    const evento = result.rows[0];
    const resIng = await db.query('SELECT * FROM public.ingressos WHERE evento_id = $1', [id]);
    evento.ingressos = resIng.rows;
    return res.status(200).json(evento);
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

exports.excluirEvento = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM public.eventos WHERE id = $1', [id]);
    return res.status(200).json({ message: "Removido" });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

exports.salvarIngressos = async (req, res) => {
  const { id } = req.params;
  const { ingressos } = req.body;
  try {
    for (const ing of ingressos) {
      await db.query('INSERT INTO public.ingressos (evento_id, nome, preco, quantidade) VALUES ($1, $2, $3, $4)', 
      [id, ing.nome, ing.preco || 0, ing.quantidade || 0]);
    }
    return res.status(201).json({ message: "Salvo" });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};