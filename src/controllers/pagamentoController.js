const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.criarSessaoCheckout = async (req, res) => {
  try {
    const { evento, usuarioEmail, quantidade } = req.body;

    // Criamos a sessão de checkout
    const session = await stripe.checkout.sessions.create({
      // ✅ MELHOR PRÁTICA: O Stripe gerencia os métodos ativos (Pix/Cartão)
      // Isso evita o erro 400 enquanto a conta do cliente está "em análise"
      automatic_payment_methods: {
        enabled: true,
      },
      
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
      
      // URLs de redirecionamento na Vercel
      success_url: `https://linkah-frontend-ivory.vercel.app/pagamento/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://linkah-frontend-ivory.vercel.app/checkout?eventoId=${evento.id}`,
      
      // Dados extras para você identificar a venda no Webhook depois
      metadata: {
        usuarioEmail: usuarioEmail,
        eventoId: evento.id.toString(),
        quantidade: quantidade.toString(),
      },
    });

    // Retorna o ID da sessão para o frontend redirecionar
    res.json({ id: session.id });

  } catch (err) {
    console.error("Erro ao criar sessão do Stripe:", err);
    
    // Retorna o erro detalhado para ajudar no debug
    res.status(500).json({ 
      error: "Erro ao processar pagamento", 
      details: err.message 
    });
  }
};