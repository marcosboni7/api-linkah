const db = require('../config/database');

exports.criarEventoOnline = async (req, res) => {
    console.log("--- 🌐 Iniciando criação de Evento Online (Modo Base64) ---");
    
    // Agora tudo vem do req.body, inclusive a imagem_capa
    const { 
        produtor_email, 
        nome, 
        categoria, 
        link_transmissao, 
        descricao, 
        data_inicio, 
        hora_inicio, 
        data_termino, 
        hora_termino, 
        status, 
        tipo,
        imagem_capa // O texto Base64 enviado pelo Front-end
    } = req.body;

    // Log para conferir o que está chegando
    console.log("Recebido nome:", nome);
    console.log("Possui imagem?", imagem_capa ? "Sim (Base64)" : "Não");

    // Validação
    if (!produtor_email || !nome) {
        return res.status(400).json({ 
            error: "E-mail do produtor e nome do evento são obrigatórios." 
        });
    }

    try {
        const query = `
            INSERT INTO public.eventos (
                produtor_email, 
                nome, 
                categoria, 
                link_transmissao, 
                descricao, 
                data_inicio, 
                hora_inicio, 
                data_termino, 
                hora_termino, 
                status, 
                tipo,
                imagem_capa
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
            RETURNING id
        `;

        const values = [
            produtor_email, 
            nome, 
            categoria || 'Geral', 
            link_transmissao, 
            descricao || '', 
            data_inicio, 
            hora_inicio, 
            data_termino || null, 
            hora_termino || null, 
            status || 'Ativo', 
            tipo || 'Online',
            imagem_capa // Salvando o texto gigante diretamente na coluna TEXT
        ];

        const result = await db.query(query, values);

        console.log(`✅ Evento Online criado com ID: ${result.rows[0].id}`);

        res.status(201).json({ 
            id: result.rows[0].id, 
            message: "Evento Online registrado com sucesso!" 
        });

    } catch (err) {
        console.error("❌ ERRO NO BANCO DE DADOS:", err.message);
        res.status(500).json({ 
            error: "Erro ao salvar evento online.",
            detalhe: err.message 
        });
    }
};