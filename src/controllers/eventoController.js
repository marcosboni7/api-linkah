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

  if (/^\d{4}-\d{2}-\d{2}$/.test(dataRaw)) {
    return dataRaw;
  }

  if (/^\d{4}-\d{2}-\d{2}T/.test(dataRaw)) {
    return dataRaw.split('T')[0];
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dataRaw)) {
    const [dia, mes, ano] = dataRaw.split('/');
    return `${ano}-${mes}-${dia}`;
  }

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
  if (
    !valor ||
    valor === 'undefined' ||
    valor === 'null' ||
    String(valor).trim() === ''
  ) {
    return null;
  }

  const hora = String(valor).trim();

  if (/^\d{2}:\d{2}$/.test(hora) || /^\d{2}:\d{2}:\d{2}$/.test(hora)) {
    return hora;
  }

  return hora.substring(0, 8);
};

/** * AJUSTE: Função agora lida com múltiplos campos de imagem (capa e banner)
 */
const obterImagemFinal = (req, campo, imagemAtual = null) => {
  let imagemFinal = imagemAtual;

  // Se o multer salvou arquivos (req.files existe em upload.fields)
  if (req.files && req.files[campo]) {
    const file = req.files[campo][0];
    imagemFinal = file.path || file.secure_url || file.url || imagemAtual;
  } 
  // Caso venha apenas a string via body (URL direta)
  else if (req.body[campo]) {
    const imgBody = req.body[campo];
    const isLixo =
      !imgBody ||
      imgBody === 'undefined' ||
      imgBody === 'null' ||
      String(imgBody).includes('/undefined') ||
      String(imgBody).includes('[object Object]');

    if (!isLixo) {
      imagemFinal = String(imgBody).trim();
    }
  }

  return imagemFinal;
};

// 1. LISTAR VITRINE
exports.listarTodosEventosParaVitrine = async (req, res) => {
  try {
    const query = `
      SELECT
        e.id,
        e.nome,
        CASE
          WHEN e.imagem_capa ILIKE '%undefined%' OR e.imagem_capa ILIKE '%null%' THEN NULL
          ELSE e.imagem_capa
        END AS imagem_capa,
        TO_CHAR(e.data_inicio, 'YYYY-MM-DD') AS data_inicio,
        e.hora_inicio,
        e.local_nome,
        e.cidade,
        e.estado,
        e.categoria,
        e.tipo,
        e.status,
        e.moeda,
        COALESCE(
          (
            SELECT MIN(CAST(i.preco AS NUMERIC))
            FROM public.ingressos i
            WHERE i.evento_id = e.id
          ),
          0
        ) AS preco_minimo
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

// 2. LISTAR POR PRODUTOR
exports.listarEventosPorProdutor = async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'Email não fornecido' });

  try {
    const emailLimpo = String(email).replace(/['"]+/g, '').trim().toLowerCase();
    const query = `
      SELECT
        id, nome, produtor_email, usuario_nome, categoria, descricao,
        TO_CHAR(data_inicio, 'YYYY-MM-DD') AS data_inicio,
        hora_inicio,
        TO_CHAR(data_termino, 'YYYY-MM-DD') AS data_termino,
        hora_termino,
        local_nome, cep, endereco, numero, complemento, cidade, estado, capacidade,
        CASE
          WHEN imagem_capa ILIKE '%undefined%' OR imagem_capa ILIKE '%null%' THEN NULL
          ELSE imagem_capa
        END AS imagem_capa,
        CASE
          WHEN banner_patrocinio ILIKE '%undefined%' OR banner_patrocinio ILIKE '%null%' THEN NULL
          ELSE banner_patrocinio
        END AS banner_patrocinio,
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

// 3. BUSCAR POR ID
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
        CASE
          WHEN e.banner_patrocinio ILIKE '%undefined%' OR e.banner_patrocinio ILIKE '%null%' THEN NULL
          ELSE e.banner_patrocinio
        END AS banner_patrocinio,
        p.nome AS produtor_nome,
        p.foto_perfil AS produtor_foto
      FROM public.eventos e
      LEFT JOIN public.produtores p
        ON TRIM(LOWER(e.produtor_email)) = TRIM(LOWER(p.email))
      WHERE e.id = $1
    `;

    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Evento não encontrado' });
    }

    const evento = result.rows[0];

    try {
      const resIng = await db.query(
        'SELECT * FROM public.ingressos WHERE evento_id = $1 ORDER BY preco ASC',
        [id]
      );
      evento.ingressos = resIng.rows;
    } catch (ingErr) {
      console.warn('⚠️ Erro ao buscar ingressos:', ingErr.message);
      evento.ingressos = [];
    }

    return res.status(200).json(evento);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// 4. CRIAR PRESENCIAL
exports.criarEventoPresencial = async (req, res) => {
  const imagemFinal = obterImagemFinal(req, 'imagem_capa');
  const bannerFinal = obterImagemFinal(req, 'banner_patrocinio');

  const {
    nome,
    produtor_email,
    usuario_nome,
    categoria,
    descricao,
    data_inicio,
    hora_inicio,
    data_termino,
    hora_termino,
    local_nome,
    cep,
    endereco,
    numero,
    complemento,
    cidade,
    estado,
    capacidade,
    moeda,
    tipo,
    regras,
    visibilidade
  } = req.body;

  try {
    const query = `
      INSERT INTO public.eventos (
        nome, produtor_email, usuario_nome, categoria, descricao, data_inicio, hora_inicio,
        data_termino, hora_termino, local_nome, cep, endereco, numero,
        complemento, cidade, estado, capacidade, imagem_capa, banner_patrocinio, tipo, status,
        moeda, regras, visibilidade
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24
      )
      RETURNING id
    `;

    const values = [
      limparCampo(nome, 'Novo Evento'),
      normalizarEmail(produtor_email),
      limparCampo(usuario_nome, 'Admin'),
      normalizarCategoria(categoria),
      limparCampo(descricao, ''),
      normalizarData(data_inicio),
      normalizarHora(hora_inicio),
      normalizarData(data_termino),
      normalizarHora(hora_termino),
      limparCampo(local_nome, ''),
      limparCampo(cep, ''),
      limparCampo(endereco, ''),
      limparCampo(numero, ''),
      limparCampo(complemento, ''),
      limparCampo(cidade, ''),
      limparCampo(estado, ''),
      limparNumero(capacidade, 0),
      imagemFinal,
      bannerFinal,
      limparCampo(tipo, 'Presencial'),
      'Ativo',
      limparCampo(moeda, 'BRL'),
      limparCampo(regras, ''),
      limparCampo(visibilidade, 'Publico')
    ];

    const result = await db.query(query, values);
    return res.status(201).json({ message: 'Evento criado!', id: result.rows[0].id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// 5. CRIAR ONLINE
exports.criarEventoOnline = async (req, res) => {
  const imagemFinal = obterImagemFinal(req, 'imagem_capa');
  const bannerFinal = obterImagemFinal(req, 'banner_patrocinio');

  const {
    nome,
    produtor_email,
    usuario_nome,
    categoria,
    descricao,
    data_inicio,
    hora_inicio,
    data_termino,
    hora_termino,
    capacidade,
    moeda,
    tipo,
    regras,
    visibilidade,
    link_reuniao,
    local_nome
  } = req.body;

  try {
    const query = `
      INSERT INTO public.eventos (
        nome, produtor_email, usuario_nome, categoria, descricao, data_inicio, hora_inicio,
        data_termino, hora_termino, local_nome, capacidade, imagem_capa, banner_patrocinio, tipo,
        status, moeda, regras, visibilidade, link_reuniao
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
      )
      RETURNING id
    `;

    const values = [
      limparCampo(nome, 'Novo Evento Online'),
      normalizarEmail(produtor_email),
      limparCampo(usuario_nome, 'Admin'),
      normalizarCategoria(categoria),
      limparCampo(descricao, ''),
      normalizarData(data_inicio),
      normalizarHora(hora_inicio),
      normalizarData(data_termino),
      normalizarHora(hora_termino),
      limparCampo(local_nome, 'Online'),
      limparNumero(capacidade, 0),
      imagemFinal,
      bannerFinal,
      limparCampo(tipo, 'Online'),
      'Ativo',
      limparCampo(moeda, 'BRL'),
      limparCampo(regras, ''),
      limparCampo(visibilidade, 'Publico'),
      limparCampo(link_reuniao, '')
    ];

    const result = await db.query(query, values);
    return res.status(201).json({ message: 'Evento online criado!', id: result.rows[0].id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// 6. ATUALIZAR EVENTO
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

    const dataInicioFinal =
      req.body.data_inicio !== undefined
        ? normalizarData(req.body.data_inicio)
        : normalizarData(atual.data_inicio);

    const dataTerminoFinal =
      req.body.data_termino !== undefined
        ? normalizarData(req.body.data_termino)
        : normalizarData(atual.data_termino);

    const values = [
      limparCampo(req.body.nome, atual.nome),
      normalizarCategoria(req.body.categoria || atual.categoria),
      limparCampo(req.body.descricao, atual.descricao),
      dataInicioFinal,
      normalizarHora(req.body.hora_inicio ?? atual.hora_inicio),
      dataTerminoFinal,
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
      bannerFinal,
      limparCampo(req.body.tipo, atual.tipo || 'Presencial'),
      limparCampo(req.body.status, atual.status || 'Ativo'),
      limparCampo(req.body.moeda, atual.moeda || 'BRL'),
      limparCampo(req.body.regras, atual.regras || ''),
      limparCampo(req.body.visibilidade, atual.visibilidade || 'Publico'),
      limparCampo(req.body.link_reuniao, atual.link_reuniao || ''),
      limparCampo(req.body.usuario_nome, atual.usuario_nome),
      id
    ];

    const queryUpdate = `
      UPDATE public.eventos
      SET
        nome = $1,
        categoria = $2,
        descricao = $3,
        data_inicio = $4,
        hora_inicio = $5,
        data_termino = $6,
        hora_termino = $7,
        local_nome = $8,
        cep = $9,
        endereco = $10,
        numero = $11,
        complemento = $12,
        cidade = $13,
        estado = $14,
        capacidade = $15,
        imagem_capa = $16,
        banner_patrocinio = $17,
        tipo = $18,
        status = $19,
        moeda = $20,
        regras = $21,
        visibilidade = $22,
        link_reuniao = $23,
        usuario_nome = $24
      WHERE id = $25
      RETURNING *
    `;

    const result = await db.query(queryUpdate, values);
    return res.status(200).json({ message: 'Atualizado!', evento: result.rows[0] });
  } catch (err) {
    console.error('❌ ERRO NO UPDATE:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

// 7. EXCLUIR EVENTO
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

// 8. SALVAR INGRESSOS
exports.salvarIngressos = async (req, res) => {
  const { id } = req.params;
  const { ingressos, moeda_evento } = req.body;

  try {
    await db.query('DELETE FROM public.ingressos WHERE evento_id = $1', [id]);

    if (ingressos && Array.isArray(ingressos)) {
      for (const ing of ingressos) {
        await db.query(
          `
            INSERT INTO public.ingressos (evento_id, nome, preco, quantidade, moeda)
            VALUES ($1, $2, $3, $4, $5)
          `,
          [
            id,
            limparCampo(ing.nome, 'Ingresso'),
            Number(ing.preco) || 0,
            limparNumero(ing.quantidade, 0),
            limparCampo(moeda_evento, 'BRL')
          ]
        );
      }
    }

    if (moeda_evento) {
      await db.query('UPDATE public.eventos SET moeda = $1 WHERE id = $2', [
        moeda_evento,
        id
      ]);
    }

    return res.status(200).json({ message: 'Salvo!' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// 9. ATUALIZAR STATUS
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