const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.criarSessaoCheckout = async (req, res) => {
  try {
    const { evento, usuarioEmail, quantidade } = req.body;

    console.log("Tentando criar sessão real para:", evento.titulo);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'], // Mantendo apenas cartão conforme solicitado anteriormente
      line_items: [
        {
          price_data: {
            currency: 'brl',
            product_data: {
              name: evento.titulo || "Ingresso",
            },
            unit_amount: Math.round(Number(evento.preco) * 100),
          },
          quantity: Number(quantidade) || 1,
        },
      ],
      mode: 'payment',
      // customer_email: usuarioEmail, // Opcional: descomente se quiser pré-preencher o email na Stripe
      success_url: `https://linkah-frontend-ivory.vercel.app/pagamento/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://linkah-frontend-ivory.vercel.app/venda?eventoId=${evento.id}`,
    });

    console.log("Sessão criada com sucesso! ID:", session.id);
    
    // IMPORTANTE: Retornamos a URL para o redirecionamento direto
    res.json({ 
      id: session.id, 
      url: session.url 
    });

  } catch (err) {
    console.error("ERRO REAL DA STRIPE:", err.raw ? err.raw.message : err.message);
    res.status(500).json({ 
      error: "Erro na Stripe", 
      details: err.message 
    });
  }
};