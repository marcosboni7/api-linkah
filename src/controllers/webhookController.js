const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('../config/database'); 

exports.ouvirStripe = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // Verifica a assinatura para garantir que o aviso veio do Stripe
    event = stripe.webhooks.constructEvent(
      req.body, 
      sig, 
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.log(`⚠️ Erro no Webhook: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Quando o pagamento for confirmado no Stripe
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    
    // Pegamos os dados que salvamos no metadata lá no checkout
    const { usuarioEmail, eventoId, quantidade } = session.metadata;

    console.log(`✅ Pagamento aprovado para: ${usuarioEmail}`);
    
    try {
      // Inserimos a compra diretamente na sua tabela do PostgreSQL
      const query = `
        INSERT INTO public.compras (usuario_email, evento_id, quantidade, status, stripe_session_id)
        VALUES ($1, $2, $3, $4, $5)
      `;

      await db.query(query, [
        usuarioEmail,
        eventoId,
        parseInt(quantidade),
        'pago',
        session.id
      ]);

      console.log('✨ Compra registrada no banco com sucesso!');
    } catch (dbErr) {
      console.error('❌ Erro ao salvar no banco:', dbErr.message);
    }
  }

  res.json({ received: true });
};