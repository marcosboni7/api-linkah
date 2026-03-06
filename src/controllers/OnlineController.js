const db = require('../config/database');

exports.criarEventoOnline = async (req, res) => {
    console.log("--- 🌐 Iniciando criação de Evento Online (Modo Base64) ---");
    
    // Agora extraindo link_reuniao para bater com o banco de dados
    const { 
        produtor_email, 
        nome, 
        categoria, 
        link_reuniao, // <--- Ajustado aqui
        descricao, 
        data_inicio, 
        hora_inicio, 
        data_termino, 
        hora_termino, 
        status, 
        tipo,
        imagem_capa 
    } = req.body;

    // Logs para Debug no terminal da AWS
    console.log("Recebido nome:", nome);
    console.log("Link da Reunião:", link_reuniao ? "Recebido ✅" : "Vazio ❌");
    console.log("Possui imagem?", imagem_capa ? "Sim (Base64)" : "Não");

    // Validação básica
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
                link_reuniao, -- <--- Nome real da coluna no seu DB
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
            link_reuniao, // <--- Agora o valor correto entra aqui
            descricao || '', 
            data_inicio, 
            hora_inicio, 
            data_termino || null, 
            hora_termino || null, 
            status || 'Ativo', 
            tipo || 'online', // Padronizado para minúsculo
            imagem_capa 
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