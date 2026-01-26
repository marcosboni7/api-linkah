const db = require('../config/database'); // Usando o mesmo caminho do seu authController

exports.criarEventoOnline = async (req, res) => {
    console.log("--- 🌐 Iniciando criação de Evento Online ---");
    
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

    // Verificação básica de segurança
    if (!produtor_email || !nome) {
        return res.status(400).json({ error: "E-mail do produtor e nome do evento são obrigatórios." });
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
                tipo
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
            RETURNING id
        `;

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
            tipo || 'Online'
        ];

        const result = await db.query(query, values);

        console.log(`✅ Evento Online criado com ID: ${result.rows[0].id}`);

        res.status(201).json({ 
            id: result.rows[0].id, 
            message: "Evento Online registrado com sucesso!" 
        });

    } catch (err) {
        // Esse console.log é vital para ler o erro real (ex: coluna faltando)
        console.error("❌ ERRO NO BANCO DE DADOS:", err.message);
        
        res.status(500).json({ 
            error: "Erro ao salvar evento online.",
            detalhe: err.message 
        });
    }
};