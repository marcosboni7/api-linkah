const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.criarSessaoCheckout = async (req, res) => {
  try {
    const { evento, usuarioEmail, quantidade } = req.body;

    // Log para você conferir no Render se os dados chegaram
    console.log("Iniciando checkout para:", evento.titulo);

    const session = await stripe.checkout.sessions.create({
      // Como seu SDK é antigo, voltamos para a lista manual
      // ATENÇÃO: Se o Pix der erro de "método inválido", remova o 'pix' da lista abaixo
      // até que a conta do seu cliente seja aprovada no painel.
      payment_method_types: ['card', 'pix'], 
      line_items: [
        {
          price_data: {
            currency: 'brl',
            product_data: {
              name: evento.titulo || "Ingresso",
            },
            // Convertendo 0.8 para 80 centavos corretamente
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
    console.error("ERRO NO STRIPE:", err.message);
    res.status(500).json({ 
      error: "Erro ao processar pagamento", 
      details: err.message 
    });
  }
};