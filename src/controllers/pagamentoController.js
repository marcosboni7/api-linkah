const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const nodemailer = require('nodemailer');
const db = require('../config/database');

// Configuração do Transporter para envio de e-mail (Gmail)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
    },
});

// --- 1. CRIAR SESSÃO DE CHECKOUT ---
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

// --- 2. WEBHOOK DA STRIPE (VERSÃO DE TESTE DESTRAVADA) ---
exports.webhookStripe = async (req, res) => {
    let event;

    try {
        // ACEITAMOS O CORPO DIRETO PARA PERMITIR O SEU CURL NO TERMINAL
        event = req.body; 

        console.log("🔔 Webhook manual recebido tipo:", event.type);

        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            
            // Verificando se os metadados existem no seu comando
            const { usuarioEmail, tituloEvento, quantidade, eventoId } = session.metadata || {};

            if (!usuarioEmail) {
                console.error("🚨 Metadados não encontrados na sessão!");
                return res.status(400).json({ error: "Metadata ausente" });
            }

            // 1. REGISTRAR NO BANCO
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
                (session.amount_total || 0) / 100, 
                session.id
            ]);

            console.log("✅ Salvo no banco com sucesso!");

            // 2. ENVIAR E-MAIL
            try {
                const linkIngresso = `${process.env.FRONTEND_URL}/pagamento/sucesso?session_id=${session.id}`;
                await transporter.sendMail({
                    from: `"Linkah Eventos" <${process.env.GMAIL_USER}>`,
                    to: usuarioEmail,
                    subject: `🎟️ Ingresso Confirmado: ${tituloEvento}`,
                    html: `<h1>Sucesso!</h1><p>Acesse seu ingresso em: ${linkIngresso}</p>`
                });
            } catch (mailErr) {
                console.error("⚠️ Erro ao enviar e-mail, mas a compra foi salva.");
            }
        }

        res.status(200).json({ received: true });

    } catch (error) {
        console.error("❌ Erro crítico no webhook:", error.message);
        res.status(500).json({ error: error.message });
    }
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