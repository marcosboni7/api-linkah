const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.criarSessaoCheckout = async (req, res) => {
  try {
    const { evento, usuarioEmail } = req.body;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'pix'], // Pix é essencial no BR
      line_items: [{
        price_data: {
          currency: 'brl',
          product_data: { name: evento.titulo },
          unit_amount: Math.round(evento.preco * 100),
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${process.env.CLIENT_URL}/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/evento/${evento.id}`,
      customer_email: usuarioEmail,
      metadata: { eventoId: evento.id }
    });

    res.json({ id: session.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};