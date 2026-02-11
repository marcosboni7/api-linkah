const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const nodemailer = require('nodemailer');
const QRCode = require('qrcode');
const db = require('../config/database');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
    },
});

exports.criarSessaoCheckout = async (req, res) => {
    try {
        const { evento, usuarioEmail, quantidade } = req.body;
        const baseUrl = process.env.FRONTEND_URL;

        if (!baseUrl || !baseUrl.startsWith('http')) {
            return res.status(500).json({ error: "Configuração de URL do servidor ausente." });
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            customer_email: usuarioEmail,
            line_items: [{
                price_data: {
                    currency: 'brl',
                    product_data: { name: `Ingresso: ${evento.titulo}` },
                    unit_amount: Math.round(Number(evento.preco) * 100),
                },
                quantity: quantidade,
            }],
            mode: 'payment',
            metadata: {
                usuarioEmail,
                eventoId: evento.id.toString(),
                tituloEvento: evento.titulo,
                quantidade: quantidade.toString()
            },
            // Ajustado para sua estrutura de pastas real
            success_url: `${baseUrl}/pagamento/sucesso?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${baseUrl}/venda?eventoId=${evento.id}&qtd=${quantidade}`,
        });

        res.json({ url: session.url });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.webhookStripe = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const { usuarioEmail, tituloEvento, quantidade, eventoId } = session.metadata;

        try {
            // 1. SALVAR NO BANCO
            await db.query(`
                INSERT INTO public.compras (usuario_email, evento_id, evento_nome, data_evento, quantidade, valor_total, status, stripe_session_id)
                VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, 'Aprovado', $6)
            `, [usuarioEmail, eventoId, tituloEvento, parseInt(quantidade), session.amount_total / 100, session.id]);

            // 2. FORMATAR TEXTO DO QR CODE (Para aparecer bonito no scanner)
            const textoQRCode = `
===== LINKAH EVENTOS =====
🎟️ INGRESSO CONFIRMADO

📌 EVENTO: ${tituloEvento}
👤 CLIENTE: ${usuarioEmail}
🔢 QUANTIDADE: ${quantidade}
🆔 REF: ${session.id.substring(0, 15)}...

--------------------------
Apresente este código na entrada.
==========================
`.trim();

            // 3. GERAR QR CODE COM CORES (Rose da Linkah)
            const qrCodeImage = await QRCode.toDataURL(textoQRCode, {
                color: {
                    dark: '#e11d48', // Cor Rose-600
                    light: '#ffffff'
                },
                width: 400,
                margin: 2
            });

            // 4. ENVIAR E-MAIL
            await transporter.sendMail({
                from: `"Linkah Eventos" <${process.env.GMAIL_USER}>`,
                to: usuarioEmail,
                subject: `🎟️ Seu Ingresso: ${tituloEvento}`,
                html: `
                    <div style="font-family: sans-serif; max-width: 450px; margin: auto; border: 2px solid #e11d48; border-radius: 20px; padding: 20px; text-align: center;">
                        <h1 style="color: #e11d48; margin-bottom: 0;">LINKAH.</h1>
                        <p style="font-weight: bold; color: #334155;">Sua entrada está garantida!</p>
                        <hr style="border: 0; border-top: 1px dashed #e11d48; margin: 20px 0;">
                        <img src="${qrCodeImage}" width="250" style="margin-bottom: 20px;" />
                        <div style="text-align: left; background: #f8fafc; padding: 15px; border-radius: 10px;">
                            <p><strong>Evento:</strong> ${tituloEvento}</p>
                            <p><strong>Quantidade:</strong> ${quantidade}x</p>
                            <p><strong>E-mail:</strong> ${usuarioEmail}</p>
                        </div>
                    </div>
                `
            });

        } catch (error) {
            console.error("Erro no processamento:", error.message);
        }
    }
    res.status(200).json({ received: true });
};