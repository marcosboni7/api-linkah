const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('../config/database');
const { enviarIngressoEmail } = require('../services/emailService');

// --- 1. CRIAR SESSÃO DE CHECKOUT (CARTÃO + PIX COM SPLIT) ---
exports.criarSessaoCheckout = async (req, res) => {
    try {
        const { evento, usuarioEmail, quantidade } = req.body;
        const baseUrl = process.env.FRONTEND_URL;

        // 1. BUSCA DETALHES NO BANCO PARA GARANTIR SEGURANÇA
        const dadosEventoBD = await db.query(
            "SELECT id, nome, data_inicio, hora_inicio, local_nome, stripe_account_id, preco FROM public.eventos WHERE id = $1",
            [evento.id]
        );

        if (dadosEventoBD.rows.length === 0) {
            return res.status(404).json({ error: "Evento não encontrado." });
        }

        const ev = dadosEventoBD.rows[0];
        const precoUnitario = (ev.preco && Number(ev.preco) !== 0) ? Number(ev.preco) : Number(evento.preco);
        const precoFinalEmCentavos = Math.round(precoUnitario * 100);

        if (precoFinalEmCentavos < 50) {
            return res.status(400).json({ error: "Valor mínimo R$ 0,50." });
        }

        // 2. CONFIGURAÇÃO DA SESSÃO (AGORA COM PIX)
        const sessionParams = {
            payment_method_types: ['card', 'pix'], // ✅ PIX LIBERADO
            payment_method_options: {
                pix: { expires_after_seconds: 1800 }, // Expira em 30 min
            },
            customer_email: usuarioEmail,
            line_items: [{
                price_data: {
                    currency: 'brl',
                    product_data: { 
                        name: `Ingresso: ${ev.nome}`,
                        description: `Evento em ${ev.data_inicio ? new Date(ev.data_inicio).toLocaleDateString('pt-BR') : 'Data a definir'}`,
                    },
                    unit_amount: precoFinalEmCentavos,
                },
                quantity: parseInt(quantidade),
            }],
            mode: 'payment',
            metadata: {
                usuarioEmail,
                eventoId: ev.id.toString(),
                tituloEvento: ev.nome,
                quantidade: quantidade.toString(),
                dataEvento: ev.data_inicio ? new Date(ev.data_inicio).toLocaleDateString('pt-BR') : 'A confirmar',
                horaEvento: ev.hora_inicio || 'A confirmar',
                localEvento: ev.local_nome || 'Local a definir'
            },
            success_url: `${baseUrl}/pagamento/sucesso?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${baseUrl}/venda?eventoId=${ev.id}&qtd=${quantidade}`,
        };

        // 3. LÓGICA DE SPLIT (Sua comissão de 5%)
        if (ev.stripe_account_id) {
            const feePercent = 0.05; 
            sessionParams.payment_intent_data = {
                application_fee_amount: Math.round(precoFinalEmCentavos * feePercent * quantidade),
                transfer_data: { destination: ev.stripe_account_id },
            };
        }

        const session = await stripe.checkout.sessions.create(sessionParams);
        res.json({ url: session.url });

    } catch (err) {
        console.error("❌ Erro Stripe Checkout:", err.message);
        res.status(500).json({ error: err.message });
    }
};

// --- 2. VINCULAR CONTA DO PRODUTOR (ONBOARDING CONNECT) ---
exports.vincularContaStripe = async (req, res) => {
    try {
        const { email } = req.body;

        // 1. Criar a conta Express
        const account = await stripe.accounts.create({
            type: 'express',
            email: email,
            capabilities: {
                card_payments: { requested: true },
                transfers: { requested: true },
            },
            business_type: 'individual',
        });

        // 2. Salvar o account_id em ambas as tabelas para garantir
        await db.query("UPDATE public.produtores SET stripe_account_id = $1 WHERE email = $2", [account.id, email]);
        await db.query("UPDATE public.usuarios SET stripe_account_id = $1 WHERE email = $2", [account.id, email]);

        // 3. Gerar link de onboarding
        const accountLink = await stripe.accountLinks.create({
            account: account.id,
            refresh_url: `${process.env.FRONTEND_URL}/dashboard/perfil`,
            return_url: `${process.env.FRONTEND_URL}/dashboard/perfil?stripe_callback=true`,
            type: 'account_onboarding',
        });

        res.json({ url: accountLink.url });
    } catch (err) {
        console.error("❌ Erro Onboarding:", err.message);
        res.status(500).json({ error: err.message });
    }
};

// --- 3. VERIFICAR STATUS DA CONTA (PARA O FRONTEND) ---
exports.verificarStatusStripe = async (req, res) => {
    try {
        const { email } = req.query;
        const result = await db.query("SELECT stripe_account_id FROM public.produtores WHERE email = $1", [email]);
        
        if (!result.rows[0]?.stripe_account_id) return res.json({ conectado: false });

        const account = await stripe.accounts.retrieve(result.rows[0].stripe_account_id);
        
        if (account.details_submitted) {
            await db.query("UPDATE public.produtores SET status = 'Ativo' WHERE email = $1", [email]);
            return res.json({ conectado: true, charges_enabled: account.charges_enabled });
        }

        res.json({ conectado: false, status: 'pendente' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// --- 4. WEBHOOK (CONFIRMAR PAGAMENTOS E ATUALIZAR CONTAS) ---
exports.webhookStripe = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    switch (event.type) {
        // A) PAGAMENTO APROVADO (CARTÃO OU PIX)
        case 'checkout.session.completed':
            const session = event.data.object;
            const { usuarioEmail, tituloEvento, quantidade, eventoId, dataEvento, horaEvento, localEvento } = session.metadata;

            try {
                await db.query(`
                    INSERT INTO public.compras (usuario_email, evento_id, evento_nome, data_evento, quantidade, valor_total, status, stripe_session_id)
                    VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, 'Aprovado', $6)
                `, [usuarioEmail, eventoId, tituloEvento, parseInt(quantidade), session.amount_total / 100, session.id]);

                const linkIngresso = `${process.env.FRONTEND_URL}/pagamento/sucesso?session_id=${session.id}`;
                await enviarIngressoEmail(usuarioEmail, { 
                    tituloEvento, quantidade, linkIngresso, dataEvento, horaEvento, localEvento 
                });
                console.log(`✅ Ingresso enviado para: ${usuarioEmail}`);
            } catch (err) {
                console.error("❌ Erro ao salvar compra:", err.message);
            }
            break;

        // B) CONTA DO PRODUTOR ATUALIZADA (FINALIZOU ONBOARDING)
        case 'account.updated':
            const account = event.data.object;
            if (account.details_submitted) {
                await db.query("UPDATE public.produtores SET status = 'Ativo' WHERE stripe_account_id = $1", [account.id]);
                console.log(`💳 Produtor Ativado no Stripe: ${account.id}`);
            }
            break;
    }

    res.json({ received: true });
};

// --- 5. CONSULTAS ---
exports.buscarDetalhesCompra = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const result = await db.query(
            `SELECT c.*, e.hora_inicio as hora_evento, e.local_nome as local_evento
             FROM public.compras c
             LEFT JOIN public.eventos e ON e.id = c.evento_id
             WHERE c.stripe_session_id = $1`, [sessionId]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.listarMeusIngressos = async (req, res) => {
    try {
        const { email } = req.query;
        const result = await db.query(
            "SELECT *, TO_CHAR(data_evento, 'DD/MM/YYYY') as data FROM public.compras WHERE usuario_email = $1 ORDER BY id DESC", 
            [email]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar ingressos." });
    }
};