const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const nodemailer = require('nodemailer');
const QRCode = require('qrcode');
const db = require('../config/database');

// Configuração do E-mail (Gmail)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS, // Aquela "Senha de App" de 16 dígitos
    },
});

// --- 1. CRIAR SESSÃO DE CHECKOUT ---
exports.criarSessaoCheckout = async (req, res) => {
    try {
        const { evento, usuarioEmail, quantidade } = req.body;

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
                    unit_amount: Math.round(evento.preco * 100), // Converte para centavos
                },
                quantity: quantidade,
            }],
            mode: 'payment',
            // ONDE O FILHO CHORA E A MÃE NÃO VÊ: Os metadados precisam estar aqui!
            metadata: {
                usuarioEmail: usuarioEmail,
                eventoId: evento.id.toString(),
                tituloEvento: evento.titulo,
                quantidade: quantidade.toString()
            },
            success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/sucesso?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/venda?eventoId=${evento.id}&qtd=${quantidade}`,
        });

        res.json({ url: session.url });
    } catch (err) {
        console.error("❌ Erro ao criar sessão Stripe:", err.message);
        res.status(500).json({ error: err.message });
    }
};

// --- 2. WEBHOOK DA STRIPE (O CORAÇÃO DO SISTEMA) ---
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
        
        // Pegando os dados que enviamos lá no checkout
        const { usuarioEmail, tituloEvento, quantidade, eventoId } = session.metadata;

        console.log(`💰 PAGAMENTO APROVADO! Usuário: ${usuarioEmail}`);

        try {
            // 1. SALVAR NO BANCO (Para a Navbar ler)
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
                session.amount_total / 100,
                'Aprovado',
                session.id
            ]);

            // 2. GERAR QR CODE
            const qrCodeData = `LINKAH-${session.id}-${usuarioEmail}`;
            const qrCodeImage = await QRCode.toDataURL(qrCodeData);

            // 3. ENVIAR E-MAIL COM O QR CODE
            const mailOptions = {
                from: `"Linkah Eventos" <${process.env.GMAIL_USER}>`,
                to: usuarioEmail,
                subject: `🎟️ Seu Ingresso Confirmado: ${tituloEvento}`,
                html: `
                    <div style="font-family: sans-serif; max-width: 450px; margin: auto; border: 1px solid #eee; border-radius: 20px; padding: 20px; text-align: center; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                        <h1 style="color: #e11d48;">LINKAH.</h1>
                        <p style="font-size: 16px; font-weight: bold;">Tudo pronto! Seu ingresso está aqui.</p>
                        <hr style="border: 0; border-top: 1px dashed #ccc; margin: 20px 0;">
                        <h2 style="margin: 0;">${tituloEvento}</h2>
                        <img src="${qrCodeImage}" style="width: 200px; height: 200px; margin: 20px 0;" />
                        <p style="font-size: 14px; color: #666;">Apresente este QR Code na entrada do evento.</p>
                        <div style="background: #f9fafb; padding: 15px; border-radius: 10px; text-align: left; font-size: 12px;">
                            <p><strong>Pedido:</strong> ${session.id.substring(0, 15)}...</p>
                            <p><strong>Quantidade:</strong> ${quantidade}x Ingressos</p>
                            <p><strong>E-mail:</strong> ${usuarioEmail}</p>
                        </div>
                    </div>
                `,
            };

            await transporter.sendMail(mailOptions);
            console.log("✅ Processo concluído com sucesso!");

        } catch (error) {
            console.error("❌ Erro interno no processamento do webhook:", error.message);
        }
    }

    res.status(200).json({ received: true });
};