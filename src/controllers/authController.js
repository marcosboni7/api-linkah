const db = require('../config/database');

// --- 1. CRIAR EVENTO (PASSO 1) ---
exports.criarEventoPresencial = async (req, res) => {
  console.log("--- 🎫 Recebendo Novo Evento ---");
  try {
    const {
      produtor_email, nome, categoria, status, descricao,
      data_inicio, hora_inicio, data_termino, hora_termino,
      local_nome, cep, endereco, numero, complemento,
      cidade, estado, imagem_capa 
    } = req.body;

    if (!produtor_email) {
      return res.status(400).json({ message: "E-mail do produtor é obrigatório." });
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
      produtor_email, nome || 'Evento Sem Nome', categoria || 'Outros',
      status || 'Ativo', descricao || '', data_inicio || null,
      hora_inicio || null, data_termino || null, hora_termino || null,
      local_nome || '', cep || '', endereco || '', numero || '',
      complemento || '', cidade || '', estado || '', imagem_capa || null
    ];

    const result = await db.query(query, values);
    console.log(`✅ Evento criado! ID: ${result.rows[0].id}`);
    
    return res.status(201).json({ message: "Sucesso", id: result.rows[0].id });
  } catch (err) {
    console.error("❌ ERRO AO CRIAR:", err.message);
    return res.status(500).json({ message: "Erro interno", error: err.message });
  }
};

// --- 2. SALVAR INGRESSOS (PASSO 2) ---
exports.salvarIngressos = async (req, res) => {
  const { id } = req.params;
  const { ingressos } = req.body;
  try {
    if (!ingressos || ingressos.length === 0) {
        return res.status(200).json({ message: "Nenhum ingresso para salvar." });
    }

    for (const ing of ingressos) {
      const query = `INSERT INTO public.ingressos (evento_id, nome, preco, quantidade) VALUES ($1, $2, $3, $4)`;
      await db.query(query, [id, ing.nome, ing.preco || 0, ing.quantidade || 0]);
    }
    console.log(`✅ Ingressos salvos para o evento ${id}`);
    return res.status(201).json({ message: "Ingressos salvos!" });
  } catch (err) {
    console.error("❌ ERRO INGRESSOS:", err.message);
    return res.status(500).json({ message: "Erro ao salvar ingressos" });
  }
};

// --- 3. LISTAR EVENTOS (DASHBOARD) ---
// AJUSTADO: Trocado 'criado_at' por 'id' para evitar erro 500 no Postgres
exports.listarEventosPorProdutor = async (req, res) => {
  const { email } = req.query;
  try {
    console.log(`🔎 Buscando eventos para o e-mail: ${email}`);
    const query = 'SELECT * FROM public.eventos WHERE produtor_email = $1 ORDER BY id DESC';
    const result = await db.query(query, [email]);
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error("❌ ERRO AO LISTAR:", err.message);
    return res.status(500).json({ message: "Erro ao listar", error: err.message });
  }
};

// --- 4. BUSCAR UM EVENTO PELO ID (PARA O MODAL) ---
exports.buscarEventoPorId = async (req, res) => {
  const { id } = req.params;
  try {
    const query = 'SELECT * FROM public.eventos WHERE id = $1';
    const result = await db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Evento não encontrado" });
    }
    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error("❌ ERRO AO BUSCAR ID:", err.message);
    return res.status(500).json({ message: "Erro ao buscar detalhes" });
  }
};

// --- 5. ATUALIZAR EVENTO COMPLETO (SALVAR MODAL) ---
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
    const values = [
      nome, categoria, status, descricao, 
      data_inicio, hora_inicio, local_nome, 
      cidade, estado, id
    ];

    await db.query(query, values);
    console.log(`✅ Evento ${id} atualizado com sucesso!`);
    return res.status(200).json({ message: "Evento atualizado com sucesso!" });
  } catch (err) {
    console.error("❌ ERRO AO ATUALIZAR:", err.message);
    return res.status(500).json({ message: "Erro ao atualizar evento" });
  }
};

// --- 6. EXCLUIR EVENTO ---
exports.excluirEvento = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM public.eventos WHERE id = $1', [id]);
    console.log(`🗑️ Evento ${id} removido.`);
    return res.status(200).json({ message: "Removido com sucesso" });
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
    return res.status(200).json({ message: "Status atualizado" });
  } catch (err) {
    return res.status(500).json({ message: "Erro ao editar status" });
  }
};