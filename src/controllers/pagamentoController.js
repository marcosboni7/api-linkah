const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('../config/database');
const { enviarIngressoEmail } = require('../services/emailService');

// --- 1. CRIAR SESSÃO DE CHECKOUT (APENAS CARTÃO) ---
exports.criarSessaoCheckout = async (req, res) => {
    try {
        const { evento, usuarioEmail, quantidade } = req.body;
        const baseUrl = process.env.FRONTEND_URL;

        // 1. BUSCA DETALHES NO BANCO PARA GARANTIR SEGURANÇA DE PREÇO
        const dadosEventoBD = await db.query(
            "SELECT id, nome, data_inicio, hora_inicio, local_nome, stripe_account_id, preco FROM public.eventos WHERE id = $1",
            [evento.id]
        );

        if (dadosEventoBD.rows.length === 0) {
            return res.status(404).json({ error: "Evento não encontrado no banco de dados." });
        }

        const ev = dadosEventoBD.rows[0];

        // 2. LÓGICA DE PREÇO (Calcula em centavos para o Stripe)
        const precoUnitario = (ev.preco && Number(ev.preco) !== 0) 
            ? Number(ev.preco) 
            : Number(evento.preco);

        const precoFinalEmCentavos = Math.round(precoUnitario * 100);

        // Validação de segurança: Stripe não aceita menos de R$ 0,50
        if (precoFinalEmCentavos < 50) {
            return res.status(400).json({ error: "O valor mínimo para processamento é R$ 0,50." });
        }

        // 3. CONFIGURAÇÃO DOS PARÂMETROS DA SESSÃO
        const sessionParams = {
            payment_method_types: ['card'], // APENAS CARTÃO
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

        // 4. LÓGICA DE SPLIT (Se houver conta de destino configurada)
        if (ev.stripe_account_id) {
            const feePercent = 0.05; // Sua taxa de 5%
            sessionParams.payment_intent_data = {
                application_fee_amount: Math.round(precoFinalEmCentavos * feePercent * quantidade),
                transfer_data: {
                    destination: ev.stripe_account_id,
                },
            };
        }

        // 5. CRIAÇÃO DA SESSÃO NO STRIPE
        const session = await stripe.checkout.sessions.create(sessionParams);
        
        console.log(`✅ Sessão criada com sucesso para: ${usuarioEmail}`);
        res.json({ url: session.url });

    } catch (err) {
        console.error("❌ Erro ao criar sessão Stripe:", err.message);
        res.status(500).json({ error: `Erro no servidor: ${err.message}` });
    }
};

// --- 2. WEBHOOK PARA CONFIRMAR PAGAMENTO ---
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
            // SALVA A COMPRA NO BANCO
            await db.query(`
                INSERT INTO public.compras (usuario_email, evento_id, evento_nome, data_evento, quantidade, valor_total, status, stripe_session_id)
                VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, 'Aprovado', $6)
            `, [usuarioEmail, eventoId, tituloEvento, parseInt(quantidade), session.amount_total / 100, session.id]);

            // ENVIA O E-MAIL COM O INGRESSO
            const linkIngresso = `${process.env.FRONTEND_URL}/pagamento/sucesso?session_id=${session.id}`;
            await enviarIngressoEmail(usuarioEmail, { 
                tituloEvento, 
                quantidade, 
                linkIngresso, 
                dataEvento, 
                horaEvento, 
                localEvento 
            });

            console.log(`✅ Pedido finalizado e e-mail enviado: ${usuarioEmail}`);
        } catch (error) {
            console.error("❌ Erro ao processar sucesso do Webhook:", error.message);
        }
    }

    res.status(200).json({ received: true });
};

// --- 3. BUSCAR DETALHES PARA PÁGINA DE SUCESSO ---
exports.buscarDetalhesCompra = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const result = await db.query(
            `SELECT c.evento_nome, c.usuario_email, c.quantidade, c.valor_total, 
                    TO_CHAR(c.data_evento, 'DD/MM/YYYY') as data_evento_formatada,
                    e.hora_inicio as hora_evento, e.local_nome as local_evento
             FROM public.compras c
             LEFT JOIN public.eventos e ON e.id = c.evento_id
             WHERE c.stripe_session_id = $1`, 
            [sessionId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Compra não encontrada." });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error("❌ Erro ao buscar detalhes da compra:", err.message);
        res.status(500).json({ error: err.message });
    }
};

// --- 4. LISTAR TODOS OS INGRESSOS DE UM USUÁRIO (Para o Modal da Navbar) ---
exports.listarMeusIngressos = async (req, res) => {
    try {
        const { email } = req.query;

        if (!email) {
            return res.status(400).json({ error: "E-mail não fornecido." });
        }

        // O alias 'as evento', 'as data' e 'as qtd' é para casar com o Front-end
        // Adicionado stripe_session_id para permitir o clique no card
        const result = await db.query(
            `SELECT 
                id, 
                evento_nome as evento, 
                TO_CHAR(data_evento, 'DD/MM/YYYY') as data, 
                status, 
                quantidade as qtd,
                stripe_session_id
             FROM public.compras 
             WHERE usuario_email = $1 
             ORDER BY id DESC`, 
            [email]
        );

        res.json(result.rows);
    } catch (err) {
        console.error("❌ Erro ao listar ingressos:", err.message);
        res.status(500).json({ error: "Erro ao buscar ingressos no servidor." });
    }
};