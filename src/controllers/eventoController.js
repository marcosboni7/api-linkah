const db = require('../config/database');

// --- NOVA FUNÇÃO: LISTAR TUDO PARA A VITRINE ---
exports.listarTodosEventosParaVitrine = async (req, res) => {
  try {
    // 1. Buscamos todos os eventos
    // Nota: Use "imagem_capa" ou o nome EXATO que está na sua tabela
    const query = 'SELECT * FROM public.eventos ORDER BY id DESC';
    const result = await db.query(query);
    const eventos = result.rows;

    // 2. Buscamos o preço mínimo sem deixar o erro 500 acontecer
    const eventosComPreco = await Promise.all(eventos.map(async (evento) => {
      try {
        const resPreco = await db.query(
          'SELECT MIN(preco) as preco_minimo FROM public.ingressos WHERE evento_id = $1', 
          [evento.id]
        );
        return {
          ...evento,
          preco_minimo: resPreco.rows[0].preco_minimo || 0
        };
      } catch (errIngresso) {
        // Se a tabela de ingressos der erro, o evento ainda aparece com preço 0
        return { ...evento, preco_minimo: 0 };
      }
    }));

    return res.status(200).json(eventosComPreco);
  } catch (err) {
    // Esse log vai aparecer lá no painel do Render em azul/preto
    console.error("ERRO CRÍTICO NA VITRINE:", err.message);
    return res.status(500).json({ 
      error: "Erro interno no servidor", 
      detalhe: err.message 
    });
  }
};

// --- RESTANTE DAS SUAS FUNÇÕES (MANTIDAS) ---
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
      produtor_email, nome || 'Sem Nome', categoria || 'Outros',
      status || 'Ativo', descricao || '', data_inicio || null,
      hora_inicio || null, data_termino || null, hora_termino || null,
      local_nome || '', cep || '', endereco || '', numero || '',
      complemento || '', cidade || '', estado || '', imagem_capa || null
    ];

    const result = await db.query(query, values);
    return res.status(201).json({ message: "Sucesso", id: result.rows[0].id });
  } catch (err) {
    return res.status(500).json({ message: "Erro interno", error: err.message });
  }
};

exports.salvarIngressos = async (req, res) => {
  const { id } = req.params;
  const { ingressos } = req.body;
  try {
    for (const ing of ingressos) {
      const query = `INSERT INTO public.ingressos (evento_id, nome, preco, quantidade) VALUES ($1, $2, $3, $4)`;
      await db.query(query, [id, ing.nome, ing.preco || 0, ing.quantidade || 0]);
    }
    return res.status(201).json({ message: "Ingressos salvos" });
  } catch (err) {
    return res.status(500).json({ message: "Erro nos ingressos" });
  }
};

exports.listarEventosPorProdutor = async (req, res) => {
  const { email } = req.query;
  try {
    const queryEventos = 'SELECT * FROM public.eventos WHERE produtor_email = $1 ORDER BY id DESC';
    const resultEventos = await db.query(queryEventos, [email]);
    const eventos = resultEventos.rows;
    for (let evento of eventos) {
      const queryIng = 'SELECT nome, preco, quantidade FROM public.ingressos WHERE evento_id = $1';
      const resultIng = await db.query(queryIng, [evento.id]);
      evento.ingressos = resultIng.rows;
      evento.total_vagas = evento.ingressos.reduce((acc, ing) => acc + (parseInt(ing.quantidade) || 0), 0);
    }
    return res.status(200).json(eventos);
  } catch (err) {
    return res.status(500).json({ message: "Erro ao listar" });
  }
};

exports.buscarEventoPorId = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('SELECT * FROM public.eventos WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: "Nao encontrado" });
    const evento = result.rows[0];
    const resultIng = await db.query('SELECT nome, preco, quantidade FROM public.ingressos WHERE evento_id = $1', [id]);
    evento.ingressos = resultIng.rows;
    return res.status(200).json(evento);
  } catch (err) {
    return res.status(500).json({ message: "Erro ao buscar" });
  }
};

exports.atualizarEvento = async (req, res) => {
  const { id } = req.params;
  const { nome, categoria, status, descricao, data_inicio, hora_inicio, local_nome, cidade, estado } = req.body;
  try {
    const query = `UPDATE public.eventos SET nome=$1, categoria=$2, status=$3, descricao=$4, data_inicio=$5, hora_inicio=$6, local_nome=$7, cidade=$8, estado=$9 WHERE id=$10`;
    await db.query(query, [nome, categoria, status, descricao, data_inicio, hora_inicio, local_nome, cidade, estado, id]);
    return res.status(200).json({ message: "Atualizado" });
  } catch (err) {
    return res.status(500).json({ message: "Erro ao atualizar" });
  }
};

exports.excluirEvento = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM public.ingressos WHERE evento_id = $1', [id]);
    await db.query('DELETE FROM public.eventos WHERE id = $1', [id]);
    return res.status(200).json({ message: "Removido" });
  } catch (err) {
    return res.status(500).json({ message: "Erro ao excluir" });
  }
};

exports.atualizarStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    await db.query('UPDATE public.eventos SET status = $1 WHERE id = $2', [status, id]);
    return res.status(200).json({ message: "Status OK" });
  } catch (err) {
    return res.status(500).json({ message: "Erro status" });
  }
};