const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('../config/database'); 
const sendMail = require('../services/emailService'); // <--- 1. IMPORTAÇÃO ADICIONADA

exports.ouvirStripe = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body, 
      sig, 
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.log(`⚠️ Erro no Webhook: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    
    const { usuarioEmail, eventoId, quantidade } = session.metadata;

    console.log(`✅ Pagamento aprovado para: ${usuarioEmail}`);
    
    try {
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

      // --- 2. LÓGICA DE ENVIO DE E-MAIL ADICIONADA AQUI ---
      const linkIngresso = `https://linkah-frontend-ivory.vercel.app/pagamento/sucesso?session_id=${session.id}`;
      
      const conteudoHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #f43f5e;">Seu ingresso LINKAH chegou! 🎫</h1>
          <p>Olá, o seu pagamento foi confirmado com sucesso.</p>
          <p><strong>Evento ID:</strong> ${eventoId}</p>
          <p><strong>Quantidade:</strong> ${quantidade}x</p>
          <br />
          <a href="${linkIngresso}" 
             style="background-color: #f43f5e; color: white; padding: 15px 25px; text-decoration: none; border-radius: 10px; font-weight: bold; display: inline-block;">
            ACESSAR MEU INGRESSO AGORA
          </a>
          <br /><br />
          <p style="font-size: 12px; color: #666;">Se o botão não funcionar, copie este link: ${linkIngresso}</p>
        </div>
      `;

      await sendMail(usuarioEmail, "Seu Ingresso LINKAH Chegou! 🎫", conteudoHtml);
      // ---------------------------------------------------

    } catch (dbErr) {
      console.error('❌ Erro no processo pós-pagamento:', dbErr.message);
    }
  }

  res.json({ received: true });
};