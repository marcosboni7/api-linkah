const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('../config/database'); 
const { enviarIngressoEmail } = require('../services/emailService');

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
      // 1. Registra a compra no PostgreSQL
      const queryCompra = `
        INSERT INTO public.compras (usuario_email, evento_id, quantidade, status, stripe_session_id)
        VALUES ($1, $2, $3, $4, $5)
      `;

      await db.query(queryCompra, [
        usuarioEmail,
        eventoId,
        parseInt(quantidade),
        'pago',
        session.id
      ]);

      // 2. BUSCA DADOS DO EVENTO PARA O E-MAIL
      // Aqui pegamos o link_reuniao e o tipo para diferenciar online/presencial
      const queryEvento = `
        SELECT nome, data, hora, local, tipo, link_reuniao 
        FROM eventos 
        WHERE id = $1
      `;
      const eventoRes = await db.query(queryEvento, [eventoId]);
      const evento = eventoRes.rows[0];

      if (!evento) {
        throw new Error('Evento não encontrado no banco de dados');
      }

      console.log('✨ Compra registrada e dados do evento recuperados!');

      // 3. Prepara os dados para o e-mail
      const linkIngresso = `https://linkah-frontend-ivory.vercel.app/pagamento/sucesso?session_id=${session.id}`;
      
      const dadosParaEmail = {
        tituloEvento: evento.nome,
        dataEvento: evento.data ? new Date(evento.data).toLocaleDateString('pt-BR') : 'A confirmar',
        horaEvento: evento.hora || 'A confirmar',
        localEvento: evento.tipo === 'online' ? 'Evento Online' : (evento.local || 'A confirmar'),
        quantidade: quantidade,
        linkIngresso: linkIngresso,
        linkReuniao: evento.tipo === 'online' ? evento.link_reuniao : null,
        tipo: evento.tipo
      };

      // 4. Dispara o e-mail via Resend
      await enviarIngressoEmail(usuarioEmail, dadosParaEmail);

    } catch (dbErr) {
      console.error('❌ Erro no processamento pós-pagamento:', dbErr.message);
    }
  }

  res.json({ received: true });
};