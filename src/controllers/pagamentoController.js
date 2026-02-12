// --- 2. WEBHOOK DA STRIPE (Processamento Pós-Pagamento) ---
exports.webhookStripe = async (req, res) => {
    // Comentamos a assinatura para permitir o teste manual via cURL
    // const sig = req.headers['stripe-signature']; 
    let event;

    try {
        // COMENTAMOS O CONSTRUCTEVENT PARA TESTE:
        /*
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
        */
        
        // AGORA ACEITAMOS O CORPO DA REQUISIÇÃO DIRETO:
        event = req.body; 

        console.log("🔔 Webhook recebido (Modo Manual):", event.type);

        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            
            // Pegando os dados do metadata (importante!)
            const { usuarioEmail, tituloEvento, quantidade, eventoId } = session.metadata;

            console.log("📝 Tentando salvar no banco para:", usuarioEmail);

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

            console.log("✅ Compra salva no banco!");

            // 2. CRIAR O LINK DO INGRESSO DIGITAL
            const linkIngresso = `${process.env.FRONTEND_URL}/pagamento/sucesso?session_id=${session.id}`;

            // 3. ENVIAR E-MAIL
            await transporter.sendMail({
                from: `"Linkah Eventos" <${process.env.GMAIL_USER}>`,
                to: usuarioEmail,
                subject: `🎟️ Seu Ingresso Confirmado: ${tituloEvento}`,
                html: `<h1>Pagamento Confirmado!</h1><p>Acesse seu ingresso em: ${linkIngresso}</p>`
            });

            console.log(`✅ Processo concluído para ${usuarioEmail}`);
        }

        res.status(200).json({ received: true });

    } catch (error) {
        console.error("❌ Erro no processamento do webhook:", error.message);
        res.status(500).json({ error: error.message });
    }
};