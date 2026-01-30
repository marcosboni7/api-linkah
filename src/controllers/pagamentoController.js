const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.criarSessaoCheckout = async (req, res) => {
  try {
    const { evento, usuarioEmail, quantidade } = req.body;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'pix'],
      line_items: [
        {
          price_data: {
            currency: 'brl',
            product_data: {
              name: evento.titulo,
            },
            unit_amount: Math.round(evento.preco * 100), // Preço em centavos
          },
          quantity: quantidade,
        },
      ],
      mode: 'payment',
      
      // ✅ AQUI ESTÁ O SEGREDO: Redirecionar para a sua página de sucesso na Vercel
      success_url: `https://linkah-frontend-ivory.vercel.app/pagamento/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://linkah-frontend-ivory.vercel.app/checkout?eventoId=${evento.id}`,
      
      metadata: {
        usuarioEmail,
        eventoId: evento.id,
        quantidade: quantidade.toString(),
      },
    });

    res.json({ id: session.id });
  } catch (err) {
    console.error("Erro ao criar sessão do Stripe:", err);
    res.status(500).json({ error: err.message });
  }
};