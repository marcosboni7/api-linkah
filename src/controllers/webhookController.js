const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('../config/database'); 
const { enviarIngressoEmail } = require('../services/emailService'); // Importação ajustada para o novo serviço

exports.ouvirStripe = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // Verifica a assinatura do Stripe para segurança
    event = stripe.webhooks.constructEvent(
      req.body, 
      sig, 
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.log(`⚠️ Erro no Webhook: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Quando o pagamento for confirmado
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    
    // Pegamos os dados salvos no metadata durante o checkout
    const { usuarioEmail, eventoId, quantidade } = session.metadata;

    console.log(`✅ Pagamento aprovado para: ${usuarioEmail}`);
    
    try {
      // 1. Registra a compra no PostgreSQL
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

      // 2. Prepara o link e o conteúdo do e-mail
      const linkIngresso = `https://linkah-frontend-ivory.vercel.app/pagamento/sucesso?session_id=${session.id}`;
      
      const dadosParaEmail = {
        tituloEvento: "Evento Linkah", // Você pode buscar o nome real no banco se quiser
        quantidade: quantidade,
        linkIngresso: linkIngresso
      };

      // 3. Dispara o e-mail via Resend
      // Usamos o await para garantir que o envio seja processado antes de responder ao Stripe
      await enviarIngressoEmail(usuarioEmail, dadosParaEmail);

    } catch (dbErr) {
      console.error('❌ Erro no processamento pós-pagamento:', dbErr.message);
      // Aqui não damos return res.status(500) para o Stripe não ficar tentando reenviar o webhook infinitamente
    }
  }

  // Responde ao Stripe que o evento foi recebido
  res.json({ received: true });
};