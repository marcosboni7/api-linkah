const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.error('❌ STRIPE_SECRET_KEY não definida no ambiente.');
}

const stripe = require('stripe')(stripeSecretKey || '');
const db = require('../config/database');
const { enviarIngressoEmail } = require('../services/emailService');

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://linkah.eu';

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

  try {
    const asString = err.toString?.();
    if (typeof asString === 'string' && asString.trim() && asString !== '[object Object]') {
      return asString;
    }
  } catch {}

  return 'Erro desconhecido';
}

// --- 1. CRIAR SESSÃO DE CHECKOUT ---
exports.criarSessaoCheckout = async (req, res) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: 'STRIPE_SECRET_KEY não configurada.' });
    }

    const { evento, usuarioEmail, quantidade } = req.body;
    const baseUrl = FRONTEND_URL;

    if (!isValidHttpUrl(baseUrl)) {
      return res.status(500).json({ error: 'FRONTEND_URL inválida ou ausente.' });
    }

    if (!evento?.id) {
      return res.status(400).json({ error: 'ID do evento não informado.' });
    }

    const quantidadeFinal = safeInt(quantidade, 0);

    if (quantidadeFinal <= 0) {
      return res.status(400).json({ error: 'Quantidade inválida.' });
    }

    const dadosEventoBD = await db.query(
      `SELECT 
        e.id, e.nome, e.data_inicio, e.hora_inicio, e.local_nome, e.preco, e.tipo, e.link_reuniao, e.moeda,
        COALESCE(p.stripe_account_id, u.stripe_account_id) as stripe_account_id
       FROM public.eventos e
       LEFT JOIN public.produtores p ON e.produtor_email = p.email 
       LEFT JOIN public.usuarios u ON e.produtor_email = u.email
       WHERE e.id = $1`,
      [evento.id]
    );

    if (dadosEventoBD.rows.length === 0) {
      return res.status(404).json({ error: 'Evento não encontrado ou produtor não vinculado.' });
    }

    const ev = dadosEventoBD.rows[0];

    const moedaFinal = safeString(ev.moeda || 'brl', 'brl').toLowerCase();

    const precoBanco = safeNumber(ev.preco, 0);
    const precoBody = safeNumber(evento?.preco, 0);
    const precoUnitario = precoBanco !== 0 ? precoBanco : precoBody;

    if (precoUnitario <= 0) {
      return res.status(400).json({ error: 'Preço do evento inválido.' });
    }

    const precoFinalEmCentavos = Math.round(precoUnitario * 100);

    if (precoFinalEmCentavos < 50) {
      return res.status(400).json({ error: `Valor mínimo 0.50 ${moedaFinal.toUpperCase()}.` });
    }

    const dataEventoFormatada = ev.data_inicio
      ? new Date(ev.data_inicio).toLocaleDateString('pt-BR')
      : 'Data a definir';

    const localEventoFinal =
      ev.tipo?.toLowerCase() === 'online'
        ? 'Evento Online'
        : ev.local_nome || 'Local a definir';

    const sessionParams = {
      payment_method_types: ['card'],
      customer_email: safeString(usuarioEmail),
      line_items: [
        {
          price_data: {
            currency: moedaFinal,
            product_data: {
              name: `Ingresso: ${safeString(ev.nome, 'Evento')}`,
              description: `Evento em ${dataEventoFormatada}`,
            },
            unit_amount: precoFinalEmCentavos,
          },
          quantity: quantidadeFinal,
        },
      ],
      mode: 'payment',
      metadata: {
        usuarioEmail: safeString(usuarioEmail),
        eventoId: safeString(ev.id),
        tituloEvento: safeString(ev.nome, 'Evento'),
        quantidade: safeString(quantidadeFinal),
        dataEvento: dataEventoFormatada,
        horaEvento: safeString(ev.hora_inicio, 'A confirmar'),
        localEvento: safeString(localEventoFinal, 'Local a definir'),
        linkReuniao: safeString(ev.link_reuniao, ''),
        moeda: moedaFinal.toUpperCase(),
      },
      success_url: `${baseUrl}/pagamento/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/venda?eventoId=${ev.id}&qtd=${quantidadeFinal}`,
    };

    if (ev.stripe_account_id) {
      const feePercent = 0.05;
      sessionParams.payment_intent_data = {
        application_fee_amount: Math.round(precoFinalEmCentavos * feePercent * quantidadeFinal),
        transfer_data: { destination: ev.stripe_account_id },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    return res.json({ url: session.url });
  } catch (err) {
    const errorMessage = getErrorMessage(err);
    console.error('❌ Erro Stripe Checkout:', err);
    return res.status(500).json({ error: errorMessage });
  }
};

// --- 2. VINCULAR CONTA DO PRODUTOR ---
exports.vincularContaStripe = async (req, res) => {
  try {
    const { email } = req.body;

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
    const errorMessage = getErrorMessage(err);
    console.error('❌ Erro Onboarding:', err);
    return res.status(500).json({ error: errorMessage });
  }
};

// --- 3. VERIFICAR STATUS DA CONTA ---
exports.verificarStatusStripe = async (req, res) => {
  try {
    const { email } = req.query;

    const result = await db.query(
      'SELECT stripe_account_id FROM public.produtores WHERE email = $1 LIMIT 1',
      [email]
    );

    const stripeAccountId = result.rows[0]?.stripe_account_id;

    if (!stripeAccountId) {
      return res.json({ conectado: false });
    }

    const account = await stripe.accounts.retrieve(stripeAccountId);
    const temPendencias = Array.isArray(account?.requirements?.currently_due)
      ? account.requirements.currently_due.length > 0
      : false;

    const estaHabilitado = !!account.charges_enabled && !!account.payouts_enabled;

    return res.json({
      conectado: true,
      status_banco: estaHabilitado && !temPendencias ? 'Ativo' : 'Pendente',
      details_submitted: !!account.details_submitted,
      charges_enabled: !!account.charges_enabled,
      payouts_enabled: !!account.payouts_enabled,
      business_name: account.settings?.dashboard?.display_name || 'Conta Vinculada',
      email_stripe: account.email || '',
    });
  } catch (err) {
    const errorMessage = getErrorMessage(err);
    console.error('❌ Erro ao verificar status Stripe:', err);
    return res.status(500).json({ error: errorMessage });
  }
};

// --- 4. WEBHOOK ---
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
    const errorMessage = getErrorMessage(err);
    console.error(`⚠️ Webhook Signature Error: ${errorMessage}`);
    return res.status(400).send(`Webhook Error: ${errorMessage}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const meta = session.metadata || {};

    try {
      const existeResult = await db.query(
        'SELECT id FROM public.compras WHERE stripe_session_id = $1',
        [session.id]
      );
      const jaExisteNoBanco = existeResult.rows.length > 0;

      const idEvento = safeInt(meta.eventoId, 0);

      const evResult = await db.query(
        'SELECT nome, link_reuniao, tipo FROM public.eventos WHERE id = $1',
        [idEvento]
      );
      const evData = evResult.rows[0];

      if (!jaExisteNoBanco) {
        await db.query(
          `INSERT INTO public.compras 
          (usuario_email, evento_id, evento_nome, data_evento, quantidade, valor_total, status, stripe_session_id)
          VALUES ($1, $2, $3, $4, $5, $6, 'Aprovado', $7)`,
          [
            safeString(meta.usuarioEmail),
            idEvento,
            evData?.nome || safeString(meta.tituloEvento, 'Evento'),
            new Date(),
            safeInt(meta.quantidade, 1),
            safeNumber(session.amount_total, 0) / 100,
            session.id,
          ]
        );
      }

      const tipoEvento = safeString(evData?.tipo || meta.tipo || 'presencial').toLowerCase();

      await enviarIngressoEmail(safeString(meta.usuarioEmail), {
        tituloEvento: evData?.nome || safeString(meta.tituloEvento, 'Evento'),
        quantidade: safeString(meta.quantidade, '1'),
        linkIngresso: `${FRONTEND_URL}/pagamento/sucesso?session_id=${session.id}`,
        dataEvento: safeString(meta.dataEvento, 'A confirmar'),
        horaEvento: safeString(meta.horaEvento, 'A confirmar'),
        localEvento: safeString(meta.localEvento, 'Local a definir'),
        linkReuniao: evData?.link_reuniao || safeString(meta.linkReuniao, ''),
        tipo: tipoEvento,
      });

      console.log(`✅ Webhook processado: Venda em ${safeString(session.currency, 'brl').toUpperCase()}`);
    } catch (err) {
      console.error('❌ Erro no Webhook:', err);
    }
  }

  res.json({ received: true });
};

// --- 5. BUSCAR DETALHES ---
exports.buscarDetalhesCompra = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const result = await db.query(
      `SELECT c.*, e.hora_inicio as hora_evento, e.local_nome as local_evento, e.link_reuniao, e.tipo
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
      const meta = session.metadata || {};
      const eventoId = safeInt(meta.eventoId, 0);

      const evResult = await db.query(
        'SELECT nome, link_reuniao, tipo FROM public.eventos WHERE id = $1',
        [eventoId]
      );
      const evData = evResult.rows[0];

      const novaCompra = await db.query(
        `INSERT INTO public.compras 
          (usuario_email, evento_id, evento_nome, data_evento, quantidade, valor_total, status, stripe_session_id)
          VALUES ($1, $2, $3, $4, $5, $6, 'Aprovado', $7) RETURNING *`,
        [
          safeString(meta.usuarioEmail),
          eventoId,
          evData?.nome || safeString(meta.tituloEvento, 'Evento'),
          new Date(),
          safeInt(meta.quantidade, 1),
          safeNumber(session.amount_total, 0) / 100,
          session.id,
        ]
      );

      return res.json({
        ...novaCompra.rows[0],
        link_reuniao: evData?.link_reuniao,
        tipo: evData?.tipo,
      });
    }

    return res.status(404).json({ error: 'Compra não encontrada.' });
  } catch (err) {
    const errorMessage = getErrorMessage(err);
    console.error('❌ Erro Detalhes:', err);
    return res.status(500).json({ error: errorMessage });
  }
};

// --- 6. LISTAR INGRESSOS ---
exports.listarMeusIngressos = async (req, res) => {
  try {
    const { email } = req.query;

    const result = await db.query(
      `SELECT c.*, e.link_reuniao, TO_CHAR(c.data_evento, 'DD/MM/YYYY') as data 
        FROM public.compras c 
        LEFT JOIN public.eventos e ON e.id = c.evento_id
        WHERE c.usuario_email = $1 ORDER BY c.id DESC`,
      [email]
    );

    return res.json(result.rows);
  } catch (err) {
    const errorMessage = getErrorMessage(err);
    console.error('❌ Erro ao buscar ingressos:', err);
    return res.status(500).json({ error: errorMessage });
  }
};