const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const nodemailer = require('nodemailer');

// Configuração do Transportador de E-mail (Exemplo para Gmail/Outlook)
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER, // Seu e-mail (ex: contato@linkah.com)
    pass: process.env.EMAIL_PASS, // Sua senha de app
  },
});

// --- 1. FUNÇÃO DE CRIAÇÃO DA SESSÃO (CHECKOUT) ---
exports.criarSessaoCheckout = async (req, res) => {
  console.log("--- 📥 NOVA REQUISIÇÃO DE CHECKOUT (DIVISÃO DE TAXA) ---");
  try {
    const { evento, usuarioEmail, quantidade } = req.body;

    if (!evento?.preco) {
      console.error("❌ Erro: Preço do evento não encontrado.");
      return res.status(400).json({ error: "Preço não informado" });
    }

    // CÁLCULO DA DIVISÃO (10% de taxa para a Linkah)
    const porcentagemTaxa = 0.10; 
    const precoUnitarioCentavos = Math.round(Number(evento.preco) * 100);
    const totalVendaCentavos = precoUnitarioCentavos * (Number(quantidade) || 1);
    const applicationFeeCentavos = Math.round(totalVendaCentavos * porcentagemTaxa);

    // ID DA CONTA DO VICTOR HUGO (CONECTADA)
    const stripeAccountId = "acct_1SyzoICXDu6urvwI"; 

    console.log(`📦 Processando R$ ${(totalVendaCentavos / 100).toFixed(2)} para conta: ${stripeAccountId}`);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'brl',
          product_data: { 
            name: evento.titulo || "Ingresso",
            description: "Pagamento processado via Linkah"
          },
          unit_amount: precoUnitarioCentavos,
        },
        quantity: Number(quantidade) || 1,
      }],
      mode: 'payment',
      customer_email: usuarioEmail,

      // O METADATA envia dados ocultos para o Webhook ler depois
      metadata: {
        eventoId: evento.id,
        quantidade: quantidade,
        usuarioEmail: usuarioEmail,
        tituloEvento: evento.titulo
      },

      // CONFIGURAÇÃO DO STRIPE CONNECT (SPLIT)
      payment_intent_data: {
        application_fee_amount: applicationFeeCentavos,
        transfer_data: {
          destination: stripeAccountId,
        },
      },

      success_url: `https://linkah-frontend-ivory.vercel.app/pagamento/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://linkah-frontend-ivory.vercel.app/venda?eventoId=${evento.id}`,
    });

    console.log("✅ Sessão Connect criada com sucesso!");
    res.json({ id: session.id, url: session.url });

  } catch (err) {
    console.error("❌ ERRO NO CHECKOUT:", err.message);
    res.status(500).json({ error: "Erro na Stripe", details: err.message });
  }
};

// --- 2. FUNÇÃO DO WEBHOOK (Ouvinte de Pagamentos + Envio de E-mail) ---
exports.webhookStripe = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error(`⚠️ Erro de assinatura Webhook: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Evento disparado quando o pagamento é concluído com sucesso
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { eventoId, quantidade, usuarioEmail, tituloEvento } = session.metadata;

    console.log("----------------------------------------------");
    console.log("💰 PAGAMENTO APROVADO! PROCESSANDO INGRESSO...");
    
    try {
      // AQUI VOCÊ PODE INSERIR NO SEU BANCO DE DADOS
      // await db.query('INSERT INTO public.compras ...');

      // ENVIO DO E-MAIL PARA O CLIENTE
      const mailOptions = {
        from: '"Linkah Eventos" <nao-responda@linkah.com.br>',
        to: usuarioEmail,
        subject: `Seu ingresso para ${tituloEvento} chegou! 🎟️`,
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
            <h2 style="color: #e11d48; text-align: center;">Pagamento Confirmado!</h2>
            <p>Olá, <strong>${usuarioEmail}</strong>!</p>
            <p>Seu pedido para o evento <strong>${tituloEvento}</strong> foi aprovado. Aqui estão os detalhes do seu ingresso:</p>
            
            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; border-left: 5px solid #e11d48; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Evento:</strong> ${tituloEvento}</p>
              <p style="margin: 5px 0;"><strong>Quantidade:</strong> ${quantidade} ingresso(s)</p>
              <p style="margin: 5px 0;"><strong>Valor Total:</strong> R$ ${(session.amount_total / 100).toFixed(2)}</p>
            </div>

            <p style="text-align: center; font-size: 12px; color: #777;">Apresente este e-mail na entrada do evento para realizar o seu check-in.</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="text-align: center; font-weight: bold; color: #e11d48;">Linkah - Conectando você aos melhores eventos.</p>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
      console.log(`📧 Ingresso enviado com sucesso para: ${usuarioEmail}`);

    } catch (dbError) {
      console.error("❌ Erro ao processar banco/email após pagamento:", dbError.message);
    }
    
    console.log("----------------------------------------------");
  }

  res.status(200).json({ received: true });
};