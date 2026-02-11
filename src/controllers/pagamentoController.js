const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const nodemailer = require('nodemailer');

// 1. CONFIGURAÇÃO DO TRANSPORTADOR DE E-MAIL (GMAIL)
// Usando as variáveis GMAIL_USER e GMAIL_PASS que você configurou no Render
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // true para 465, false para 587
  auth: {
    user: process.env.GMAIL_USER, // marcosphara@gmail.com
    pass: process.env.GMAIL_PASS, // kytyrxzjlgsxqvjq (Senha de App)
  },
});

// --- 2. FUNÇÃO DE CRIAÇÃO DA SESSÃO (CHECKOUT) ---
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

      // METADATA: Carrega as informações para o Webhook ler depois
      metadata: {
        eventoId: evento.id,
        quantidade: quantidade,
        usuarioEmail: usuarioEmail,
        tituloEvento: evento.titulo
      },

      // CONFIGURAÇÃO DO STRIPE CONNECT (DIVISÃO DE VALORES)
      payment_intent_data: {
        application_fee_amount: applicationFeeCentavos, // Sua comissão (10%)
        transfer_data: {
          destination: stripeAccountId, // Parte do Victor Hugo
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

// --- 3. FUNÇÃO DO WEBHOOK (Ouvinte de Pagamentos + Envio de E-mail) ---
exports.webhookStripe = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // Valida se a requisição veio mesmo da Stripe usando o seu WEBHOOK_SECRET
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error(`⚠️ Erro de assinatura Webhook: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Evento disparado quando o pagamento é CONCLUÍDO
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    
    // Recupera os dados guardados no metadata
    const { usuarioEmail, tituloEvento, quantidade, eventoId } = session.metadata;

    console.log("----------------------------------------------");
    console.log("💰 PAGAMENTO APROVADO! ENVIANDO INGRESSO...");
    
    try {
      // OPIONAL: Aqui você pode inserir no seu banco de dados
      // await db.query('INSERT INTO compras ...');

      // ENVIO DO E-MAIL COM O INGRESSO
      const mailOptions = {
        from: `"Linkah Eventos" <${process.env.GMAIL_USER}>`,
        to: usuarioEmail,
        subject: `Confirmado! Seu ingresso para ${tituloEvento} 🎟️`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 12px;">
            <div style="text-align: center;">
              <h1 style="color: #e11d48; margin-bottom: 5px;">Linkah</h1>
              <p style="color: #666; font-size: 14px;">Seu ingresso chegou!</p>
            </div>
            
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
            
            <p>Olá, <strong>${usuarioEmail}</strong>!</p>
            <p>Seu pagamento foi confirmado. Aqui estão os detalhes para o seu check-in:</p>
            
            <div style="background-color: #f8fafc; padding: 20px; border-radius: 10px; border: 1px solid #e2e8f0; margin: 20px 0;">
              <h2 style="margin: 0 0 10px 0; font-size: 18px; color: #0f172a;">${tituloEvento}</h2>
              <p style="margin: 5px 0;"><strong>Quantidade:</strong> ${quantidade} ingresso(s)</p>
              <p style="margin: 5px 0;"><strong>Status:</strong> Pagamento Aprovado</p>
              <p style="margin: 5px 0;"><strong>Valor Total:</strong> R$ ${(session.amount_total / 100).toFixed(2)}</p>
            </div>

            <p style="font-size: 13px; color: #64748b; text-align: center;">Apresente este e-mail (ou o PDF da compra) no dia do evento para realizar sua entrada.</p>
            
            <div style="text-align: center; margin-top: 30px;">
              <p style="font-size: 12px; color: #94a3b8;">Linkah - Eventos e Conexões</p>
            </div>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
      console.log(`📧 Ingresso enviado com sucesso para: ${usuarioEmail}`);

    } catch (error) {
      console.error("❌ Erro ao enviar e-mail ou salvar no banco:", error.message);
    }
    
    console.log("----------------------------------------------");
  }

  // Avisa a Stripe que recebemos o Webhook corretamente
  res.status(200).json({ received: true });
};