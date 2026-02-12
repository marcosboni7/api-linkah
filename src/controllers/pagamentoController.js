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
                quantity: quantidade,
            }],
            mode: 'payment',
            metadata: {
                usuarioEmail,
                eventoId: evento.id.toString(),
                tituloEvento: evento.titulo,
                quantidade: quantidade.toString()
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

// --- 2. WEBHOOK DA STRIPE (Processamento Pós-Pagamento) ---
exports.webhookStripe = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        // Valida se a requisição veio realmente do Stripe
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error(`⚠️ Erro na assinatura do Webhook: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Quando o pagamento for confirmado com sucesso
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const { usuarioEmail, tituloEvento, quantidade, eventoId } = session.metadata;

        console.log(`✅ Pagamento aprovado para: ${usuarioEmail}`);

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

            console.log('✨ Compra registrada no banco de dados!');

            // 2. PREPARAR DADOS PARA O E-MAIL
            const linkIngresso = `${process.env.FRONTEND_URL}/pagamento/sucesso?session_id=${session.id}`;
            
            const dadosParaEmail = {
                tituloEvento: tituloEvento,
                quantidade: quantidade,
                linkIngresso: linkIngresso
            };

            // 3. ENVIAR E-MAIL VIA RESEND (Serviço externo)
            await enviarIngressoEmail(usuarioEmail, dadosParaEmail);

            console.log(`📧 E-mail de confirmação enviado para: ${usuarioEmail}`);

        } catch (error) {
            // Logamos o erro mas enviamos 200 para o Stripe não ficar tentando reenviar
            console.error("❌ Erro no processamento interno do webhook:", error.message);
        }
    }

    // Responde ao Stripe que o evento foi recebido com sucesso
    res.status(200).json({ received: true });
};

// --- 3. BUSCAR DETALHES PARA A TELA DE SUCESSO ---
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
            res.status(404).json({ error: "Compra não encontrada no banco de dados." });
        }
    } catch (err) {
        console.error("❌ Erro ao buscar detalhes:", err.message);
        res.status(500).json({ error: "Erro interno no servidor." });
    }
};