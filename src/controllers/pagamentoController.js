const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('../config/database');
const { enviarIngressoEmail } = require('../services/emailService');

// --- 1. CRIAR SESSÃO DE CHECKOUT COM SPLIT DE PAGAMENTO ---
exports.criarSessaoCheckout = async (req, res) => {
    try {
        const { evento, usuarioEmail, quantidade } = req.body;
        const baseUrl = process.env.FRONTEND_URL;

        // BUSCA DETALHES REAIS (Usando apenas colunas que existem no seu banco)
        const dadosEventoBD = await db.query(
            "SELECT nome, data_inicio, hora_inicio, local_nome, stripe_account_id, preco FROM public.eventos WHERE id = $1",
            [evento.id]
        );

        if (dadosEventoBD.rows.length === 0) {
            return res.status(404).json({ error: "Evento não encontrado." });
        }

        const ev = dadosEventoBD.rows[0];

        // LÓGICA DE PREÇO DINÂMICO:
        // Se houver preço no banco (diferente de 0 ou 50 de teste), usa o do banco.
        // Caso contrário, usa o preço que o produtor enviou pelo site.
        const precoUnitario = (ev.preco && Number(ev.preco) !== 0 && Number(ev.preco) !== 50.00) 
            ? Number(ev.preco) 
            : Number(evento.preco);

        // CONFIGURAÇÃO DA SESSÃO COM STRIPE CONNECT (SPLIT)
        const sessionParams = {
            payment_method_types: ['card', 'apple_pay'],
            customer_email: usuarioEmail,
            line_items: [{
                price_data: {
                    currency: 'brl',
                    product_data: { 
                        name: `Ingresso: ${ev.nome}`,
                    },
                    unit_amount: Math.round(precoUnitario * 100), // Centavos
                },
                quantity: parseInt(quantidade),
            }],
            mode: 'payment',
            metadata: {
                usuarioEmail,
                eventoId: evento.id.toString(),
                tituloEvento: ev.nome,
                quantidade: quantidade.toString(),
                dataEvento: ev.data_inicio ? new Date(ev.data_inicio).toLocaleDateString('pt-BR') : 'A confirmar',
                horaEvento: ev.hora_inicio || 'A confirmar',
                localEvento: ev.local_nome || 'Local a definir'
            },
            success_url: `${baseUrl}/pagamento/sucesso?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${baseUrl}/venda?eventoId=${evento.id}&qtd=${quantidade}`,
        };

        // SE O EVENTO TIVER UM PRODUTOR VINCULADO (STRIPE CONNECT)
        if (ev.stripe_account_id) {
            sessionParams.payment_intent_data = {
                // Sua taxa da Linkah (5% do total da venda)
                application_fee_amount: Math.round((precoUnitario * 0.05) * 100 * quantidade),
                // Destino dos 95% restantes (Conta do Produtor)
                transfer_data: {
                    destination: ev.stripe_account_id,
                },
            };
        }

        const session = await stripe.checkout.sessions.create(sessionParams);
        res.json({ url: session.url });

    } catch (err) {
        console.error("❌ Erro ao criar sessão Stripe:", err.message);
        res.status(500).json({ error: err.message });
    }
};

// --- 2. WEBHOOK DA STRIPE (Processamento após sucesso) ---
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
        const { usuarioEmail, tituloEvento, quantidade, eventoId, dataEvento, horaEvento, localEvento } = session.metadata;

        try {
            // Salva a compra aprovada no banco de dados
            await db.query(`
                INSERT INTO public.compras (
                    usuario_email, evento_id, evento_nome, data_evento, 
                    quantidade, valor_total, status, stripe_session_id
                )
                VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, 'Aprovado', $6)
            `, [usuarioEmail, eventoId, tituloEvento, parseInt(quantidade), session.amount_total / 100, session.id]);

            // Envia o e-mail oficial com o link do ingresso
            const linkIngresso = `${process.env.FRONTEND_URL}/pagamento/sucesso?session_id=${session.id}`;
            await enviarIngressoEmail(usuarioEmail, {
                tituloEvento,
                quantidade,
                linkIngresso,
                dataEvento,
                horaEvento,
                localEvento
            });

            console.log(`✅ Ingresso enviado com sucesso para ${usuarioEmail}`);
        } catch (error) {
            console.error("❌ Erro no processamento do webhook:", error.message);
        }
    }
    res.status(200).json({ received: true });
};

// --- 3. BUSCAR DETALHES (Para a tela de sucesso do Next.js) ---
exports.buscarDetalhesCompra = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const result = await db.query(
            `SELECT 
                c.evento_nome, c.usuario_email, c.quantidade, c.valor_total, 
                TO_CHAR(c.data_evento, 'DD/MM/YYYY') as data_evento_formatada,
                e.hora_inicio as hora_evento,
                e.local_nome as local_evento
             FROM public.compras c
             LEFT JOIN public.eventos e ON e.id = c.evento_id
             WHERE c.stripe_session_id = $1`, 
            [sessionId]
        );

        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.status(404).json({ error: "Compra não encontrada." });
        }
    } catch (err) {
        console.error("❌ Erro ao buscar detalhes:", err.message);
        res.status(500).json({ error: "Erro interno no servidor." });
    }
};