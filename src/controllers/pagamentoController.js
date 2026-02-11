const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// --- 1. FUNÇÃO DE CRIAÇÃO DA SESSÃO (CHECKOUT) ---
exports.criarSessaoCheckout = async (req, res) => {
  console.log("--- 📥 NOVA REQUISIÇÃO DE CHECKOUT (DIVISÃO DE TAXA) ---");
  try {
    const { evento, usuarioEmail, quantidade } = req.body;

    if (!evento?.preco) {
      console.error("❌ Erro: Preço do evento não encontrado.");
      return res.status(400).json({ error: "Preço não informado" });
    }

    // CÁLCULO DA DIVISÃO (10% de taxa para a Linkah)
    const porcentagemTaxa = 0.10; 
    const precoUnitarioCentavos = Math.round(Number(evento.preco) * 100);
    const totalVendaCentavos = precoUnitarioCentavos * (Number(quantidade) || 1);
    const applicationFeeCentavos = Math.round(totalVendaCentavos * porcentagemTaxa);

    // ID DA CONTA DO VICTOR HUGO (CONECTADA)
    const stripeAccountId = "acct_1SyzoICXDu6urvwI"; 

    console.log(`📦 Processando R$ ${(totalVendaCentavos / 100).toFixed(2)} para conta: ${stripeAccountId}`);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'brl',
          product_data: { 
            name: evento.titulo || "Ingresso",
            description: "Pagamento processado via Linkah"
          },
          unit_amount: precoUnitarioCentavos,
        },
        quantity: Number(quantidade) || 1,
      }],
      mode: 'payment',
      customer_email: usuarioEmail,

      // O METADATA envia dados ocultos para o Webhook ler depois
      metadata: {
        eventoId: evento.id,
        quantidade: quantidade,
        usuarioEmail: usuarioEmail,
        tituloEvento: evento.titulo
      },

      // CONFIGURAÇÃO DO STRIPE CONNECT (SPLIT)
      payment_intent_data: {
        application_fee_amount: applicationFeeCentavos,
        transfer_data: {
          destination: stripeAccountId,
        },
      },

      success_url: `https://linkah-frontend-ivory.vercel.app/pagamento/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://linkah-frontend-ivory.vercel.app/venda?eventoId=${evento.id}`,
    });

    console.log("✅ Sessão Connect criada com sucesso!");
    res.json({ id: session.id, url: session.url });

  } catch (err) {
    console.error("❌ ERRO NO CHECKOUT:", err.message);
    res.status(500).json({ error: "Erro na Stripe", details: err.message });
  }
};

// --- 2. FUNÇÃO DO WEBHOOK (Ouvinte de Pagamentos) ---
exports.webhookStripe = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // É obrigatório usar req.body em formato RAW para o Webhook
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error(`⚠️ Erro de assinatura Webhook: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Evento disparado quando o pagamento é concluído com sucesso
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    // Recupera os dados que enviamos no metadata
    const { eventoId, quantidade, usuarioEmail, tituloEvento } = session.metadata;

    console.log("----------------------------------------------");
    console.log("💰 PAGAMENTO APROVADO COM SUCESSO!");
    console.log(`🎟️ Evento: ${tituloEvento} (ID: ${eventoId})`);
    console.log(`👥 Cliente: ${usuarioEmail}`);
    console.log(`🔢 Quantidade: ${quantidade}`);
    console.log(`💵 Valor Total: R$ ${session.amount_total / 100}`);
    console.log("----------------------------------------------");

    // TODO: Aqui você insere a lógica do seu banco de dados
    // Exemplo: await Ingresso.create({ eventoId, email: usuarioEmail, pago: true });
    
  }

  // Responde para a Stripe que o aviso foi recebido
  res.status(200).json({ received: true });
};