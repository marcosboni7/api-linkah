const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const nodemailer = require('nodemailer');
const QRCode = require('qrcode');
const db = require('../config/database');

// Configuração do E-mail (Gmail)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS, // Senha de App de 16 dígitos
    },
});

// --- 1. CRIAR SESSÃO DE CHECKOUT ---
exports.criarSessaoCheckout = async (req, res) => {
    try {
        const { evento, usuarioEmail, quantidade } = req.body;

        // O FRONTEND_URL deve ser https://linkah-frontend-ivory.vercel.app no Render
        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

        console.log(`🎟️ Criando checkout para: ${usuarioEmail} - Evento: ${evento.titulo}`);

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            customer_email: usuarioEmail,
            line_items: [{
                price_data: {
                    currency: 'brl',
                    product_data: { 
                        name: `Ingresso: ${evento.titulo}`,
                        description: `Quantidade: ${quantidade}`
                    },
                    unit_amount: Math.round(Number(evento.preco) * 100), // Garante que é número e converte para centavos
                },
                quantity: quantidade,
            }],
            mode: 'payment',
            // Metadados são essenciais para o Webhook processar o banco depois
            metadata: {
                usuarioEmail: usuarioEmail,
                eventoId: evento.id.toString(),
                tituloEvento: evento.titulo,
                quantidade: quantidade.toString()
            },
            success_url: `${baseUrl}/sucesso?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${baseUrl}/venda?eventoId=${evento.id}&qtd=${quantidade}`,
        });

        res.json({ url: session.url });
    } catch (err) {
        console.error("❌ Erro ao criar sessão Stripe:", err.message);
        res.status(500).json({ error: err.message });
    }
};

// --- 2. WEBHOOK DA STRIPE ---
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
        
        // Recuperando metadados enviados no passo 1
        const { usuarioEmail, tituloEvento, quantidade, eventoId } = session.metadata;

        console.log(`💰 PAGAMENTO APROVADO! Usuário: ${usuarioEmail}`);

        try {
            // 1. SALVAR NO BANCO DE DADOS
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
                parseInt(quantidade),
                session.amount_total / 100, // Volta centavos para Real
                'Aprovado',
                session.id
            ]);

            console.log("✅ Compra registrada no banco!");

            // 2. GERAR QR CODE (Conteúdo do código que será lido na portaria)
            const qrCodeData = `LINKAH-${session.id}-${usuarioEmail}`;
            const qrCodeImage = await QRCode.toDataURL(qrCodeData);

            // 3. ENVIAR E-MAIL COM O QR CODE
            const mailOptions = {
                from: `"Linkah Eventos" <${process.env.GMAIL_USER}>`,
                to: usuarioEmail,
                subject: `🎟️ Seu Ingresso Confirmado: ${tituloEvento}`,
                html: `
                    <div style="font-family: sans-serif; max-width: 450px; margin: auto; border: 1px solid #eee; border-radius: 20px; padding: 20px; text-align: center; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                        <h1 style="color: #e11d48; font-style: italic;">LINKAH<span style="color: #000;">.</span></h1>
                        <p style="font-size: 16px; font-weight: bold; color: #334155;">Tudo pronto! Seu ingresso está aqui.</p>
                        <hr style="border: 0; border-top: 1px dashed #ccc; margin: 20px 0;">
                        <h2 style="margin: 0; text-transform: uppercase;">${tituloEvento}</h2>
                        <img src="${qrCodeImage}" style="width: 200px; height: 200px; margin: 20px 0;" alt="QR Code Ingresso" />
                        <p style="font-size: 14px; color: #64748b;">Apresente este QR Code na entrada do evento junto com seu documento.</p>
                        <div style="background: #f8fafc; padding: 15px; border-radius: 15px; text-align: left; font-size: 12px; color: #475569;">
                            <p style="margin: 5px 0;"><strong>ID do Pedido:</strong> ${session.id.substring(0, 20)}...</p>
                            <p style="margin: 5px 0;"><strong>Quantidade:</strong> ${quantidade}x Ingressos</p>
                            <p style="margin: 5px 0;"><strong>E-mail:</strong> ${usuarioEmail}</p>
                        </div>
                    </div>
                `,
            };

            await transporter.sendMail(mailOptions);
            console.log(`📧 E-mail enviado com sucesso para ${usuarioEmail}`);

        } catch (error) {
            console.error("❌ Erro interno ao processar webhook:", error.message);
        }
    }

    res.status(200).json({ received: true });
};