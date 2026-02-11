const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.criarSessaoCheckout = async (req, res) => {
  try {
    const { evento, usuarioEmail, quantidade } = req.body;

    console.log("Tentando criar sessão real para:", evento.titulo);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          // REMOVEMOS o price_data complexo e simplificamos para o básico
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
      // Importante: Algumas contas novas exigem que o e-mail não seja enviado 
      // se não houver um cliente cadastrado. Vamos comentar esta linha para testar:
      // customer_email: usuarioEmail, 
      success_url: `https://linkah-frontend-ivory.vercel.app/pagamento/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://linkah-frontend-ivory.vercel.app/checkout?eventoId=${evento.id}`,
    });

    console.log("Sessão criada com sucesso! ID:", session.id);
    res.json({ id: session.id });

  } catch (err) {
    // ESTA LINHA É A MAIS IMPORTANTE AGORA:
    console.error("ERRO REAL DA STRIPE:", err.raw ? err.raw.message : err.message);
    
    res.status(500).json({ 
      error: "Erro na Stripe", 
      details: err.message 
    });
  }
};