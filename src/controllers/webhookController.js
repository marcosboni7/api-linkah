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
        
        // CAPTURANDO O AFILIADO DO METADATA (Vindo do checkout)
        const { usuarioEmail, eventoId, quantidade, afiliadoId } = session.metadata;

        const idEventoNumerico = parseInt(eventoId);
        const qtdNumerica = parseInt(quantidade);
        const valorTotal = session.amount_total / 100;

        console.log(`✅ Pagamento aprovado: ${usuarioEmail} | Evento: ${idEventoNumerico} | Afiliado: ${afiliadoId || 'Nenhum'}`);
        
        try {
            // 1. Registrar a compra (IDEMPOTÊNCIA)
            const compraCheck = await db.query(
                "SELECT id FROM public.compras WHERE stripe_session_id = $1", 
                [session.id]
            );

            if (compraCheck.rows.length === 0) {
                // LÓGICA DE CÁLCULO DE COMISSÃO
                let valorComissao = 0;
                if (afiliadoId) {
                    // Exemplo: 10% fixo. No futuro você pode buscar a taxa real do banco aqui.
                    valorComissao = valorTotal * 0.10; 
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
                    afiliadoId || null, // Novo campo
                    valorComissao      // Novo campo
                ]);
                console.log(`💾 Registro de compra salvo. Comissão de R$${valorComissao} para o afiliado.`);
            }

            // 2. Buscar dados do Evento (para o e-mail)
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

            // 3. Disparar E-mail
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

                await enviarIngressoEmail(usuarioEmail, dadosParaEmail);
                console.log('✨ E-mail enviado!');
            } catch (emailErr) {
                console.error('❌ Erro ao enviar e-mail:', emailErr.message);
            }

        } catch (error) {
            console.error('❌ Erro no processamento do Webhook:', error.message);
        }
    }

    res.json({ received: true });
};