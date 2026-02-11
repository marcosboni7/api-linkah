const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const nodemailer = require('nodemailer');
const QRCode = require('qrcode');
const db = require('../config/database');

// Configuração do Transporter para envio de e-mail (Gmail)
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

        // O baseUrl virá EXCLUSIVAMENTE do seu Environment Variable no Render
        const baseUrl = process.env.FRONTEND_URL;

        if (!baseUrl) {
            console.error("🚨 ALERTA: A variável FRONTEND_URL não está definida no Render!");
        }

        console.log(`🎟️ Iniciando Checkout: ${usuarioEmail} para o evento ${evento.titulo}`);

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            customer_email: usuarioEmail,
            line_items: [{
                price_data: {
                    currency: 'brl',
                    product_data: { 
                        name: `Ingresso: ${evento.titulo}`,
                        description: `Evento ID: ${evento.id}`,
                    },
                    unit_amount: Math.round(Number(evento.preco) * 100), // Converte Real para Centavos
                },
                quantity: quantidade,
            }],
            mode: 'payment',
            metadata: {
                usuarioEmail: usuarioEmail,
                eventoId: evento.id.toString(),
                tituloEvento: evento.titulo,
                quantidade: quantidade.toString()
            },
            // Sem localhost aqui! O redirecionamento será para o seu site oficial na Vercel
            success_url: `${baseUrl}/sucesso?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${baseUrl}/venda?eventoId=${evento.id}&qtd=${quantidade}`,
        });

        res.json({ url: session.url });
    } catch (err) {
        console.error("❌ Erro na criação da sessão Stripe:", err.message);
        res.status(500).json({ error: err.message });
    }
};

// --- 2. WEBHOOK DA STRIPE (Processamento Pós-Pagamento) ---
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
        console.error(`⚠️ Falha na assinatura do Webhook: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Só processamos se o pagamento foi concluído com sucesso
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const { usuarioEmail, tituloEvento, quantidade, eventoId } = session.metadata;

        console.log(`✅ Pagamento Confirmado: ${usuarioEmail} comprou ${quantidade} ingressos.`);

        try {
            // 1. REGISTRAR COMPRA NO BANCO DE DADOS (Importante para aparecer na Navbar)
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
                session.amount_total / 100, // Converte centavos de volta para Real
                'Aprovado',
                session.id
            ]);

            console.log("💾 Compra salva com sucesso no banco de dados.");

            // 2. GERAR IMAGEM DO QR CODE
            // O código do QR contém o ID da sessão e o e-mail para validação na portaria
            const qrCodeData = `LINKAH-${session.id}-${usuarioEmail}`;
            const qrCodeImage = await QRCode.toDataURL(qrCodeData);

            // 3. ENVIAR E-MAIL DE CONFIRMAÇÃO PARA O CLIENTE
            const mailOptions = {
                from: `"Linkah Eventos" <${process.env.GMAIL_USER}>`,
                to: usuarioEmail,
                subject: `🎟️ Seu Ingresso: ${tituloEvento}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; border: 1px solid #ddd; border-radius: 10px; padding: 20px; text-align: center;">
                        <h1 style="color: #d6006d; font-style: italic;">LINKAH.</h1>
                        <h2 style="color: #333;">Sua entrada está garantida!</h2>
                        <p style="color: #666;">Apresente o QR Code abaixo no dia do evento:</p>
                        <div style="margin: 30px 0;">
                            <img src="${qrCodeImage}" alt="QR Code Ingresso" width="200" height="200" />
                        </div>
                        <div style="background: #fdf2f8; padding: 15px; border-radius: 8px; text-align: left; border-left: 4px solid #d6006d;">
                            <p style="margin: 5px 0;"><strong>Evento:</strong> ${tituloEvento}</p>
                            <p style="margin: 5px 0;"><strong>Quantidade:</strong> ${quantidade}x Ingressos</p>
                            <p style="margin: 5px 0;"><strong>Comprador:</strong> ${usuarioEmail}</p>
                        </div>
                        <p style="font-size: 11px; color: #999; margin-top: 20px;">Este é um e-mail automático da Linkah. Não é necessário responder.</p>
                    </div>
                `,
            };

            await transporter.sendMail(mailOptions);
            console.log(`📧 E-mail com QR Code enviado para ${usuarioEmail}`);

        } catch (error) {
            console.error("❌ Erro interno ao processar sucesso do pagamento:", error.message);
        }
    }

    // Notifica a Stripe que o Webhook foi recebido
    res.status(200).json({ received: true });
};