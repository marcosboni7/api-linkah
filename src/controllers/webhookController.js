const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const path = require('path');
// Usamos path.join para evitar erros de caminho no Linux/Render
const db = require(path.join(__dirname, '../config/database'));

exports.ouvirStripe = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // Verifica a assinatura do Stripe
    event = stripe.webhooks.constructEvent(
      req.body, 
      sig, 
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.log(`⚠️ Erro no Webhook: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Quando o pagamento é confirmado
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    console.log(`✅ Pagamento aprovado para: ${session.metadata.usuarioEmail}`);
    
    try {
      // SALVAR NO SEU BANCO DE DADOS (public.compras)
      const query = `
        INSERT INTO public.compras (usuario_email, evento_id, quantidade, status, stripe_session_id)
        VALUES ($1, $2, $3, $4, $5)
      `;

      await db.query(query, [
        session.metadata.usuarioEmail,
        session.metadata.eventoId,
        session.metadata.quantidade,
        'pago',
        session.id
      ]);

      console.log('✨ Compra registrada no banco com sucesso!');
    } catch (dbErr) {
      console.error('❌ Erro ao salvar compra no banco:', dbErr.message);
    }
  }

  res.json({ received: true });
};