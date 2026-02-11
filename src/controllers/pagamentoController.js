const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

/**
 * Cria uma sessão de checkout na Stripe e retorna a URL de redirecionamento.
 * Padrão Stripe API 2025/2026.
 */
exports.criarSessaoCheckout = async (req, res) => {
  try {
    const { evento, usuarioEmail, quantidade } = req.body;

    // Log para monitoramento no Render
    console.log(`🚀 Iniciando checkout: Evento ID ${evento.id} - ${evento.titulo}`);

    // 1. Validação básica de entrada
    if (!evento.preco) {
      throw new Error("O preço do evento não foi informado ou é inválido.");
    }

    // 2. Criação da sessão na Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'], // Apenas Cartão de Crédito habilitado
      line_items: [
        {
          price_data: {
            currency: 'brl',
            product_data: {
              name: evento.titulo || "Ingresso Linkah",
              // Se tiver imagem do evento, pode enviar aqui:
              // images: [evento.imagem_capa],
            },
            // A Stripe exige o valor em centavos (Ex: R$ 8,00 -> 800)
            unit_amount: Math.round(Number(evento.preco) * 100),
          },
          quantity: Number(quantidade) || 1,
        },
      ],
      mode: 'payment',

      // Preenche o e-mail automaticamente na tela de pagamento para facilitar ao usuário
      customer_email: usuarioEmail, 

      // URLs de retorno após a ação do usuário
      success_url: `https://linkah-frontend-ivory.vercel.app/pagamento/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://linkah-frontend-ivory.vercel.app/venda?eventoId=${evento.id}`,
    });

    console.log("✅ Sessão Stripe criada com sucesso! ID:", session.id);

    // 3. Resposta para o Frontend
    // Retornamos o ID para controle e a URL para o redirecionamento imediato
    res.json({ 
      id: session.id, 
      url: session.url 
    });

  } catch (err) {
    // Log detalhado para depuração no painel do Render
    const errorMessage = err.raw ? err.raw.message : err.message;
    console.error("❌ ERRO NA STRIPE:", errorMessage);

    res.status(500).json({ 
      error: "Erro ao processar checkout na Stripe", 
      details: errorMessage 
    });
  }
};