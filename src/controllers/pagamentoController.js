const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const nodemailer = require('nodemailer');
const QRCode = require('qrcode');
const db = require('../config/database'); // Certifique-se de que o caminho está correto

// ... (configuração do transporter continua igual)

exports.criarSessaoCheckout = async (req, res) => {
    // ... (Seu código de criarSessaoCheckout continua igual)
};

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
        const { usuarioEmail, tituloEvento, quantidade, eventoId } = session.metadata;

        console.log("💰 PAGAMENTO APROVADO! PROCESSANDO...");

        try {
            // --- 1. SALVAR NO BANCO DE DADOS (ESSENCIAL PARA A NAVBAR) ---
            const queryBanco = `
                INSERT INTO public.compras (
                    usuario_email, 
                    evento_id, 
                    evento_nome, 
                    data_evento, 
                    quantidade, 
                    valor_total, 
                    status, 
                    stripe_session_id
                )
                VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, $6, $7)
            `;
            
            await db.query(queryBanco, [
                usuarioEmail,
                eventoId,
                tituloEvento,
                quantidade,
                session.amount_total / 100, // Converte centavos para Real
                'Aprovado',
                session.id
            ]);
            console.log("✅ Compra registrada no banco de dados!");

            // --- 2. GERAR QR CODE ---
            const qrCodeData = `LINKAH-${session.id}`;
            const qrCodeImage = await QRCode.toDataURL(qrCodeData);

            // --- 3. ENVIAR E-MAIL ---
            const mailOptions = {
                from: `"Linkah Eventos" <${process.env.GMAIL_USER}>`,
                to: usuarioEmail,
                subject: `🎟️ Seu Ingresso: ${tituloEvento}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; border: 2px dashed #e11d48; border-radius: 15px; overflow: hidden; background-color: #ffffff;">
                        <div style="background-color: #e11d48; color: white; padding: 20px; text-align: center;">
                            <h1 style="margin: 0; font-size: 22px;">INGRESSO CONFIRMADO</h1>
                        </div>
                        <div style="padding: 30px; text-align: center;">
                            <h2>${tituloEvento}</h2>
                            <img src="${qrCodeImage}" width="200" height="200" alt="QR Code" />
                            <p>Comprador: ${usuarioEmail}</p>
                            <p>Quantidade: ${quantidade}x</p>
                        </div>
                    </div>
                `,
            };

            await transporter.sendMail(mailOptions);
            console.log(`📧 E-mail enviado para: ${usuarioEmail}`);

        } catch (error) {
            console.error("❌ Erro no processamento pós-pagamento:", error.message);
        }
    }

    res.status(200).json({ received: true });
};