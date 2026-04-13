const db = require('../config/database');
const Groq = require("groq-sdk");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const CATEGORIAS_VALIDAS = [
  'Arte & Cultura',
  'Entretenimento',
  'Negócios',
  'Educação & Desenvolvimento',
  'Esportes & Bem-estar',
  'Experiências & Lifestyle',
  'Família & Comunidade'
];

const MOEDAS_VALIDAS = ['BRL', 'EUR', 'USD'];

// --- UTILS ---
const limparCampo = (valor, fallback = '') => {
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
  return String(valor).trim();
};

const limparNumero = (valor, fallback = 0) => {
  const numero = parseInt(valor, 10);
  return Number.isNaN(numero) ? fallback : numero;
};

const normalizarEmail = (email) => {
  const emailLimpo = limparCampo(email, '');
  return emailLimpo ? emailLimpo.toLowerCase() : null;
};

const normalizarCategoria = (categoria) => {
  const categoriaLimpa = limparCampo(categoria, 'Entretenimento');
  return CATEGORIAS_VALIDAS.includes(categoriaLimpa)
    ? categoriaLimpa
    : 'Entretenimento';
};

const normalizarData = (valor) => {
  if (!valor || valor === 'undefined' || valor === 'null') return null;
  const dataRaw = String(valor).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(dataRaw)) return dataRaw;
  if (/^\d{4}-\d{2}-\d{2}T/.test(dataRaw)) return dataRaw.split('T')[0];
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dataRaw)) {
    const [dia, mes, ano] = dataRaw.split('/');
    return `${ano}-${mes}-${dia}`;
  }
  const d = new Date(dataRaw);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  return null;
};

const normalizarHora = (valor) => {
  if (!valor || valor === 'undefined' || valor === 'null') return null;
  const hora = String(valor).trim();
  if (/^\d{2}:\d{2}$/.test(hora) || /^\d{2}:\d{2}:\d{2}$/.test(hora)) return hora;
  return hora.substring(0, 8);
};

const normalizarMoeda = (valor, fallback = 'BRL') => {
  const moeda = limparCampo(valor, fallback).toUpperCase();
  if (['R$', 'REAL', 'REAIS'].includes(moeda)) return 'BRL';
  if (['€', 'EURO', 'EUROS'].includes(moeda)) return 'EUR';
  if (['$', 'DOLAR', 'DÓLAR', 'DOLARES', 'DÓLARES'].includes(moeda)) return 'USD';
  return MOEDAS_VALIDAS.includes(moeda) ? moeda : fallback;
};

const obterMoedaDoBody = (body = {}, fallback = 'BRL') => {
  return normalizarMoeda(body.moeda_evento || body.moeda || body.currency, fallback);
};

const obterImagemFinal = (req, campo, imagemAtual = null) => {
  let imagemFinal = imagemAtual;
  if (req.files && req.files[campo]) {
    const file = req.files[campo][0];
    imagemFinal = file.path || file.secure_url || file.url || imagemAtual;
  } else if (req.body[campo]) {
    const imgBody = req.body[campo];
    const isLixo =
      !imgBody ||
      imgBody === 'undefined' ||
      imgBody === 'null' ||
      String(imgBody).includes('/undefined') ||
      String(imgBody).includes('[object Object]');
    if (!isLixo) imagemFinal = String(imgBody).trim();
  }
  return imagemFinal;
};

const parsePreco = (valor) => {
  if (valor === '' || valor === null || valor === undefined) return 0;
  if (typeof valor === 'number') return Number.isNaN(valor) ? 0 : valor;
  let raw = String(valor).trim().replace(/[^\d,.-]/g, '');
  if (raw.includes('.') && raw.includes(',')) {
    raw = raw.replace(/\./g, '').replace(',', '.');
  } else if (raw.includes(',')) {
    raw = raw.replace(',', '.');
  }
  const parsed = parseFloat(raw);
  return Number.isNaN(parsed) ? 0 : parsed;
};

// ========================================
// 1. LISTAR VITRINE (CORRIGIDO)
// ========================================
exports.listarTodosEventosParaVitrine = async (req, res) => {
  try {
    const query = `
      SELECT
        e.id, e.nome,
        CASE
          WHEN e.imagem_capa ILIKE '%undefined%' OR e.imagem_capa ILIKE '%null%' THEN NULL
          ELSE e.imagem_capa
        END AS imagem_capa,
        TO_CHAR(e.data_inicio, 'YYYY-MM-DD') AS data_inicio,
        e.hora_inicio, e.local_nome, e.cidade, e.estado, e.categoria, e.tipo, e.status, e.moeda,
        COALESCE(
          (SELECT MIN(CAST(i.preco AS NUMERIC)) FROM public.ingressos i WHERE i.evento_id = e.id AND CAST(i.preco AS NUMERIC) > 0),
          0
        ) AS preco_minimo,
        EXISTS (SELECT 1 FROM public.ingressos i WHERE i.evento_id = e.id AND CAST(i.preco AS NUMERIC) = 0) AS possui_gratuito
      FROM public.eventos e
      WHERE e.status ILIKE 'Ativo'
      ORDER BY e.id DESC
    `;
    const result = await db.query(query);
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('❌ Erro vitrine:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

// ========================================
// 2. LISTAR POR PRODUTOR (COM IMAGEM CAPA)
// ========================================
exports.listarEventosPorProdutor = async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'Email não fornecido' });

  try {
    const emailLimpo = String(email).replace(/['"]+/g, '').trim().toLowerCase();

    const query = `
      SELECT
        e.id,
        e.nome,
        e.produtor_email,
        e.categoria,
        e.descricao,
        CASE
          WHEN e.imagem_capa ILIKE '%undefined%' OR e.imagem_capa ILIKE '%null%' THEN NULL
          ELSE e.imagem_capa
        END AS imagem_capa,
        TO_CHAR(e.data_inicio, 'YYYY-MM-DD') AS data_inicio,
        e.status,
        e.moeda,
        e.cidade,
        e.local_nome,
        COALESCE(
          (
            SELECT MIN(CAST(i.preco AS NUMERIC))
            FROM public.ingressos i
            WHERE i.evento_id = e.id
              AND CAST(i.preco AS NUMERIC) > 0
          ),
          0
        ) AS preco_minimo,
        EXISTS (
          SELECT 1
          FROM public.ingressos i
          WHERE i.evento_id = e.id
            AND CAST(i.preco AS NUMERIC) = 0
        ) AS possui_gratuito
      FROM public.eventos e
      WHERE TRIM(LOWER(e.produtor_email)) = $1
      ORDER BY e.id DESC
    `;

    const result = await db.query(query, [emailLimpo]);
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('❌ Erro ao listar por produtor:', err);
    return res.status(500).json({ error: err.message });
  }
};

// ========================================
// 3. BUSCAR POR ID
// ========================================
exports.buscarEventoPorId = async (req, res) => {
  const { id } = req.params;
  try {
    const query = `
      SELECT e.*, 
        TO_CHAR(e.data_inicio, 'YYYY-MM-DD') AS data_inicio,
        TO_CHAR(e.data_termino, 'YYYY-MM-DD') AS data_termino,
        p.nome AS produtor_nome, p.foto_perfil AS produtor_foto
      FROM public.eventos e
      LEFT JOIN public.produtores p ON TRIM(LOWER(e.produtor_email)) = TRIM(LOWER(p.email))
      WHERE e.id = $1
    `;
    const result = await db.query(query, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Evento não encontrado' });
    }

    const evento = result.rows[0];

    const resIng = await db.query(
      `
      SELECT
        id,
        evento_id,
        nome,
        descricao,
        preco,
        quantidade,
        moeda
      FROM public.ingressos
      WHERE evento_id = $1
      ORDER BY preco ASC
      `,
      [id]
    );

    evento.ingressos = resIng.rows.map((ing) => ({
      ...ing,
      descricao: limparCampo(ing.descricao, ''),
      preco: parsePreco(ing.preco),
      moeda: normalizarMoeda(ing.moeda || evento.moeda, evento.moeda),
    }));

    return res.status(200).json(evento);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ========================================
// 4. CRIAR PRESENCIAL
// ========================================
exports.criarEventoPresencial = async (req, res) => {
  const imagemFinal = obterImagemFinal(req, 'imagem_capa');
  const bannerFinal = obterImagemFinal(req, 'banner_patrocinio');
  const moedaFinal = obterMoedaDoBody(req.body, 'BRL');

  try {
    const query = `
      INSERT INTO public.eventos (
        nome, produtor_email, usuario_nome, categoria, descricao, data_inicio, hora_inicio,
        data_termino, hora_termino, local_nome, cep, endereco, numero,
        complemento, cidade, estado, capacidade, imagem_capa, banner_patrocinio, tipo, status,
        moeda, regras, visibilidade, taxa_plataforma
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
      RETURNING id
    `;
    const values = [
      limparCampo(req.body.nome, 'Novo Evento'),
      normalizarEmail(req.body.produtor_email),
      limparCampo(req.body.usuario_nome, 'Admin'),
      normalizarCategoria(req.body.categoria),
      limparCampo(req.body.descricao, ''),
      normalizarData(req.body.data_inicio),
      normalizarHora(req.body.hora_inicio),
      normalizarData(req.body.data_termino),
      normalizarHora(req.body.hora_termino),
      limparCampo(req.body.local_nome, ''),
      limparCampo(req.body.cep, ''),
      limparCampo(req.body.endereco, ''),
      limparCampo(req.body.numero, ''),
      limparCampo(req.body.complemento, ''),
      limparCampo(req.body.cidade, ''),
      limparCampo(req.body.estado, ''),
      limparNumero(req.body.capacidade, 0),
      imagemFinal,
      bannerFinal,
      limparCampo(req.body.tipo, 'Presencial'),
      'Ativo',
      moedaFinal,
      limparCampo(req.body.regras, ''),
      limparCampo(req.body.visibilidade, 'Publico'),
      parseFloat(req.body.taxa_plataforma || 0.05),
    ];
    const result = await db.query(query, values);
    return res.status(201).json({ message: 'Evento criado!', id: result.rows[0].id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ========================================
// 5. ATUALIZAR EVENTO
// ========================================
exports.atualizarEvento = async (req, res) => {
  const { id } = req.params;
  try {
    const check = await db.query('SELECT * FROM public.eventos WHERE id = $1', [id]);
    if (check.rowCount === 0) {
      return res.status(404).json({ error: 'Evento não encontrado' });
    }

    const atual = check.rows[0];
    const imagemFinal = obterImagemFinal(req, 'imagem_capa', atual.imagem_capa);
    const bannerFinal = obterImagemFinal(req, 'banner_patrocinio', atual.banner_patrocinio);
    const moedaFinal = obterMoedaDoBody(req.body, atual.moeda);

    const queryUpdate = `
      UPDATE public.eventos SET
        nome=$1, categoria=$2, descricao=$3, data_inicio=$4, hora_inicio=$5, data_termino=$6, hora_termino=$7,
        local_nome=$8, cep=$9, endereco=$10, numero=$11, complemento=$12, cidade=$13, estado=$14,
        capacidade=$15, imagem_capa=$16, banner_patrocinio=$17, tipo=$18, status=$19, moeda=$20,
        regras=$21, visibilidade=$22, link_reuniao=$23, usuario_nome=$24, taxa_plataforma=$25
      WHERE id = $26 RETURNING *
    `;
    const values = [
      limparCampo(req.body.nome, atual.nome),
      normalizarCategoria(req.body.categoria || atual.categoria),
      limparCampo(req.body.descricao, atual.descricao),
      normalizarData(req.body.data_inicio ?? atual.data_inicio),
      normalizarHora(req.body.hora_inicio ?? atual.hora_inicio),
      normalizarData(req.body.data_termino ?? atual.data_termino),
      normalizarHora(req.body.hora_termino ?? atual.hora_termino),
      limparCampo(req.body.local_nome, atual.local_nome),
      limparCampo(req.body.cep, atual.cep),
      limparCampo(req.body.endereco, atual.endereco),
      limparCampo(req.body.numero, atual.numero),
      limparCampo(req.body.complemento, atual.complemento),
      limparCampo(req.body.cidade, atual.cidade),
      limparCampo(req.body.estado, atual.estado),
      limparNumero(req.body.capacidade, atual.capacidade),
      imagemFinal,
      bannerFinal,
      limparCampo(req.body.tipo, atual.tipo),
      limparCampo(req.body.status, atual.status),
      moedaFinal,
      limparCampo(req.body.regras, atual.regras),
      limparCampo(req.body.visibilidade, atual.visibilidade),
      limparCampo(req.body.link_reuniao, atual.link_reuniao),
      limparCampo(req.body.usuario_nome, atual.usuario_nome),
      parseFloat(req.body.taxa_plataforma ?? atual.taxa_plataforma),
      id,
    ];
    const result = await db.query(queryUpdate, values);

    await db.query(
      'UPDATE public.ingressos SET moeda = $1 WHERE evento_id = $2',
      [moedaFinal, id]
    );

    return res.status(200).json({ message: 'Atualizado!', evento: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ========================================
// 6. EXCLUIR EVENTO
// ========================================
exports.excluirEvento = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM public.ingressos WHERE evento_id = $1', [id]);
    await db.query('DELETE FROM public.eventos WHERE id = $1', [id]);
    return res.status(200).json({ message: 'Excluído!' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ========================================
// 7. SALVAR INGRESSOS
// ========================================
exports.salvarIngressos = async (req, res) => {
  const { id } = req.params;
  const { ingressos } = req.body;

  try {
    const ev = await db.query(
      'SELECT moeda FROM public.eventos WHERE id = $1',
      [id]
    );

    if (ev.rows.length === 0) {
      return res.status(404).json({ error: 'Evento não encontrado' });
    }

    const moedaEvento = normalizarMoeda(ev.rows[0].moeda, 'BRL');

    await db.query('DELETE FROM public.ingressos WHERE evento_id = $1', [id]);

    if (ingressos && Array.isArray(ingressos)) {
      for (const ing of ingressos) {
        await db.query(
          `
          INSERT INTO public.ingressos (
            evento_id,
            nome,
            descricao,
            preco,
            quantidade,
            moeda
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          `,
          [
            id,
            limparCampo(ing.nome, 'Ingresso'),
            limparCampo(ing.descricao, ''),
            parsePreco(ing.preco),
            limparNumero(ing.quantidade, 0),
            moedaEvento,
          ]
        );
      }
    }

    return res.status(200).json({
      message: 'Salvo!',
      moeda: moedaEvento,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ========================================
// 8. ATUALIZAR STATUS
// ========================================
exports.atualizarStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    await db.query('UPDATE public.eventos SET status = $1 WHERE id = $2', [status, id]);
    return res.status(200).json({ message: 'Status OK' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ========================================
// 9. GERAR COM IA
// ========================================
exports.gerarComIA = async (req, res) => {
  const { texto } = req.body;
  if (!texto) return res.status(400).json({ error: 'Forneça um texto.' });

  try {
    const chat = await groq.chat.completions.create({
      messages: [
        { role: "system", content: "Retorne APENAS JSON puro para cadastro de evento." },
        { role: "user", content: texto }
      ],
      model: "llama-3.3-70b-versatile",
      response_format: { type: "json_object" },
    });

    const data = JSON.parse(chat.choices[0].message.content);

    return res.status(200).json({
      ...data,
      categoria: normalizarCategoria(data.categoria),
      data_inicio: normalizarData(data.data_inicio),
      hora_inicio: normalizarHora(data.hora_inicio),
    });
  } catch (err) {
    return res.status(500).json({ error: 'IA falhou.' });
  }
};