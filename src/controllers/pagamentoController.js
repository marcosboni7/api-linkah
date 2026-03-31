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

    const dadosEventoBD = await db.query(
      `SELECT 
        e.id, e.nome, e.data_inicio, e.hora_inicio, e.local_nome, e.preco, e.tipo, e.link_reuniao,
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
    const precoUnitario = ev.preco && Number(ev.preco) !== 0 ? Number(ev.preco) : Number(evento.preco);
    const precoFinalEmCentavos = Math.round(precoUnitario * 100);

    if (precoFinalEmCentavos < 50) {
      return res.status(400).json({ error: 'Valor mínimo R$ 0,50.' });
    }

    const sessionParams = {
      payment_method_types: ['card'],
      customer_email: usuarioEmail,
      line_items: [
        {
          price_data: {
            currency: 'brl',
            product_data: {
              name: `Ingresso: ${ev.nome}`,
              description: `Evento em ${
                ev.data_inicio ? new Date(ev.data_inicio).toLocaleDateString('pt-BR') : 'Data a definir'
              }`,
            },
            unit_amount: precoFinalEmCentavos,
          },
          quantity: parseInt(quantidade),
        },
      ],
      mode: 'payment',
      metadata: {
        usuarioEmail,
        eventoId: ev.id.toString(),
        tituloEvento: ev.nome,
        quantidade: quantidade.toString(),
        dataEvento: ev.data_inicio ? new Date(ev.data_inicio).toLocaleDateString('pt-BR') : 'A confirmar',
        horaEvento: ev.hora_inicio || 'A confirmar',
        localEvento: ev.tipo === 'online' ? 'Evento Online' : ev.local_nome || 'Local a definir',
        linkReuniao: ev.link_reuniao || '',
      },
      success_url: `${baseUrl}/pagamento/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/venda?eventoId=${ev.id}&qtd=${quantidade}`,
    };

    if (ev.stripe_account_id) {
      const feePercent = 0.05; // Sua comissão de 5%
      sessionParams.payment_intent_data = {
        application_fee_amount: Math.round(precoFinalEmCentavos * feePercent * parseInt(quantidade)),
        transfer_data: { destination: ev.stripe_account_id },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    return res.json({ url: session.url });
  } catch (err) {
    console.error('❌ Erro Stripe Checkout:', err);
    return res.status(500).json({ error: err.message });
  }
};

// --- 2. VINCULAR CONTA DO PRODUTOR ---
exports.vincularContaStripe = async (req, res) => {
  try {
    const { email } = req.body;
    const produtorResult = await db.query('SELECT stripe_account_id FROM public.produtores WHERE email = $1 LIMIT 1', [email]);
    const usuarioResult = await db.query('SELECT stripe_account_id FROM public.usuarios WHERE email = $1 LIMIT 1', [email]);
    const registro = produtorResult.rows[0] || usuarioResult.rows[0];

    let stripeAccountId = registro?.stripe_account_id || null;

    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email,
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      });
      stripeAccountId = account.id;
      await db.query('UPDATE public.produtores SET stripe_account_id = $1 WHERE email = $2', [stripeAccountId, email]);
      await db.query('UPDATE public.usuarios SET stripe_account_id = $1 WHERE email = $2', [stripeAccountId, email]);
    }

    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${FRONTEND_URL}/dashboard/perfil`,
      return_url: `${FRONTEND_URL}/dashboard/perfil?stripe_callback=true`,
      type: 'account_onboarding',
    });

    return res.json({ ok: true, url: accountLink.url });
  } catch (err) {
    console.error('❌ Erro Onboarding:', err);
    return res.status(500).json({ error: err.message });
  }
};

// --- 3. VERIFICAR STATUS DA CONTA ---
exports.verificarStatusStripe = async (req, res) => {
  try {
    const { email } = req.query;
    const result = await db.query('SELECT stripe_account_id FROM public.produtores WHERE email = $1 LIMIT 1', [email]);
    const stripeAccountId = result.rows[0]?.stripe_account_id;

    if (!stripeAccountId) return res.json({ conectado: false });

    const account = await stripe.accounts.retrieve(stripeAccountId);
    return res.json({
      conectado: true,
      status_banco: account.details_submitted ? 'Ativo' : 'Pendente',
      details_submitted: account.details_submitted,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// --- 4. WEBHOOK (CORRIGIDO PARA O E-MAIL FUNCIONAR) ---
exports.webhookStripe = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error(`⚠️ Webhook Signature Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const meta = session.metadata;

    console.log(`\n🔔 Webhook recebido para: ${meta.usuarioEmail}`);

    try {
      // 1. Verifica se a compra já existe no banco
      const existeResult = await db.query('SELECT id FROM public.compras WHERE stripe_session_id = $1', [session.id]);
      const jaExisteNoBanco = existeResult.rows.length > 0;

      const idEvento = parseInt(meta.eventoId);
      const evResult = await db.query('SELECT nome, link_reuniao, tipo FROM public.eventos WHERE id = $1', [idEvento]);
      const evData = evResult.rows[0];

      // 2. Se não existir, registra (caso o webhook chegue antes do redirecionamento)
      if (!jaExisteNoBanco) {
        console.log("📝 Registrando nova compra via Webhook...");
        await db.query(
          `INSERT INTO public.compras 
          (usuario_email, evento_id, evento_nome, data_evento, quantidade, valor_total, status, stripe_session_id)
          VALUES ($1, $2, $3, $4, $5, $6, 'Aprovado', $7)`,
          [
            meta.usuarioEmail,
            idEvento,
            evData?.nome || meta.tituloEvento,
            new Date(),
            parseInt(meta.quantidade),
            session.amount_total / 100,
            session.id,
          ]
        );
      }

      // 3. ENVIO DO E-MAIL (Fora do bloco de inserção para garantir o disparo)
      console.log(`📧 Disparando e-mail de ingresso para: ${meta.usuarioEmail}`);
      await enviarIngressoEmail(meta.usuarioEmail, {
        tituloEvento: evData?.nome || meta.tituloEvento,
        quantidade: meta.quantidade,
        linkIngresso: `${FRONTEND_URL}/pagamento/sucesso?session_id=${session.id}`,
        dataEvento: meta.dataEvento,
        horaEvento: meta.horaEvento,
        localEvento: meta.localEvento,
        linkReuniao: evData?.link_reuniao || meta.linkReuniao || '',
        tipo: evData?.tipo || 'presencial'
      });

      console.log("✅ Webhook processado e e-mail enviado!");

    } catch (err) {
      console.error('❌ Erro no processamento interno do Webhook:', err.message);
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

    // Fallback: Se o webhook atrasou, busca no Stripe e insere agora
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status === 'paid') {
      const meta = session.metadata;
      const evResult = await db.query('SELECT nome, link_reuniao, tipo FROM public.eventos WHERE id = $1', [parseInt(meta.eventoId)]);
      const evData = evResult.rows[0];

      const novaCompra = await db.query(
        `INSERT INTO public.compras 
         (usuario_email, evento_id, evento_nome, data_evento, quantidade, valor_total, status, stripe_session_id)
         VALUES ($1, $2, $3, $4, $5, $6, 'Aprovado', $7) RETURNING *`,
        [meta.usuarioEmail, parseInt(meta.eventoId), evData?.nome || meta.tituloEvento, new Date(), parseInt(meta.quantidade), session.amount_total / 100, session.id]
      );

      return res.json({ ...novaCompra.rows[0], link_reuniao: evData?.link_reuniao, tipo: evData?.tipo });
    }

    return res.status(404).json({ error: 'Compra não encontrada.' });
  } catch (err) {
    console.error('❌ Erro Detalhes:', err.message);
    return res.status(500).json({ error: err.message });
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
    return res.status(500).json({ error: 'Erro ao buscar ingressos.' });
  }
};