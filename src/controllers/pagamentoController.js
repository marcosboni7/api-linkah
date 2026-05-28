const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.error('❌ STRIPE_SECRET_KEY não definida no ambiente.');
}

const stripe = require('stripe')(stripeSecretKey || '');
const db = require('../config/database');
const { enviarIngressoEmail } = require('../services/emailService');

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://linkah.eu';

// ======================================================
// FUNÇÕES AUXILIARES
// ======================================================

function isValidHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function safeString(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function safeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function safeInt(value, fallback = 0) {
  const num = parseInt(value, 10);
  return Number.isFinite(num) ? num : fallback;
}

function getErrorMessage(err) {
  if (!err) return 'Erro desconhecido';
  if (typeof err === 'string') return err;
  if (typeof err.message === 'string' && err.message.trim()) return err.message;
  return 'Erro interno no servidor de pagamentos';
}

function normalizeCurrency(input) {
  if (input === null || input === undefined) return 'brl';

  const raw = String(input).trim().toUpperCase();

  if (['R$', 'REAL', 'REAIS', 'BRL'].includes(raw)) return 'brl';
  if (['€', 'EURO', 'EUROS', 'EUR'].includes(raw)) return 'eur';
  if (['$', 'DOLAR', 'DÓLAR', 'DOLARES', 'DÓLARES', 'USD'].includes(raw)) return 'usd';

  return 'brl';
}

function formatDateBR(dateValue) {
  try {
    if (!dateValue) return 'Data a definir';
    return new Date(dateValue).toLocaleDateString('pt-BR');
  } catch {
    return 'Data a definir';
  }
}

function parseQuantidades(rawQuantidades) {
  const resultado = {};

  if (!rawQuantidades || typeof rawQuantidades !== 'object' || Array.isArray(rawQuantidades)) {
    return resultado;
  }

  for (const [key, value] of Object.entries(rawQuantidades)) {
    const id = String(key).trim();
    const qtd = safeInt(value, 0);

    if (id && qtd > 0) {
      resultado[id] = qtd;
    }
  }

  return resultado;
}

// ======================================================
// 1. CRIAR SESSÃO DE CHECKOUT
// ======================================================

exports.criarSessaoCheckout = async (req, res) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: 'STRIPE_SECRET_KEY não configurada.' });
    }

    const {
      evento,
      usuarioEmail,
      usuarioNome,
      quantidade,
      quantidades,
      afiliadoId,
      comissaoPercentual,
      nomeCracha,
      instagramUser,
      alergias,
      comoConheceu
    } = req.body;

    const baseUrl = FRONTEND_URL;

    if (!isValidHttpUrl(baseUrl)) {
      return res.status(500).json({ error: 'FRONTEND_URL inválida ou ausente.' });
    }

    if (!evento?.id) {
      return res.status(400).json({ error: 'ID do evento não informado.' });
    }

    if (!usuarioEmail) {
      return res.status(400).json({ error: 'E-mail do comprador não informado.' });
    }

    const quantidadesSelecionadas = parseQuantidades(quantidades);

    const dadosEventoBD = await db.query(
      `SELECT 
        e.id,
        e.nome,
        e.data_inicio,
        e.hora_inicio,
        e.local_nome,
        e.preco,
        e.tipo,
        e.link_reuniao,
        e.moeda,
        e.taxa_plataforma,
        COALESCE(p.stripe_account_id, u.stripe_account_id) AS stripe_account_id
      FROM public.eventos e
      LEFT JOIN public.produtores p ON e.produtor_email = p.email
      LEFT JOIN public.usuarios u ON e.produtor_email = u.email
      WHERE e.id = $1
      LIMIT 1`,
      [evento.id]
    );

    if (dadosEventoBD.rows.length === 0) {
      return res.status(404).json({ error: 'Evento não encontrado.' });
    }

    const ev = dadosEventoBD.rows[0];

    const ingressosBD = await db.query(
      `SELECT 
        id,
        nome,
        preco,
        moeda
      FROM public.ingressos
      WHERE evento_id = $1
      ORDER BY id ASC`,
      [evento.id]
    );

    const ingressos = Array.isArray(ingressosBD.rows) ? ingressosBD.rows : [];
    const existeSelecaoDeIngressos = Object.keys(quantidadesSelecionadas).length > 0;
    const eventoTemIngressos = ingressos.length > 0;

    let moedaFinal = normalizeCurrency(ev.moeda || evento?.moeda || 'BRL');
    let totalFinal = 0;
    let quantidadeFinal = 0;
    let descricaoItens = [];
    let metadataIngressos = [];

    if (eventoTemIngressos && existeSelecaoDeIngressos) {
      const mapaIngressos = new Map();

      for (const ing of ingressos) {
        mapaIngressos.set(String(ing.id), ing);
      }

      for (const [ingressoId, qtd] of Object.entries(quantidadesSelecionadas)) {
        const ingresso = mapaIngressos.get(String(ingressoId));

        if (!ingresso) continue;

        const precoUnitario = safeNumber(ingresso.preco, 0);
        const moedaIngresso = normalizeCurrency(ingresso.moeda || ev.moeda || 'BRL');

        if (precoUnitario <= 0) continue;

        if (quantidadeFinal === 0) {
          moedaFinal = moedaIngresso;
        } else if (moedaIngresso !== moedaFinal) {
          return res.status(400).json({
            error: 'Os ingressos selecionados possuem moedas diferentes. Ajuste os ingressos antes de continuar.',
          });
        }

        totalFinal += precoUnitario * qtd;
        quantidadeFinal += qtd;

        descricaoItens.push(`${qtd}x ${safeString(ingresso.nome, 'Ingresso')}`);
        metadataIngressos.push({
          id: String(ingresso.id),
          nome: safeString(ingresso.nome, 'Ingresso'),
          quantidade: qtd,
          preco: precoUnitario,
          moeda: moedaIngresso.toUpperCase(),
        });
      }

      if (quantidadeFinal <= 0 || totalFinal <= 0) {
        return res.status(400).json({
          error: 'Nenhum ingresso válido com preço configurado foi selecionado.',
        });
      }
    } else {
      const precoEvento = safeNumber(ev.preco, 0);
      quantidadeFinal = safeInt(quantidade, 1);
      moedaFinal = normalizeCurrency(ev.moeda || evento?.moeda || 'BRL');

      if (precoEvento <= 0) {
        return res.status(400).json({
          error: 'Este evento não tem um preço válido configurado no banco.',
        });
      }

      if (quantidadeFinal <= 0) {
        return res.status(400).json({
          error: 'Quantidade inválida para o checkout.',
        });
      }

      totalFinal = precoEvento * quantidadeFinal;
      descricaoItens.push(`${quantidadeFinal}x Ingresso`);
    }

    const totalEmCentavos = Math.round(totalFinal * 100);

    if (totalEmCentavos < 50) {
      return res.status(400).json({
        error: `O valor total deve ser pelo menos 0.50 ${moedaFinal.toUpperCase()}.`,
      });
    }

    const dataEventoFormatada = formatDateBR(ev.data_inicio);
    const horaEvento = safeString(ev.hora_inicio, 'Horário a definir');
    const localEvento =
      safeString(ev.local_nome) ||
      (safeString(ev.tipo).toLowerCase() === 'online'
        ? safeString(ev.link_reuniao, 'Evento online')
        : 'Local a definir');

    const descricaoStripe =
      descricaoItens.length > 0
        ? descricaoItens.join(' | ')
        : `Data: ${dataEventoFormatada}`;

    const sessionParams = {
      payment_method_types: ['card'],
      customer_email: safeString(usuarioEmail),
      line_items: [
        {
          price_data: {
            currency: moedaFinal,
            product_data: {
              name: `Ingresso: ${safeString(ev.nome, 'Evento')}`,
              description: descricaoStripe,
            },
            unit_amount: totalEmCentavos,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      metadata: {
        usuarioEmail: safeString(usuarioEmail),
        usuarioNome: safeString(usuarioNome),
        eventoId: safeString(ev.id),
        tituloEvento: safeString(ev.nome, 'Evento'),
        quantidade: safeString(quantidadeFinal),
        moeda: moedaFinal.toUpperCase(),
        taxaAplicada: safeString(ev.taxa_plataforma || '0.05'),
        dataEvento: safeString(dataEventoFormatada, 'Data a confirmar'),
        horaEvento: safeString(horaEvento, 'Horário a confirmar'),
        localEvento: safeString(localEvento, 'Local a definir'),
        tipoEvento: safeString(ev.tipo, 'presencial'),
        itensResumo: safeString(descricaoItens.join(' | ')),
        valorTotal: safeString(totalFinal),
        ingressosJson: JSON.stringify(metadataIngressos).slice(0, 490),
        afiliadoId: safeString(afiliadoId),
        comissaoPercentual: safeString(comissaoPercentual || '10'),
        nomeCracha: safeString(nomeCracha),
        instagramUser: safeString(instagramUser),
        alergias: safeString(alergias),
        comoConheceu: safeString(comoConheceu),
      },
      success_url: `${baseUrl}/pagamento/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/venda?eventoId=${ev.id}`,
    };

    if (ev.stripe_account_id) {
      const taxaStaff = safeNumber(ev.taxa_plataforma, 0.05);
      const comissaoLinkah = Math.round(totalEmCentavos * taxaStaff);

      sessionParams.payment_intent_data = {
        application_fee_amount: comissaoLinkah,
        transfer_data: { destination: ev.stripe_account_id },
      };

      console.log(
        `✅ Checkout Connect | Evento: ${ev.id} | Total: ${moedaFinal.toUpperCase()} ${totalFinal} | Taxa Linkah: ${taxaStaff * 100}%`
      );
    } else {
      console.log(
        `✅ Checkout padrão | Evento: ${ev.id} | Total: ${moedaFinal.toUpperCase()} ${totalFinal}`
      );
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return res.json({
      url: session.url,
      total: totalFinal,
      quantidade: quantidadeFinal,
      moeda: moedaFinal.toUpperCase(),
    });
  } catch (err) {
    console.error('❌ Erro Stripe Checkout:', err);
    return res.status(500).json({ error: getErrorMessage(err) });
  }
};

// ======================================================
// 2. VINCULAR CONTA DO PRODUTOR
// ======================================================

exports.vincularContaStripe = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'E-mail não informado.' });
    }

    const produtorResult = await db.query(
      'SELECT stripe_account_id FROM public.produtores WHERE email = $1 LIMIT 1',
      [email]
    );

    const usuarioResult = await db.query(
      'SELECT stripe_account_id FROM public.usuarios WHERE email = $1 LIMIT 1',
      [email]
    );

    const registro = produtorResult.rows[0] || usuarioResult.rows[0];
    let stripeAccountId = registro?.stripe_account_id || null;

    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });

      stripeAccountId = account.id;

      await db.query(
        'UPDATE public.produtores SET stripe_account_id = $1 WHERE email = $2',
        [stripeAccountId, email]
      );

      await db.query(
        'UPDATE public.usuarios SET stripe_account_id = $1 WHERE email = $2',
        [stripeAccountId, email]
      );
    }

    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${FRONTEND_URL}/dashboard/perfil`,
      return_url: `${FRONTEND_URL}/dashboard/perfil?stripe_callback=true`,
      type: 'account_onboarding',
    });

    return res.json({ ok: true, url: accountLink.url });
  } catch (err) {
    console.error('❌ Erro ao vincular conta Stripe:', err);
    return res.status(500).json({ error: getErrorMessage(err) });
  }
};

// ======================================================
// 3. VERIFICAR STATUS DA CONTA
// ======================================================

exports.verificarStatusStripe = async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ error: 'E-mail não informado.' });
    }

    const result = await db.query(
      'SELECT stripe_account_id FROM public.produtores WHERE email = $1 LIMIT 1',
      [email]
    );

    const stripeAccountId = result.rows[0]?.stripe_account_id;

    if (!stripeAccountId) {
      return res.json({ conectado: false });
    }

    const account = await stripe.accounts.retrieve(stripeAccountId);
    const temPendencias = account?.requirements?.currently_due?.length > 0;
    const estaHabilitado = !!account.charges_enabled && !!account.payouts_enabled;

    return res.json({
      conectado: true,
      status_banco: estaHabilitado && !temPendencias ? 'Ativo' : 'Pendente',
      details_submitted: !!account.details_submitted,
      charges_enabled: !!account.charges_enabled,
      payouts_enabled: !!account.payouts_enabled,
      business_name: account.settings?.dashboard?.display_name || 'Conta Vinculada',
    });
  } catch (err) {
    console.error('❌ Erro ao verificar status Stripe:', err);
    return res.status(500).json({ error: getErrorMessage(err) });
  }
};

// ======================================================
// 4. WEBHOOK
// ======================================================

exports.webhookStripe = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('❌ Erro na validação do webhook:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const meta = session.metadata || {};

    try {
      const idEvento = safeInt(meta.eventoId, 0);
      const quantidadeComprada = safeInt(meta.quantidade, 1);
      const valorTotal = safeNumber(session.amount_total, 0) / 100;

      const afiliadoId = meta.afiliadoId || null;
      const pctTaxa = safeNumber(meta.comissaoPercentual, 10);

      let valorComissao = 0;
      if (afiliadoId && afiliadoId.trim() !== '') {
        valorComissao = valorTotal * (pctTaxa / 100);
        console.log(`💰 Comissão Afiliado (${afiliadoId}): R$ ${valorComissao.toFixed(2)} (${pctTaxa}%)`);
      }

      await db.query(
        `INSERT INTO public.compras
          (usuario_email, evento_id, evento_nome, data_evento, quantidade, valor_total, status, stripe_session_id, afiliado_id, valor_comissao, nome_cracha, instagram_user, alergias, como_conheceu)
          VALUES ($1, $2, $3, $4, $5, $6, 'Aprovado', $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (stripe_session_id) DO NOTHING`,
        [
          safeString(meta.usuarioEmail),
          idEvento,
          safeString(meta.tituloEvento, 'Evento'),
          new Date(),
          quantidadeComprada,
          valorTotal,
          session.id,
          afiliadoId,
          valorComissao,
          meta.nomeCracha || null,
          meta.instagramUser || null,
          meta.alergias || null,
          meta.comoConheceu || null
        ]
      );

      await enviarIngressoEmail(safeString(meta.usuarioEmail), {
        tituloEvento: safeString(meta.tituloEvento, 'Evento'),
        quantidade: safeString(meta.quantidade, '1'),
        linkIngresso: `${FRONTEND_URL}/pagamento/sucesso?session_id=${session.id}`,
        dataEvento: safeString(meta.dataEvento, 'A confirmar'),
        horaEvento: safeString(meta.horaEvento, 'A confirmar'),
        localEvento: safeString(meta.localEvento, 'Local a definir'),
        tipo: safeString(meta.tipoEvento, 'presencial'),
      });
    } catch (err) {
      console.error('❌ Erro Processamento Webhook:', err);
    }
  }

  return res.json({ received: true });
};

// ======================================================
// 5. BUSCAR DETALHES
// ======================================================

exports.buscarDetalhesCompra = async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId não informado.' });
    }

    const result = await db.query(
      `SELECT 
        c.*,
        e.hora_inicio AS hora_evento,
        e.local_nome AS local_evento,
        e.link_reuniao,
        e.tipo
      FROM public.compras c
      LEFT JOIN public.eventos e ON e.id = c.evento_id
      WHERE c.stripe_session_id = $1`,
      [sessionId]
    );

    if (result.rows.length > 0) {
      return res.json(result.rows[0]);
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === 'paid') {
      return res.json({
        usuario_email: session.metadata?.usuarioEmail,
        evento_nome: session.metadata?.tituloEvento,
        valor_total: safeNumber(session.amount_total, 0) / 100,
        status: 'Aprovado',
      });
    }

    return res.status(404).json({ error: 'Compra não encontrada.' });
  } catch (err) {
    console.error('❌ Erro ao buscar detalhes da compra:', err);
    return res.status(500).json({ error: getErrorMessage(err) });
  }
};

// ======================================================
// 6. LISTAR MEUS INGRESSOS
// ======================================================

exports.listarMeusIngressos = async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ error: 'E-mail não informado.' });
    }

    const result = await db.query(
      `SELECT 
        c.*,
        e.link_reuniao,
        TO_CHAR(c.data_evento, 'DD/MM/YYYY') AS data
      FROM public.compras c
      LEFT JOIN public.eventos e ON e.id = c.evento_id
      WHERE c.usuario_email = $1
      ORDER BY c.id DESC`,
      [email]
    );

    return res.json(result.rows);
  } catch (err) {
    console.error('❌ Erro ao listar ingressos:', err);
    return res.status(500).json({ error: 'Erro ao buscar ingressos.' });
  }
};


exports.buscarComprasPorEvento = async (req, res) => {
  try {
    const { idEvento } = req.params;

    if (!idEvento) {
      return res.status(400).json({ error: 'ID do evento não informado.' });
    }

    const result = await db.query(
      `SELECT 
        usuario_email,
        nome_cracha,
        instagram_user,
        alergias,
        como_conheceu,
        status
      FROM public.compras
      WHERE evento_id = $1
      ORDER BY id DESC`,
      [safeInt(idEvento, 0)]
    );

    return res.json(result.rows);
  } catch (err) {
    console.error('❌ Erro ao buscar participantes do evento:', err);
    return res.status(500).json({ error: 'Erro interno ao listar participantes.' });
  }
};