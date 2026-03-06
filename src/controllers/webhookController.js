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
    
    // Pegamos os dados do metadata (Garanta que esses nomes batem com o que você envia no Checkout)
    const { usuarioEmail, eventoId, quantidade } = session.metadata;

    console.log(`✅ Pagamento aprovado via Stripe: ${usuarioEmail}`);
    
    try {
      // 1. Registra a compra no PostgreSQL
      // Ajustado para 'Aprovado' para manter consistência com o que o Front-end espera
      const queryCompra = `
        INSERT INTO public.compras (usuario_email, evento_id, quantidade, status, stripe_session_id)
        VALUES ($1, $2, $3, $4, $5)
      `;

      await db.query(queryCompra, [
        usuarioEmail,
        eventoId,
        parseInt(quantidade),
        'Aprovado', 
        session.id
      ]);

      // 2. BUSCA DADOS DO EVENTO
      // Verifique se os nomes das colunas no seu banco são exatamente esses (nome, data, hora, local_nome, link_reuniao)
      const queryEvento = `
        SELECT nome, data_inicio, hora_inicio, local_nome, tipo, link_reuniao 
        FROM public.eventos 
        WHERE id = $1
      `;
      const eventoRes = await db.query(queryEvento, [eventoId]);
      const evento = eventoRes.rows[0];

      if (!evento) {
        console.error(`❌ Evento ID ${eventoId} não encontrado no banco.`);
        return res.status(404).json({ error: 'Evento não encontrado' });
      }

      // 3. Prepara o link da página de sucesso (Use a variável de ambiente se possível)
      const baseUrl = process.env.FRONTEND_URL || 'https://linkah-frontend-ivory.vercel.app';
      const linkIngresso = `${baseUrl}/pagamento/sucesso?session_id=${session.id}`;
      
      // 4. Monta o objeto EXATAMENTE como o emailService espera
      // Mapeamos os campos do banco para os campos que o template de e-mail usa
      const dadosParaEmail = {
        tituloEvento: evento.nome,
        dataEvento: evento.data_inicio ? new Date(evento.data_inicio).toLocaleDateString('pt-BR') : 'A confirmar',
        horaEvento: evento.hora_inicio || 'A confirmar',
        // Lógica: Se for online no banco, forçamos o texto "Plataforma Online"
        localEvento: (evento.tipo === 'online' || evento.tipo === 'Online') 
          ? 'Plataforma Online' 
          : (evento.local_nome || 'A confirmar'),
        quantidade: quantidade,
        linkIngresso: linkIngresso,
        linkReuniao: evento.link_reuniao || '', // Passa o link para o template disparar o bloco azul/rosa
        tipo: evento.tipo
      };

      console.log(`🔍 DEBUG ENVIO: Evento=${evento.nome} | LinkLive=${evento.link_reuniao ? 'SIM' : 'NÃO'}`);

      // 5. Dispara o e-mail via Resend
      await enviarIngressoEmail(usuarioEmail, dadosParaEmail);

      console.log('✨ Fluxo finalizado com sucesso!');

    } catch (dbErr) {
      console.error('❌ Erro no processamento pós-pagamento:', dbErr.message);
    }
  }

  // Responde ao Stripe sempre com 200
  res.json({ received: true });
};