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
    console.log(`⚠️ Erro no Webhook Signature: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    
    // Pegamos os dados do metadata
    const { usuarioEmail, eventoId, quantidade } = session.metadata;

    console.log(`✅ Pagamento aprovado via Stripe: ${usuarioEmail}`);
    
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

      // 2. BUSCA DADOS DO EVENTO (Incluindo link_reuniao e tipo)
      const queryEvento = `
        SELECT nome, data, hora, local, tipo, link_reuniao 
        FROM eventos 
        WHERE id = $1
      `;
      const eventoRes = await db.query(queryEvento, [eventoId]);
      const evento = eventoRes.rows[0];

      if (!evento) {
        console.error(`❌ Evento ID ${eventoId} não encontrado no banco.`);
        return res.status(404).json({ error: 'Evento não encontrado' });
      }

      // LOG DE SEGURANÇA: Verifique isso no log da AWS App Runner
      console.log(`🔍 DEBUG EVENTO: Tipo=${evento.tipo}, Link=${evento.link_reuniao}`);

      // 3. Prepara o link da página de sucesso
      const linkIngresso = `https://linkah-frontend-ivory.vercel.app/pagamento/sucesso?session_id=${session.id}`;
      
      // 4. Monta o objeto EXATAMENTE como o emailService espera
      const dadosParaEmail = {
        tituloEvento: evento.nome,
        dataEvento: evento.data ? new Date(evento.data).toLocaleDateString('pt-BR') : 'A confirmar',
        horaEvento: evento.hora || 'A confirmar',
        // Se for online, escrevemos "Evento Online" no campo local
        localEvento: evento.tipo === 'online' ? 'Evento Online' : (evento.local || 'A confirmar'),
        quantidade: quantidade,
        linkIngresso: linkIngresso,
        // Garanta que o nome da chave é linkReuniao (com R maiúsculo)
        linkReuniao: evento.link_reuniao, 
        tipo: evento.tipo
      };

      console.log('🚀 Disparando e-mail para o cliente...');

      // 5. Dispara o e-mail via Resend
      await enviarIngressoEmail(usuarioEmail, dadosParaEmail);

      console.log('✨ Fluxo finalizado com sucesso!');

    } catch (dbErr) {
      console.error('❌ Erro no processamento pós-pagamento:', dbErr.message);
    }
  }

  // Responde ao Stripe sempre com 200 para evitar retentativas desnecessárias
  res.json({ received: true });
};