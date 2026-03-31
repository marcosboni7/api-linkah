const db = require('../config/database');

const CATEGORIAS_VALIDAS = [
  'Arte & Cultura',
  'Entretenimento',
  'Negócios',
  'Educação & Desenvolvimento',
  'Esportes & Bem-estar',
  'Experiências & Lifestyle',
  'Família & Comunidade'
];

// ------------------------------
// HELPERS (VERSÃO ULTRA-RESILIENTE)
// ------------------------------
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

/**
 * Converte qualquer formato comum de data para YYYY-MM-DD
 * Resolve erro tipo:
 * invalid input syntax for type date: "Wed Apr 01 2026 00:00:00 GM"
 */
const normalizarData = (valor) => {
  if (
    valor === undefined ||
    valor === null ||
    valor === 'undefined' ||
    valor === 'null' ||
    String(valor).trim() === ''
  ) {
    return null;
  }

  const dataRaw = String(valor).trim();

  // 1) Já está certo: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dataRaw)) {
    return dataRaw;
  }

  // 2) ISO: 2026-04-01T00:00:00.000Z
  if (/^\d{4}-\d{2}-\d{2}T/.test(dataRaw)) {
    return dataRaw.split('T')[0];
  }

  // 3) BR: 01/04/2026
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dataRaw)) {
    const [dia, mes, ano] = dataRaw.split('/');
    return `${ano}-${mes}-${dia}`;
  }

  // 4) Texto tipo: Wed Apr 01 2026 00:00:00 GMT-0300 ou truncado "GM"
  const matchExtenso = dataRaw.match(
    /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s+(\d{4})/
  );

  if (matchExtenso) {
    const meses = {
      Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
      Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
    };

    const mes = meses[matchExtenso[2]];
    const dia = String(matchExtenso[3]).padStart(2, '0');
    const ano = matchExtenso[4];

    return `${ano}-${mes}-${dia}`;
  }

  // 5) Fallback final com Date() nativo
  const d = new Date(dataRaw);
  if (!isNaN(d.getTime())) {
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }

  return null;
};

const normalizarHora = (valor) => {
  if (!valor || valor === 'undefined' || valor === 'null' || String(valor).trim() === '') {
    return null;
  }
  const hora = String(valor).trim();
  if (/^\d{2}:\d{2}$/.test(hora) || /^\d{2}:\d{2}:\d{2}$/.test(hora)) {
    return hora;
  }
  return hora.substring(0, 8);
};

const obterImagemFinal = (req, imagemAtual = null) => {
  let imagemFinal = imagemAtual;

  if (req.file) {
    // Se for S3 usa location, se for local usa filename
    imagemFinal = req.file.location || req.file.filename || req.file.path;
    // Se for caminho local, garante que salva apenas o nome do arquivo
    if (!String(imagemFinal).startsWith('http')) {
      imagemFinal = req.file.filename;
    }
  } else if (req.body.imagem_capa) {
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

  return imagemFinal;
};

// ------------------------------
// 1. LISTAR VITRINE
// ------------------------------
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
        (SELECT COALESCE(MIN(preco), 0) FROM public.ingressos WHERE evento_id = e.id) AS preco_minimo
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

// ------------------------------
// 2. LISTAR POR PRODUTOR
// ------------------------------
exports.listarEventosPorProdutor = async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'Email não fornecido' });

  try {
    const emailLimpo = String(email).replace(/['"]+/g, '').trim().toLowerCase();
    const query = `
      SELECT id, nome, produtor_email, categoria, descricao,
        TO_CHAR(data_inicio, 'YYYY-MM-DD') AS data_inicio,
        hora_inicio, TO_CHAR(data_termino, 'YYYY-MM-DD') AS data_termino,
        hora_termino, local_nome, cep, endereco, numero, complemento, cidade, estado, capacidade,
        CASE WHEN imagem_capa ILIKE '%undefined%' OR imagem_capa ILIKE '%null%' THEN NULL ELSE imagem_capa END AS imagem_capa,
        tipo, status, moeda, regras, visibilidade, link_reuniao
      FROM public.eventos
      WHERE produtor_email = $1
      ORDER BY id DESC
    `;
    const result = await db.query(query, [emailLimpo]);
    return res.status(200).json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ------------------------------
// 3. BUSCAR POR ID
// ------------------------------
exports.buscarEventoPorId = async (req, res) => {
  const { id } = req.params;
  try {
    const query = `
      SELECT
        e.*,
        TO_CHAR(e.data_inicio, 'YYYY-MM-DD') AS data_inicio,
        TO_CHAR(e.data_termino, 'YYYY-MM-DD') AS data_termino,
        CASE
          WHEN e.imagem_capa ILIKE '%undefined%' OR e.imagem_capa ILIKE '%null%' THEN NULL
          ELSE e.imagem_capa
        END AS imagem_capa,
        p.nome AS produtor_nome,
        p.foto_perfil AS produtor_foto
      FROM public.eventos e
      LEFT JOIN public.produtores p
        ON TRIM(LOWER(e.produtor_email)) = TRIM(LOWER(p.email))
      WHERE e.id = $1
    `;
    const result = await db.query(query, [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Evento não encontrado' });

    const evento = result.rows[0];
    const resIng = await db.query('SELECT * FROM public.ingressos WHERE evento_id = $1 ORDER BY preco ASC', [id]);
    evento.ingressos = resIng.rows;
    return res.status(200).json(evento);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ------------------------------
// 4. CRIAR PRESENCIAL
// ------------------------------
exports.criarEventoPresencial = async (req, res) => {
  const imagemFinal = obterImagemFinal(req);
  const { nome, produtor_email, categoria, descricao, data_inicio, hora_inicio, data_termino, hora_termino, local_nome, cep, endereco, numero, complemento, cidade, estado, capacidade, moeda, tipo, regras, visibilidade } = req.body;

  try {
    const query = `
      INSERT INTO public.eventos (
        nome, produtor_email, categoria, descricao, data_inicio, hora_inicio,
        data_termino, hora_termino, local_nome, cep, endereco, numero,
        complemento, cidade, estado, capacidade, imagem_capa, tipo, status,
        moeda, regras, visibilidade
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
      RETURNING id
    `;
    const values = [
      limparCampo(nome, 'Novo Evento'), normalizarEmail(produtor_email), normalizarCategoria(categoria),
      limparCampo(descricao, ''), normalizarData(data_inicio), normalizarHora(hora_inicio),
      normalizarData(data_termino), normalizarHora(hora_termino), limparCampo(local_nome, ''),
      limparCampo(cep, ''), limparCampo(endereco, ''), limparCampo(numero, ''),
      limparCampo(complemento, ''), limparCampo(cidade, ''), limparCampo(estado, ''),
      limparNumero(capacidade, 0), imagemFinal, limparCampo(tipo, 'Presencial'),
      'Ativo', limparCampo(moeda, 'BRL'), limparCampo(regras, ''), limparCampo(visibilidade, 'Publico')
    ];
    const result = await db.query(query, values);
    return res.status(201).json({ message: 'Evento criado!', id: result.rows[0].id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ------------------------------
// 5. CRIAR ONLINE
// ------------------------------
exports.criarEventoOnline = async (req, res) => {
  const imagemFinal = obterImagemFinal(req);
  const { nome, produtor_email, categoria, descricao, data_inicio, hora_inicio, data_termino, hora_termino, capacidade, moeda, tipo, regras, visibilidade, link_reuniao, local_nome } = req.body;

  try {
    const query = `
      INSERT INTO public.eventos (
        nome, produtor_email, categoria, descricao, data_inicio, hora_inicio,
        data_termino, hora_termino, local_nome, capacidade, imagem_capa, tipo,
        status, moeda, regras, visibilidade, link_reuniao
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING id
    `;
    const values = [
      limparCampo(nome, 'Novo Evento Online'), normalizarEmail(produtor_email), normalizarCategoria(categoria),
      limparCampo(descricao, ''), normalizarData(data_inicio), normalizarHora(hora_inicio),
      normalizarData(data_termino), normalizarHora(hora_termino), limparCampo(local_nome, 'Online'),
      limparNumero(capacidade, 0), imagemFinal, limparCampo(tipo, 'Online'),
      'Ativo', limparCampo(moeda, 'BRL'), limparCampo(regras, ''), limparCampo(visibilidade, 'Publico'),
      limparCampo(link_reuniao, '')
    ];
    const result = await db.query(query, values);
    return res.status(201).json({ message: 'Evento online criado!', id: result.rows[0].id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ------------------------------
// 6. ATUALIZAR EVENTO
// ------------------------------
exports.atualizarEvento = async (req, res) => {
  const { id } = req.params;
  try {
    const check = await db.query('SELECT * FROM public.eventos WHERE id = $1', [id]);
    if (check.rowCount === 0) return res.status(404).json({ error: 'Evento não encontrado' });

    const atual = check.rows[0];
    const imagemFinal = obterImagemFinal(req, atual.imagem_capa);

    const values = [
      limparCampo(req.body.nome, atual.nome),
      normalizarCategoria(req.body.categoria || atual.categoria),
      limparCampo(req.body.descricao, atual.descricao),
      normalizarData(req.body.data_inicio ?? atual.data_inicio),
      normalizarHora(req.body.hora_inicio ?? atual.hora_inicio),
      normalizarData(req.body.data_termino ?? atual.data_termino),
      normalizarHora(req.body.hora_termino ?? atual.hora_termino),
      limparCampo(req.body.local_nome, atual.local_nome || ''),
      limparCampo(req.body.cep, atual.cep || ''),
      limparCampo(req.body.endereco, atual.endereco || ''),
      limparCampo(req.body.numero, atual.numero || ''),
      limparCampo(req.body.complemento, atual.complemento || ''),
      limparCampo(req.body.cidade, atual.cidade || ''),
      limparCampo(req.body.estado, atual.estado || ''),
      limparNumero(req.body.capacidade, atual.capacidade || 0),
      imagemFinal,
      limparCampo(req.body.tipo, atual.tipo || 'Presencial'),
      limparCampo(req.body.status, atual.status || 'Ativo'),
      limparCampo(req.body.moeda, atual.moeda || 'BRL'),
      limparCampo(req.body.regras, atual.regras || ''),
      limparCampo(req.body.visibilidade, atual.visibilidade || 'Publico'),
      limparCampo(req.body.link_reuniao, atual.link_reuniao || ''),
      id
    ];

    const queryUpdate = `
      UPDATE public.eventos SET
        nome=$1, categoria=$2, descricao=$3, data_inicio=$4, hora_inicio=$5,
        data_termino=$6, hora_termino=$7, local_nome=$8, cep=$9, endereco=$10,
        numero=$11, complemento=$12, cidade=$13, estado=$14, capacidade=$15,
        imagem_capa=$16, tipo=$17, status=$18, moeda=$19, regras=$20,
        visibilidade=$21, link_reuniao=$22
      WHERE id=$23 RETURNING *`;

    const result = await db.query(queryUpdate, values);
    return res.status(200).json({ message: 'Atualizado!', evento: result.rows[0] });
  } catch (err) {
    console.error('❌ ERRO NO UPDATE:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

// ------------------------------
// 7. EXCLUIR EVENTO
// ------------------------------
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

// ------------------------------
// 8. SALVAR INGRESSOS
// ------------------------------
exports.salvarIngressos = async (req, res) => {
  const { id } = req.params;
  const { ingressos, moeda_evento } = req.body;
  try {
    await db.query('DELETE FROM public.ingressos WHERE evento_id = $1', [id]);
    if (ingressos && Array.isArray(ingressos)) {
      for (const ing of ingressos) {
        await db.query(
          `INSERT INTO public.ingressos (evento_id, nome, preco, quantidade, moeda) VALUES ($1, $2, $3, $4, $5)`,
          [id, limparCampo(ing.nome, 'Ingresso'), Number(ing.preco) || 0, limparNumero(ing.quantidade, 0), limparCampo(moeda_evento, 'BRL')]
        );
      }
    }
    if (moeda_evento) await db.query('UPDATE public.eventos SET moeda = $1 WHERE id = $2', [moeda_evento, id]);
    return res.status(200).json({ message: 'Salvo!' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ------------------------------
// 9. ATUALIZAR STATUS
// ------------------------------
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