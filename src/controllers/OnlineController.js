const db = require('../config/database');

exports.criarEventoOnline = async (req, res) => {
    console.log("--- 🌐 Iniciando criação de Evento Online com Imagem ---");
    
    // 1. Pegamos a imagem que vem do Multer (req.file)
    // Se não houver arquivo, deixamos null ou uma string vazia
    const imagem_capa = req.file ? `/uploads/${req.file.filename}` : null;

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
        tipo 
    } = req.body;

    if (!produtor_email || !nome) {
        return res.status(400).json({ error: "E-mail do produtor e nome do evento são obrigatórios." });
    }

    try {
        // 2. Adicionei 'imagem_capa' na Query
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

        // 3. Adicionei a variável imagem_capa no array de valores ($12)
        const values = [
            produtor_email, 
            nome, 
            categoria || 'Geral', 
            link_transmissao, 
            descricao, 
            data_inicio, 
            hora_inicio, 
            data_termino, 
            hora_termino, 
            status || 'Ativo', 
            tipo || 'Online',
            imagem_capa 
        ];

        const result = await db.query(query, values);

        console.log(`✅ Evento Online criado com ID: ${result.rows[0].id} e imagem salva.`);

        res.status(201).json({ 
            id: result.rows[0].id, 
            message: "Evento Online registrado com sucesso!",
            imagem: imagem_capa
        });

    } catch (err) {
        console.error("❌ ERRO NO BANCO DE DADOS:", err.message);
        res.status(500).json({ 
            error: "Erro ao salvar evento online.",
            detalhe: err.message 
        });
    }
};