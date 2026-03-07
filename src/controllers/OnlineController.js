const db = require('../config/database');

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

exports.criarEventoOnline = async (req, res) => {
  console.log('--- 🌐 Iniciando criação de Evento Online (Modo FormData) ---');

  let imagemFinal = null;

  // Prioridade 1: arquivo enviado via multer/s3
  if (req.file) {
    imagemFinal = req.file.location || req.file.filename || req.file.path;

    if (imagemFinal && !String(imagemFinal).startsWith('http')) {
      imagemFinal = req.file.filename;
    }
  }

  // Prioridade 2: fallback caso venha string no body
  if (!imagemFinal && req.body.imagem_capa) {
    const imgBody = req.body.imagem_capa;
    const isLixo =
      !imgBody ||
      imgBody === 'undefined' ||
      imgBody === 'null' ||
      String(imgBody).includes('/undefined') ||
      String(imgBody).includes('[object Object]');

    if (!isLixo) {
      imagemFinal =
        typeof imgBody === 'string' && imgBody.includes('/uploads/')
          ? imgBody.split('/uploads/').pop()
          : imgBody;
    }
  }

  const {
    produtor_email,
    nome,
    categoria,
    link_reuniao,
    descricao,
    data_inicio,
    hora_inicio,
    data_termino,
    hora_termino,
    status,
    tipo,
    local_nome,
    capacidade,
    regras,
    visibilidade,
    moeda
  } = req.body;

  console.log('📦 BODY RECEBIDO:', req.body);
  console.log('🖼️ FILE RECEBIDO:', req.file ? req.file.originalname : 'Nenhum arquivo');
  console.log('📧 produtor_email:', produtor_email);
  console.log('📝 nome:', nome);
  console.log('🔗 link_reuniao:', link_reuniao || 'vazio');
  console.log('🖼️ imagemFinal:', imagemFinal || 'sem imagem');

  if (!produtor_email || !nome) {
    return res.status(400).json({
      error: 'E-mail do produtor e nome do evento são obrigatórios.'
    });
  }

  try {
    const query = `
      INSERT INTO public.eventos (
        produtor_email,
        nome,
        categoria,
        link_reuniao,
        descricao,
        data_inicio,
        hora_inicio,
        data_termino,
        hora_termino,
        status,
        tipo,
        imagem_capa,
        local_nome,
        capacidade,
        regras,
        visibilidade,
        moeda
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
      )
      RETURNING id
    `;

    const values = [
      produtor_email.toLowerCase().trim(),
      limparCampo(nome, 'Novo Evento Online'),
      limparCampo(categoria, 'Geral'),
      limparCampo(link_reuniao, ''),
      limparCampo(descricao, ''),
      data_inicio || null,
      hora_inicio || null,
      data_termino || null,
      hora_termino || null,
      limparCampo(status, 'Ativo'),
      limparCampo(tipo, 'Online'),
      imagemFinal,
      limparCampo(local_nome, 'Plataforma Online'),
      parseInt(capacidade) || 0,
      limparCampo(regras, ''),
      limparCampo(visibilidade, 'Publico'),
      limparCampo(moeda, 'BRL')
    ];

    const result = await db.query(query, values);

    console.log(`✅ Evento Online criado com ID: ${result.rows[0].id}`);

    return res.status(201).json({
      id: result.rows[0].id,
      message: 'Evento Online registrado com sucesso!'
    });
  } catch (err) {
    console.error('❌ ERRO NO BANCO DE DADOS:', err.message);
    return res.status(500).json({
      error: 'Erro ao salvar evento online.',
      detalhe: err.message
    });
  }
};