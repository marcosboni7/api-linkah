const db = require('../config/database');
const { sendMail } = require('../config/mailer');

// --- 1. CADASTRO DE PRODUTOR ---
exports.registerProdutor = async (req, res) => {
    try {
        const nome = (req.body.nome || '').trim();
        const email = (req.body.email || '').trim().toLowerCase();
        const senha = String(req.body.senha || '');

        if (!nome || !email || !senha) {
            return res.status(400).json({ message: "Nome, E-mail e Senha são obrigatórios." });
        }

        // Verifica se já existe em produtores ou usuários
        const checkUser = await db.query(
            'SELECT email FROM public.produtores WHERE LOWER(email) = $1 UNION SELECT email FROM public.usuarios WHERE LOWER(email) = $1', 
            [email]
        );
        
        if (checkUser.rows.length > 0) {
            return res.status(400).json({ message: "Este e-mail já está cadastrado no sistema." });
        }

        const query = `
            INSERT INTO public.produtores (
                nome, email, senha, cpf_cnpj, telefone, tipo, 
                data_nascimento, cep, rua, numero, bairro, estado,
                razao_social, status, role
            ) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) 
            RETURNING email, nome;
        `;
        
        const values = [
            nome, email, senha, 
            req.body.cpf_cnpj || null, 
            req.body.telefone || null, 
            req.body.tipo || 'PF',
            req.body.data_nascimento || null,
            req.body.cep || null,
            req.body.rua || null,
            req.body.numero || null,
            req.body.bairro || null,
            req.body.estado || null,
            req.body.razao_social || null,
            'Ativo',
            'produtor'
        ];

        // Salva no Banco primeiro
        await db.query(query, values);
        console.log(`✅ Novo produtor salvo no banco: ${email}`);

        // Tenta enviar e-mail em background
        const htmlContent = `<h2>Olá ${nome}, bem-vindo à Linkah!</h2><p>Sua conta foi criada com sucesso.</p>`;
        sendMail(email, 'Bem-vindo à Linkah!', htmlContent).catch(err => {
            console.error("⚠️ Falha silenciosa no envio do e-mail:", err.message);
        });

        return res.status(201).json({ 
            message: "Cadastro realizado com sucesso!",
            user: { nome, email }
        });

    } catch (err) {
        console.error("❌ ERRO NO REGISTRO:", err.message);
        return res.status(500).json({ message: "Erro ao processar cadastro: " + err.message });
    }
};

// --- 2. LOGIN (Versão Blindada contra Erro 500) ---
exports.login = async (req, res) => {
    try {
        const email = (req.body.email || '').trim().toLowerCase();
        const senha = String(req.body.senha || '').trim();

        if (!email || !senha) {
            return res.status(400).json({ message: "E-mail e senha são obrigatórios." });
        }

        console.log(`🔑 Tentativa de login: ${email}`);

        // Busca primeiro em produtores
        let result = await db.query('SELECT * FROM public.produtores WHERE LOWER(email) = $1 AND senha = $2', [email, senha]);
        
        // Se não achou, busca em usuários
        if (result.rows.length === 0) {
            result = await db.query('SELECT * FROM public.usuarios WHERE LOWER(email) = $1 AND senha = $2', [email, senha]);
        }
        
        if (result.rows.length === 0) {
            console.log(`❌ Credenciais inválidas para: ${email}`);
            return res.status(401).json({ message: "E-mail ou senha incorretos." });
        }

        const user = result.rows[0];

        // Verificação de Status
        if (user.status === 'Banido') {
            return res.status(403).json({ message: "Sua conta está permanentemente suspensa." });
        }

        // Verifica se o perfil está completo (evita quebrar se a coluna não existir em 'usuarios')
        const temCpf = user.cpf_cnpj ? true : false;
        const temCep = user.cep ? true : false;
        const perfilCompleto = temCpf && temCep;

        console.log(`✅ Login bem-sucedido: ${user.email}`);

        return res.status(200).json({ 
            message: "Login realizado!", 
            user: { 
                nome: user.nome || 'Usuário', 
                email: user.email, 
                role: user.role || 'user',
                status: user.status || 'Ativo',
                perfil_completo: perfilCompleto 
            } 
        });
    } catch (err) { 
        console.error("❌ ERRO CRÍTICO NO LOGIN:", err.message);
        return res.status(500).json({ 
            message: "Erro interno no servidor de login",
            debug: err.message 
        }); 
    }
};

// --- 3. BUSCAR PERFIL ---
exports.getPerfil = async (req, res) => {
    try {
        const email = (req.query.email || '').trim().toLowerCase();
        if (!email) return res.status(400).json({ message: "Email é necessário." });

        let result = await db.query('SELECT * FROM public.produtores WHERE LOWER(email) = $1', [email]);
        if (result.rows.length === 0) {
            result = await db.query('SELECT * FROM public.usuarios WHERE LOWER(email) = $1', [email]);
        }

        if (result.rows.length === 0) return res.status(404).json({ message: "Usuário não encontrado." });
        
        return res.status(200).json(result.rows[0]);
    } catch (err) { 
        return res.status(500).json({ message: "Erro ao buscar perfil" }); 
    }
};

// --- 4. ATUALIZAR PERFIL ---
exports.updatePerfil = async (req, res) => {
    try {
        const { email_original, nome, cpf_cnpj, cep, rua, numero, bairro, estado, telefone, razao_social } = req.body;
        
        if (!email_original) return res.status(400).json({ message: "Email original não informado." });
        
        const emailLower = email_original.toLowerCase();

        let updateResult = await db.query(
            `UPDATE public.produtores SET nome=$1, cpf_cnpj=$2, cep=$3, rua=$4, numero=$5, bairro=$6, estado=$7, telefone=$8, razao_social=$9 WHERE LOWER(email)=$10`,
            [nome, cpf_cnpj, cep, rua, numero, bairro, estado, telefone, razao_social, emailLower]
        );

        if (updateResult.rowCount === 0) {
            await db.query(
                `UPDATE public.usuarios SET nome=$1, telefone=$2 WHERE LOWER(email)=$3`,
                [nome, telefone, emailLower]
            );
        }

        return res.status(200).json({ message: "Perfil atualizado com sucesso!" });
    } catch (err) { 
        console.error("❌ ERRO UPDATE:", err.message);
        return res.status(500).json({ message: "Erro ao atualizar perfil" }); 
    }
};