const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const nodemailer = require('nodemailer');
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
        const baseUrl = process.env.FRONTEND_URL;

        if (!baseUrl || !baseUrl.startsWith('http')) {
            console.error("🚨 FRONTEND_URL ausente no Render!");
            return res.status(500).json({ error: "Configuração de URL do servidor ausente." });
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            customer_email: usuarioEmail,
            line_items: [{
                price_data: {
                    currency: 'brl',
                    product_data: { 
                        name: `Ingresso: ${evento.titulo}`,
                    },
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
            // Redireciona para sua pasta correta no Next.js
            success_url: `${baseUrl}/pagamento/sucesso?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${baseUrl}/venda?eventoId=${evento.id}&qtd=${quantidade}`,
        });

        res.json({ url: session.url });
    } catch (err) {
        console.error("❌ Erro Stripe:", err.message);
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
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const { usuarioEmail, tituloEvento, quantidade, eventoId } = session.metadata;

        try {
            // 1. REGISTRAR COMPRA NO BANCO DE DADOS
            await db.query(`
                INSERT INTO public.compras (
                    usuario_email, evento_id, evento_nome, data_evento, 
                    quantidade, valor_total, status, stripe_session_id
                )
                VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, 'Aprovado', $6)
            `, [
                usuarioEmail, 
                eventoId, 
                tituloEvento, 
                parseInt(quantidade), 
                session.amount_total / 100, 
                session.id
            ]);

            // 2. CRIAR O LINK DO INGRESSO DIGITAL
            const linkIngresso = `${process.env.FRONTEND_URL}/pagamento/sucesso?session_id=${session.id}`;

            // 3. ENVIAR E-MAIL COM O BOTÃO PARA ACESSAR O INGRESSO
            await transporter.sendMail({
                from: `"Linkah Eventos" <${process.env.GMAIL_USER}>`,
                to: usuarioEmail,
                subject: `🎟️ Seu Ingresso Confirmado: ${tituloEvento}`,
                html: `
                    <div style="font-family: sans-serif; max-width: 500px; margin: auto; border: 1px solid #eee; border-radius: 20px; padding: 30px; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                        <h1 style="color: #e11d48; font-style: italic; letter-spacing: -2px; font-size: 32px;">LINKAH.</h1>
                        <h2 style="color: #1e293b; margin-top: 10px;">Pagamento Confirmado!</h2>
                        <p style="color: #64748b; font-size: 16px;">Sua entrada para o evento <b>${tituloEvento}</b> está garantida.</p>
                        
                        <div style="margin: 35px 0;">
                            <a href="${linkIngresso}" style="background-color: #e11d48; color: white; padding: 18px 30px; border-radius: 14px; text-decoration: none; font-weight: bold; display: inline-block; font-size: 16px; box-shadow: 0 4px 10px rgba(225, 29, 72, 0.3);">
                                ACESSAR MEU INGRESSO
                            </a>
                        </div>

                        <div style="background: #f8fafc; padding: 20px; border-radius: 12px; text-align: left; border: 1px solid #f1f5f9;">
                            <p style="margin: 5px 0; font-size: 14px; color: #475569;"><strong>Evento:</strong> ${tituloEvento}</p>
                            <p style="margin: 5px 0; font-size: 14px; color: #475569;"><strong>Quantidade:</strong> ${quantidade}x Ingressos</p>
                            <p style="margin: 5px 0; font-size: 14px; color: #475569;"><strong>E-mail:</strong> ${usuarioEmail}</p>
                        </div>
                        
                        <p style="font-size: 12px; color: #94a3b8; margin-top: 25px;">
                            Ao abrir o link, você poderá baixar seu ingresso em PDF.
                        </p>
                    </div>
                `,
            });

            console.log(`✅ Processo concluído para ${usuarioEmail}`);

        } catch (error) {
            console.error("❌ Erro no processamento do webhook:", error.message);
        }
    }

    res.status(200).json({ received: true });
};