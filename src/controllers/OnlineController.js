const db = require('../config/database');

exports.criarEventoOnline = async (req, res) => {
    console.log("--- 🌐 Iniciando criação de Evento Online ---");
    
    // LOGS DE DEBUG (Verifique isso no painel do Render)
    console.log("DADOS TEXTUAIS (req.body):", req.body);
    console.log("ARQUIVO RECEBIDO (req.file):", req.file);

    // 1. Tratamento da Imagem
    // Se o multer processou o arquivo, salvamos o caminho. 
    // Caso contrário, fica null.
    const imagem_capa = req.file ? `/uploads/${req.file.filename}` : null;

    // 2. Desestruturação dos dados vindos do req.body
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

    // 3. Validação Crítica
    // O erro 400 acontece aqui se o Multer não conseguir ler o FormData
    if (!produtor_email || !nome) {
        console.error("❌ VALIDAÇÃO FALHOU: E-mail ou Nome ausentes.");
        return res.status(400).json({ 
            error: "E-mail do produtor e nome do evento são obrigatórios.",
            recebido: { produtor_email, nome } // Retorna o que o servidor "entendeu"
        });
    }

    try {
        // 4. Query SQL
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

        // 5. Mapeamento de Valores
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
            imagem_capa 
        ];

        const result = await db.query(query, values);

        console.log(`✅ Evento Online criado com ID: ${result.rows[0].id}`);

        res.status(201).json({ 
            id: result.rows[0].id, 
            message: "Evento Online registrado com sucesso!",
            imagem: imagem_capa
        });

    } catch (err) {
        console.error("❌ ERRO NO BANCO DE DADOS:", err.message);
        res.status(500).json({ 
            error: "Erro ao salvar evento online no banco de dados.",
            detalhe: err.message 
        });
    }
};