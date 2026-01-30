const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
// Importe seu modelo de Ingressos/Pedidos para salvar no banco
const Ingresso = require('../models/Ingresso'); 

exports.ouvirStripe = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // Verifica se o evento realmente veio do Stripe (Segurança)
    event = stripe.webhooks.constructEvent(
      req.body, 
      sig, 
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.log(`⚠️ Erro no Webhook: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Lógica quando o pagamento é confirmado
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    // Aqui você integra com seu banco de dados
    console.log(`✅ Pagamento aprovado para o e-mail: ${session.customer_email}`);
    
    // Exemplo: Criar o ingresso no banco
    await Ingresso.create({
      eventoId: session.metadata.eventoId,
      usuarioEmail: session.customer_email,
      status: 'pago',
      stripeSessionId: session.id
    });
  }

  // Responde ao Stripe que recebeu o aviso
  res.json({ received: true });
};