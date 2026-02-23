const db = require('../config/database');

// --- 1. VITRINE DE COMUNIDADES (Transformando Eventos em Salas de Chat) ---
exports.getComunidadesVitrine = async (req, res) => {
  try {
    // AJUSTE: Filtro flexível para garantir que os eventos apareçam
    // mesmo que o status não seja exatamente 'Ativo'
    const query = `
      SELECT 
        e.id, 
        e.nome, 
        e.descricao,
        e.imagem_capa AS imagem_url,
        -- Conta membros reais do chat + um bônus de 120 para não parecer vazio
        (SELECT COUNT(DISTINCT usuario_nome) FROM mensagens_v2 WHERE evento_id = e.id) + 120 AS total_membros
      FROM public.eventos e
      WHERE e.status = 'Ativo' 
         OR e.status IS NULL 
         OR e.status = ''
      ORDER BY e.id DESC
      LIMIT 3
    `;
    
    const result = await db.query(query);
    
    // Log para você conferir no painel do Render se encontrou algo
    console.log(`🔎 Comunidades encontradas: ${result.rows.length}`);
    
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('❌ Erro ao buscar salas de chat (comunidades):', err.message);
    res.status(500).json({ error: 'Erro ao carregar salas de chat' });
  }
};

// --- 2. ENVIAR MENSAGEM (Chat) ---
exports.enviarMensagem = async (req, res) => {
  const { evento_id, usuario_nome, texto, imagem } = req.body;
  try {
    const query = `
      INSERT INTO mensagens_v2 (evento_id, usuario_nome, texto, imagem) 
      VALUES ($1, $2, $3, $4) 
      RETURNING *
    `;
    const values = [evento_id, usuario_nome, texto, imagem || null];
    const result = await db.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao salvar mensagem:', err);
    res.status(500).json({ error: 'Erro interno ao salvar mensagem' });
  }
};

// --- 3. LISTAR MENSAGENS (Chat) ---
exports.listarMensagensPorEvento = async (req, res) => {
  const { evento_id } = req.params;
  try {
    const result = await db.query(
      "SELECT * FROM mensagens_v2 WHERE evento_id = $1 ORDER BY criado_em ASC",
      [evento_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao listar mensagens:', err);
    res.status(500).json({ error: 'Erro ao buscar mensagens' });
  }
};

// --- 4. SISTEMA DE PRESENÇA (Online Agora) ---
exports.atualizarPresenca = async (req, res) => {
  const { id } = req.params; 
  const { usuario_nome } = req.query;
  if (!usuario_nome) return res.status(400).json({ error: "Nome necessário" });

  try {
    await db.query(`
      INSERT INTO presenca (evento_id, usuario_nome, ultima_vez)
      VALUES ($1, $2, NOW())
      ON CONFLICT (evento_id, usuario_nome) 
      DO UPDATE SET ultima_vez = NOW()
    `, [id, usuario_nome]);

    await db.query("DELETE FROM presenca WHERE ultima_vez < NOW() - INTERVAL '15 seconds'");

    const online = await db.query(
      "SELECT usuario_nome FROM presenca WHERE evento_id = $1", 
      [id]
    );
    res.json(online.rows);
  } catch (err) {
    console.error('Erro na presença:', err);
    res.status(500).json({ error: 'Erro ao processar presença' });
  }
};