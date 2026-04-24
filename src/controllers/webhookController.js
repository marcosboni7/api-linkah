exports.ouvirStripe = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    // 1. Validação do Webhook
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

    // 2. Processamento do Evento
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        
        // DEBUG: Ver o que chegou do Stripe
        console.log('🔍 [DEBUG] Sessão recebida do Stripe:', session.id);
        console.log('🔍 [DEBUG] Metadata extraído:', session.metadata);

        const { usuarioEmail, eventoId, quantidade, afiliadoId } = session.metadata;

        const idEventoNumerico = parseInt(eventoId);
        const qtdNumerica = parseInt(quantidade);
        const valorTotal = session.amount_total / 100;

        console.log(`✅ Pagamento aprovado: ${usuarioEmail} | Evento: ${idEventoNumerico} | Afiliado: ${afiliadoId || 'Nenhum'}`);
        
        try {
            // 3. Registrar a compra (IDEMPOTÊNCIA)
            const compraCheck = await db.query(
                "SELECT id FROM public.compras WHERE stripe_session_id = $1", 
                [session.id]
            );

            if (compraCheck.rows.length === 0) {
                // LÓGICA DE CÁLCULO DE COMISSÃO
                let valorComissao = 0;
                if (afiliadoId && afiliadoId !== '') {
                    // Cálculo de 10% de comissão
                    valorComissao = valorTotal * 0.10; 
                    console.log(`💰 [AFILIADO] Identificado: ${afiliadoId}. Comissão calculada: R$${valorComissao}`);
                } else {
                    console.log('ℹ️ [AFILIADO] Ninguém para comissionar nesta venda.');
                }

                const queryCompra = `
                    INSERT INTO public.compras 
                    (usuario_email, evento_id, quantidade, status, stripe_session_id, valor_total, afiliado_id, valor_comissao)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                `;

                await db.query(queryCompra, [
                    usuarioEmail,
                    idEventoNumerico,
                    qtdNumerica,
                    'Aprovado', 
                    session.id,
                    valorTotal,
                    afiliadoId || null,
                    valorComissao
                ]);
                
                console.log(`💾 [BANCO] Registro de compra salvo com sucesso! (Sessão: ${session.id})`);
            } else {
                console.log(`⚠️ [AVISO] Esta compra já foi registrada anteriormente. (Sessão: ${session.id})`);
            }

            // 4. Buscar dados do Evento (para o e-mail)
            const queryEvento = `
                SELECT nome, data_inicio, hora_inicio, local_nome, tipo, link_reuniao 
                FROM public.eventos 
                WHERE id = $1
            `;
            const eventoRes = await db.query(queryEvento, [idEventoNumerico]);
            const evento = eventoRes.rows[0];

            if (!evento) {
                console.error(`❌ [ERRO] Evento ID ${idEventoNumerico} não encontrado no banco.`);
                return res.json({ received: true }); 
            }

            // 5. Disparar E-mail
            try {
                const baseUrl = process.env.FRONTEND_URL || 'https://linkah.eu';
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

                console.log(`📧 [EMAIL] Enviando para: ${usuarioEmail}...`);
                await enviarIngressoEmail(usuarioEmail, dadosParaEmail);
                console.log('✨ [EMAIL] Enviado e finalizado!');
            } catch (emailErr) {
                console.error('❌ [ERRO EMAIL] Falha ao enviar, mas a compra está salva:', emailErr.message);
            }

        } catch (error) {
            console.error('❌ [ERRO CRÍTICO WEBHOOK]:', error.message);
            // Aqui você pode adicionar um sistema de alerta (ex: Sentry ou Slack)
        }
    }

    // O Stripe precisa desse JSON para saber que você recebeu o aviso
    res.json({ received: true });
};