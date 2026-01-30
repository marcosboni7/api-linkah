const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.criarSessaoCheckout = async (req, res) => {
  try {
    const { evento, usuarioEmail, quantidade } = req.body;

    // Validação de segurança: evita erro 500 se o frontend mandar dados vazios
    if (!evento || !evento.preco) {
      return res.status(400).json({ error: "Dados do evento inválidos ou preço ausente." });
    }

    const session = await stripe.checkout.sessions.create({
      automatic_payment_methods: {
        enabled: true,
      },
      line_items: [
        {
          price_data: {
            currency: 'brl',
            product_data: {
              name: evento.titulo || "Ingresso",
            },
            unit_amount: Math.round(parseFloat(evento.preco) * 100),
          },
          quantity: parseInt(quantidade) || 1,
        },
      ],
      mode: 'payment',
      success_url: `https://linkah-frontend-ivory.vercel.app/pagamento/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://linkah-frontend-ivory.vercel.app/checkout?eventoId=${evento.id}`,
      metadata: {
        usuarioEmail: usuarioEmail || "nao_informado",
        eventoId: evento.id ? evento.id.toString() : "0",
        quantidade: quantidade ? quantidade.toString() : "1",
      },
    });

    res.json({ id: session.id });

  } catch (err) {
    // Isso vai imprimir o erro real no console do Render para você ler
    console.error("ERRO DETALHADO DO STRIPE:", err);
    
    res.status(500).json({ 
      error: "Erro ao processar pagamento", 
      details: err.message 
    });
  }
};