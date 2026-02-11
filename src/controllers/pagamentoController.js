const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.criarSessaoCheckout = async (req, res) => {
  try {
    const { evento, usuarioEmail, quantidade } = req.body;

    // Log para conferência no log do Render
    console.log("Iniciando checkout Live (Apenas Cartão) para:", evento.titulo);

    const session = await stripe.checkout.sessions.create({
      // Removido 'pix' para evitar erro de conta nova (trava de 60 dias)
      payment_method_types: ['card'], 
      line_items: [
        {
          price_data: {
            currency: 'brl',
            product_data: {
              name: evento.titulo || "Ingresso",
            },
            // Converte o preço para centavos (Ex: 50.00 -> 5000)
            unit_amount: Math.round(parseFloat(evento.preco) * 100),
          },
          quantity: parseInt(quantidade) || 1,
        },
      ],
      mode: 'payment',
      customer_email: usuarioEmail, // Preenche o e-mail automaticamente no Stripe
      success_url: `https://linkah-frontend-ivory.vercel.app/pagamento/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://linkah-frontend-ivory.vercel.app/checkout?eventoId=${evento.id}`,
      metadata: {
        usuarioEmail: usuarioEmail || "nao_informado",
        eventoId: evento.id ? evento.id.toString() : "0",
        quantidade: quantidade ? quantidade.toString() : "1",
      },
    });

    // Retorna o ID da sessão para o frontend fazer o redirecionamento
    res.json({ id: session.id });

  } catch (err) {
    console.error("ERRO NO STRIPE:", err.message);
    res.status(500).json({ 
      error: "Erro ao processar pagamento", 
      details: err.message 
    });
  }
};