const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('../config/database'); 
const { enviarIngressoEmail } = require('../services/emailService');

exports.ouvirStripe = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    // 1. Validar Assinatura do Stripe
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

    // 2. Processar Evento de Sucesso
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        
        // Metadata sempre vem como String do Stripe
        const { usuarioEmail, eventoId, quantidade } = session.metadata;

        // Conversão garantida para evitar erro de tipo no PostgreSQL
        const idEventoNumerico = parseInt(eventoId);
        const qtdNumerica = parseInt(quantidade);

        console.log(`✅ Pagamento aprovado: ${usuarioEmail} | Evento: ${idEventoNumerico}`);
        
        try {
            // 3. Verificar se já não processamos esse Session ID (Idempotência)
            const compraCheck = await db.query(
                "SELECT id FROM public.compras WHERE stripe_session_id = $1", 
                [session.id]
            );

            if (compraCheck.rows.length === 0) {
                // 4. Registrar a compra no Banco
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
                    session.amount_total / 100 // Salva o valor real em vez de centavos
                ]);
                console.log('💾 Registro de compra salvo no banco.');
            }

            // 5. Buscar dados atualizados do Evento (para pegar o link de transmissão)
            const queryEvento = `
                SELECT nome, data_inicio, hora_inicio, local_nome, tipo, link_reuniao 
                FROM public.eventos 
                WHERE id = $1
            `;
            const eventoRes = await db.query(queryEvento, [idEventoNumerico]);
            const evento = eventoRes.rows[0];

            if (!evento) {
                throw new Error(`Evento ID ${idEventoNumerico} não encontrado para envio de e-mail.`);
            }

            // 6. Preparar dados e Disparar E-mail
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
                linkReuniao: evento.link_reuniao || '', // Crucial para o botão de transmissão no e-mail
                tipo: evento.tipo
            };

            console.log(`📧 Disparando e-mail para ${usuarioEmail}...`);
            await enviarIngressoEmail(usuarioEmail, dadosParaEmail);
            
            console.log('✨ Fluxo completo finalizado com sucesso!');

        } catch (error) {
            console.error('❌ Erro interno no processamento do Webhook:', error.message);
            // Respondemos 200 aqui para o Stripe não ficar tentando reenviar se for erro de lógica
        }
    }

    // Sempre responder 200 para o Stripe
    res.json({ received: true });
};