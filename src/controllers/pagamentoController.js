const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const nodemailer = require('nodemailer');
const QRCode = require('qrcode');

// 1. CONFIGURAÇÃO DO TRANSPORTADOR DE E-MAIL
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

// --- 2. FUNÇÃO DE CRIAÇÃO DA SESSÃO (CHECKOUT) ---
exports.criarSessaoCheckout = async (req, res) => {
  console.log("--- 📥 NOVA REQUISIÇÃO DE CHECKOUT ---");
  try {
    const { evento, usuarioEmail, quantidade } = req.body;

    if (!evento?.preco) {
      console.error("❌ Erro: Preço do evento não encontrado.");
      return res.status(400).json({ error: "Preço não informado" });
    }

    const porcentagemTaxa = 0.10; 
    const precoUnitarioCentavos = Math.round(Number(evento.preco) * 100);
    const totalVendaCentavos = precoUnitarioCentavos * (Number(quantidade) || 1);
    const applicationFeeCentavos = Math.round(totalVendaCentavos * porcentagemTaxa);

    // ID DA CONTA DO VICTOR HUGO (CONECTADA)
    const stripeAccountId = "acct_1SyzoICXDu6urvwI"; 

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
      metadata: {
        eventoId: evento.id,
        quantidade: quantidade,
        usuarioEmail: usuarioEmail,
        tituloEvento: evento.titulo
      },
      payment_intent_data: {
        application_fee_amount: applicationFeeCentavos,
        transfer_data: { destination: stripeAccountId },
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

// --- 3. FUNÇÃO DO WEBHOOK (Ouvinte + QR Code + E-mail) ---
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

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { usuarioEmail, tituloEvento, quantidade } = session.metadata;

    console.log("----------------------------------------------");
    console.log("💰 PAGAMENTO APROVADO! GERANDO INGRESSO...");
    
    try {
      // 1. GERAR QR CODE (ID da sessão como dado único)
      const qrCodeData = `LINKAH-${session.id}`;
      const qrCodeImage = await QRCode.toDataURL(qrCodeData);

      // 2. ENVIAR E-MAIL COM DESIGN DE TICKET PARA IMPRIMIR
      const mailOptions = {
        from: `"Linkah Eventos" <${process.env.GMAIL_USER}>`,
        to: usuarioEmail,
        subject: `🎟️ Seu Ingresso: ${tituloEvento}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; border: 2px dashed #e11d48; border-radius: 15px; overflow: hidden; background-color: #ffffff;">
            <div style="background-color: #e11d48; color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 22px;">INGRESSO CONFIRMADO</h1>
              <p style="margin: 5px 0 0 0; opacity: 0.9;">Apresente o QR Code abaixo no evento</p>
            </div>

            <div style="padding: 30px; text-align: center;">
              <h2 style="color: #0f172a; margin-top: 0;">${tituloEvento}</h2>
              
              <div style="margin: 20px auto; display: inline-block; padding: 10px; border: 1px solid #e2e8f0; border-radius: 10px;">
                <img src="${qrCodeImage}" width="200" height="200" alt="QR Code" />
              </div>

              <div style="border-top: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9; padding: 15px 0; margin-top: 10px; display: table; width: 100%;">
                <div style="display: table-cell; text-align: left;">
                  <span style="font-size: 10px; color: #94a3b8; font-weight: bold; text-transform: uppercase;">Comprador</span><br>
                  <span style="color: #334155; font-size: 14px;">${usuarioEmail}</span>
                </div>
                <div style="display: table-cell; text-align: right;">
                  <span style="font-size: 10px; color: #94a3b8; font-weight: bold; text-transform: uppercase;">Qtd</span><br>
                  <span style="color: #334155; font-size: 14px;">${quantidade}x</span>
                </div>
              </div>

              <p style="font-size: 11px; color: #cbd5e1; margin-top: 20px;">ID do Pedido: ${session.id.substring(0, 20)}...</p>
            </div>

            <div style="background-color: #f8fafc; padding: 15px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #64748b;">Linkah - Eventos e Conexões</p>
              <p style="margin: 5px 0 0 0; font-size: 10px; color: #94a3b8;">Dica: Você pode imprimir este e-mail ou mostrar no celular.</p>
            </div>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
      console.log(`📧 Ingresso com QR Code enviado para: ${usuarioEmail}`);

    } catch (error) {
      console.error("❌ Erro ao gerar QR Code ou enviar e-mail:", error.message);
    }
    
    console.log("----------------------------------------------");
  }

  res.status(200).json({ received: true });
};