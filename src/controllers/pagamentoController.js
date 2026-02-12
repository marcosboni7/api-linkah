const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('../config/database');
const { enviarIngressoEmail } = require('../services/emailService');

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
                quantity: parseInt(quantidade),
            }],
            mode: 'payment',
            metadata: {
                usuarioEmail,
                eventoId: evento.id.toString(),
                tituloEvento: evento.titulo,
                quantidade: quantidade.toString(),
                // Novos detalhes para o e-mail
                dataEvento: evento.data_inicio || 'A confirmar',
                horaEvento: evento.hora_inicio || 'A confirmar',
                localEvento: evento.local_nome || 'Local a definir'
            },
            success_url: `${baseUrl}/pagamento/sucesso?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${baseUrl}/venda?eventoId=${evento.id}&qtd=${quantidade}`,
        });

        res.json({ url: session.url });
    } catch (err) {
        console.error("❌ Erro Stripe:", err.message);
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
        console.error(`⚠️ Erro Webhook Signature: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        
        // Pegando todos os dados do metadata
        const { 
            usuarioEmail, 
            tituloEvento, 
            quantidade, 
            eventoId, 
            dataEvento, 
            horaEvento, 
            localEvento 
        } = session.metadata;

        console.log(`✅ Pagamento aprovado: ${usuarioEmail}`);

        try {
            // 1. Salva no Banco
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

            // 2. Prepara dados para o e-mail
            const linkIngresso = `${process.env.FRONTEND_URL}/pagamento/sucesso?session_id=${session.id}`;
            
            const dadosParaEmail = {
                tituloEvento,
                quantidade,
                linkIngresso,
                dataEvento,
                horaEvento,
                localEvento
            };

            // 3. Envia o e-mail via Resend
            await enviarIngressoEmail(usuarioEmail, dadosParaEmail);

            console.log(`📧 Ticket enviado para: ${usuarioEmail}`);

        } catch (error) {
            console.error("❌ Erro no processamento pós-pagamento:", error.message);
        }
    }

    res.status(200).json({ received: true });
};

// --- 3. BUSCAR DETALHES ---
exports.buscarDetalhesCompra = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const result = await db.query(
            "SELECT evento_nome, usuario_email, quantidade, valor_total, TO_CHAR(data_evento, 'DD/MM/YYYY') as data_evento_formatada FROM public.compras WHERE stripe_session_id = $1", 
            [sessionId]
        );

        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.status(404).json({ error: "Compra não encontrada." });
        }
    } catch (err) {
        res.status(500).json({ error: "Erro interno." });
    }
};