const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('../config/database'); 
const { enviarIngressoEmail } = require('../services/emailService');

exports.ouvirStripe = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(
            req.body, 
            sig, 
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.log(`⚠️ Erro no Webhook Signature: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const { usuarioEmail, eventoId, quantidade } = session.metadata;

        const idEventoNumerico = parseInt(eventoId);
        const qtdNumerica = parseInt(quantidade);

        console.log(`✅ Pagamento aprovado: ${usuarioEmail} | Evento: ${idEventoNumerico}`);
        
        try {
            // 1. Registrar a compra (IDEMPOTÊNCIA)
            const compraCheck = await db.query(
                "SELECT id FROM public.compras WHERE stripe_session_id = $1", 
                [session.id]
            );

            if (compraCheck.rows.length === 0) {
                const queryCompra = `
                    INSERT INTO public.compras (usuario_email, evento_id, quantidade, status, stripe_session_id, valor_total)
                    VALUES ($1, $2, $3, $4, $5, $6)
                `;

                await db.query(queryCompra, [
                    usuarioEmail,
                    idEventoNumerico,
                    qtdNumerica,
                    'Aprovado', 
                    session.id,
                    session.amount_total / 100
                ]);
                console.log('💾 Registro de compra salvo no banco.');
            }

            // 2. Buscar dados do Evento
            // O código abaixo só vai funcionar se você rodar o ALTER TABLE do passo 1
            const queryEvento = `
                SELECT nome, data_inicio, hora_inicio, local_nome, tipo, link_reuniao 
                FROM public.eventos 
                WHERE id = $1
            `;
            const eventoRes = await db.query(queryEvento, [idEventoNumerico]);
            const evento = eventoRes.rows[0];

            if (!evento) {
                console.error(`❌ Evento ID ${idEventoNumerico} não encontrado.`);
                return res.json({ received: true }); 
            }

            // 3. Disparar E-mail (Envolvido em try/catch para não quebrar o resto)
            try {
                const baseUrl = process.env.FRONTEND_URL || 'https://linkah-frontend-ivory.vercel.app';
                const linkIngresso = `${baseUrl}/pagamento/sucesso?session_id=${session.id}`;
                
                const dadosParaEmail = {
                    tituloEvento: evento.nome,
                    dataEvento: evento.data_inicio ? new Date(evento.data_inicio).toLocaleDateString('pt-BR') : 'A confirmar',
                    horaEvento: evento.hora_inicio || 'A confirmar',
                    localEvento: (evento.tipo === 'online' || evento.tipo === 'Online') 
                        ? 'Plataforma Online' 
                        : (evento.local_nome || 'A confirmar'),
                    quantidade: qtdNumerica,
                    linkIngresso: linkIngresso,
                    linkReuniao: evento.link_reuniao || '', 
                    tipo: evento.tipo
                };

                console.log(`📧 Disparando e-mail para ${usuarioEmail}...`);
                await enviarIngressoEmail(usuarioEmail, dadosParaEmail);
                console.log('✨ E-mail enviado!');
            } catch (emailErr) {
                console.error('❌ Erro ao enviar e-mail, mas a compra foi salva:', emailErr.message);
            }

        } catch (error) {
            console.error('❌ Erro no processamento do Webhook:', error.message);
        }
    }

    res.json({ received: true });
};