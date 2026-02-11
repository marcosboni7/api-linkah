const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.criarSessaoCheckout = async (req, res) => {
  console.log("--- 📥 NOVA REQUISIÇÃO DE CHECKOUT ---");
  try {
    const { evento, usuarioEmail, quantidade } = req.body;

    // Log dos dados recebidos
    console.log("📦 Dados recebidos do Front:", {
      eventoId: evento?.id,
      titulo: evento?.titulo,
      email: usuarioEmail,
      qtd: quantidade
    });

    if (!evento?.preco) {
      console.error("❌ Erro: Preço do evento não encontrado no body");
      return res.status(400).json({ error: "Preço não informado" });
    }

    console.log("⏳ Chamando Stripe API...");
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'brl',
          product_data: { name: evento.titulo || "Ingresso" },
          unit_amount: Math.round(Number(evento.preco) * 100),
        },
        quantity: Number(quantidade) || 1,
      }],
      mode: 'payment',
      customer_email: usuarioEmail,
      success_url: `https://linkah-frontend-ivory.vercel.app/pagamento/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://linkah-frontend-ivory.vercel.app/venda?eventoId=${evento.id}`,
    });

    console.log("✅ Sessão Stripe criada com sucesso!");
    console.log("🔗 URL de redirecionamento:", session.url);

    res.json({ id: session.id, url: session.url });

  } catch (err) {
    console.error("❌ ERRO NO CONTROLLER DE PAGAMENTO:");
    console.error("Detalhes:", err.raw ? err.raw.message : err.message);
    res.status(500).json({ error: "Erro na Stripe", details: err.message });
  }
};