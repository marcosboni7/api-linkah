const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('../config/database');
const { enviarIngressoEmail } = require('../services/emailService');

// --- 1. CRIAR SESSÃO DE CHECKOUT ---
exports.criarSessaoCheckout = async (req, res) => {
    try {
        const { evento, usuarioEmail, quantidade } = req.body;
        const baseUrl = process.env.FRONTEND_URL;

        const dadosEventoBD = await db.query(
            `SELECT e.id, e.nome, e.data_inicio, e.hora_inicio, e.local_nome, e.preco, e.tipo, e.link_reuniao, p.stripe_account_id 
             FROM public.eventos e
             JOIN public.produtores p ON e.produtor_email = p.email 
             WHERE e.id = $1`,
            [evento.id]
        );

        if (dadosEventoBD.rows.length === 0) {
            return res.status(404).json({ error: "Evento não encontrado ou produtor não vinculado." });
        }

        const ev = dadosEventoBD.rows[0];
        const precoUnitario = (ev.preco && Number(ev.preco) !== 0) ? Number(ev.preco) : Number(evento.preco);
        const precoFinalEmCentavos = Math.round(precoUnitario * 100);

        if (precoFinalEmCentavos < 50) {
            return res.status(400).json({ error: "Valor mínimo R$ 0,50." });
        }

        const sessionParams = {
            payment_method_types: ['card'],
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
                localEvento: ev.tipo === 'online' ? 'Evento Online' : (ev.local_nome || 'Local a definir'),
                linkReuniao: ev.link_reuniao || '' 
            },
            success_url: `${baseUrl}/pagamento/sucesso?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${baseUrl}/venda?eventoId=${ev.id}&qtd=${quantidade}`,
        };

        if (ev.stripe_account_id) {
            const feePercent = 0.05; 
            sessionParams.payment_intent_data = {
                application_fee_amount: Math.round(precoFinalEmCentavos * feePercent * parseInt(quantidade)),
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

// --- 2. VINCULAR CONTA DO PRODUTOR ---
exports.vincularContaStripe = async (req, res) => {
    try {
        const { email } = req.body;
        const account = await stripe.accounts.create({
            type: 'express',
            email: email,
            capabilities: {
                card_payments: { requested: true },
                transfers: { requested: true },
            },
            business_type: 'individual',
        });

        await db.query("UPDATE public.produtores SET stripe_account_id = $1 WHERE email = $2", [account.id, email]);
        await db.query("UPDATE public.usuarios SET stripe_account_id = $1 WHERE email = $2", [account.id, email]);

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

// --- 3. VERIFICAR STATUS DA CONTA ---
exports.verificarStatusStripe = async (req, res) => {
    try {
        const { email } = req.query;
        const result = await db.query("SELECT stripe_account_id FROM public.produtores WHERE email = $1", [email]);
        
        if (!result.rows[0]?.stripe_account_id) {
            return res.json({ conectado: false });
        }

        const stripeAccountId = result.rows[0].stripe_account_id;
        const account = await stripe.accounts.retrieve(stripeAccountId);
        
        if (account.details_submitted) {
            await db.query("UPDATE public.produtores SET status = 'Ativo' WHERE email = $1", [email]);
        }

        return res.json({ 
            conectado: true, 
            status_banco: account.details_submitted ? 'Ativo' : 'Pendente',
            charges_enabled: account.charges_enabled,
            payouts_enabled: account.payouts_enabled,
            details_submitted: account.details_submitted
        });

    } catch (err) {
        console.error("❌ Erro ao verificar status Stripe:", err.message);
        res.status(500).json({ error: err.message });
    }
};

// --- 4. WEBHOOK (CORRIGIDO PARA EVITAR ERROS DE TIPO E GARANTIR EMAIL) ---
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
        const meta = session.metadata;

        try {
            const existe = await db.query("SELECT id FROM public.compras WHERE stripe_session_id = $1", [session.id]);
            if (existe.rows.length === 0) {
                // Buscamos o link direto do banco usando parseInt para o ID
                const idEvento = parseInt(meta.eventoId);
                const evResult = await db.query("SELECT nome, link_reuniao, tipo FROM public.eventos WHERE id = $1", [idEvento]);
                const evData = evResult.rows[0];

                await db.query(`
                    INSERT INTO public.compras 
                    (usuario_email, evento_id, evento_nome, data_evento, quantidade, valor_total, status, stripe_session_id)
                    VALUES ($1, $2, $3, $4, $5, $6, 'Aprovado', $7)
                `, [
                    meta.usuarioEmail, 
                    idEvento, 
                    evData?.nome || meta.tituloEvento, 
                    new Date(), 
                    parseInt(meta.quantidade), 
                    session.amount_total / 100, 
                    session.id
                ]);

                console.log(`📧 Enviando e-mail para: ${meta.usuarioEmail}`);
                await enviarIngressoEmail(meta.usuarioEmail, { 
                    tituloEvento: evData?.nome || meta.tituloEvento, 
                    quantidade: meta.quantidade, 
                    linkIngresso: `${process.env.FRONTEND_URL}/pagamento/sucesso?session_id=${session.id}`, 
                    dataEvento: meta.dataEvento, 
                    horaEvento: meta.horaEvento, 
                    localEvento: meta.localEvento,
                    linkReuniao: evData?.link_reuniao || '', 
                    tipo: evData?.tipo
                });
            }
        } catch (err) {
            console.error("❌ Erro no Webhook:", err.message);
        }
    }
    res.json({ received: true });
};

// --- 5. BUSCAR DETALHES (CORRIGIDO PARA O FRONTEND E RECUPERAÇÃO) ---
exports.buscarDetalhesCompra = async (req, res) => {
    try {
        const { sessionId } = req.params;

        const result = await db.query(
            `SELECT c.*, e.hora_inicio as hora_evento, e.local_nome as local_evento, e.link_reuniao, e.tipo
             FROM public.compras c
             LEFT JOIN public.eventos e ON e.id = c.evento_id
             WHERE c.stripe_session_id = $1`, [sessionId]
        );

        if (result.rows.length > 0) {
            return res.json(result.rows[0]);
        }

        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (session.payment_status === 'paid') {
            const meta = session.metadata;
            const idEvento = parseInt(meta.eventoId);
            
            const evResult = await db.query("SELECT nome, link_reuniao, tipo FROM public.eventos WHERE id = $1", [idEvento]);
            const evData = evResult.rows[0];

            const insertQuery = `
                INSERT INTO public.compras 
                (usuario_email, evento_id, evento_nome, data_evento, quantidade, valor_total, status, stripe_session_id)
                VALUES ($1, $2, $3, $4, $5, $6, 'Aprovado', $7)
                RETURNING *
            `;

            const insertValues = [
                meta.usuarioEmail,
                idEvento,
                evData?.nome || meta.tituloEvento,
                new Date(),
                parseInt(meta.quantidade),
                session.amount_total / 100,
                session.id
            ];

            const novaCompraResult = await db.query(insertQuery, insertValues);
            
            return res.json({
                ...novaCompraResult.rows[0],
                link_reuniao: evData?.link_reuniao,
                tipo: evData?.tipo
            });
        }

        res.status(404).json({ error: "Compra não processada." });

    } catch (err) {
        console.error("❌ Erro Detalhes:", err.message);
        res.status(500).json({ error: err.message });
    }
};

// --- 6. LISTAR INGRESSOS ---
exports.listarMeusIngressos = async (req, res) => {
    try {
        const { email } = req.query;
        const result = await db.query(
            `SELECT c.*, e.link_reuniao, TO_CHAR(c.data_evento, 'DD/MM/YYYY') as data 
             FROM public.compras c 
             LEFT JOIN public.eventos e ON e.id = c.evento_id
             WHERE c.usuario_email = $1 ORDER BY c.id DESC`, 
            [email]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar ingressos." });
    }
};