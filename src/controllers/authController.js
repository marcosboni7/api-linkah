const db = require('../config/database');
const sendMail = require('../config/mailer');

// --- 1. CADASTRO DE PRODUTOR ---
exports.registerProdutor = async (req, res) => {
    try {
        const nome = (req.body.nome || '').trim();
        const email = (req.body.email || '').trim().toLowerCase();
        const senha = req.body.senha;

        if (!nome || !email || !senha) {
            return res.status(400).json({ message: "Nome, E-mail e Senha são obrigatórios." });
        }

        // Verifica em ambas as tabelas para evitar e-mails duplicados
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

        await db.query(query, values);

        const htmlContent = `<h2>Olá ${nome}, bem-vindo à LINKAH!</h2><p>Sua conta de produtor foi criada com sucesso.</p>`;
        sendMail(email, 'Bem-vindo à Linkah!', htmlContent).catch(err => {
            console.error("📧 Erro e-mail:", err.message);
        });

        return res.status(201).json({ 
            message: "Cadastro realizado com sucesso!",
            user: { nome, email }
        });

    } catch (err) {
        console.error("❌ ERRO NO REGISTRO:", err.message);
        return res.status(500).json({ message: "Erro ao processar cadastro." });
    }
};

// --- 2. LOGIN COM MENSAGEM DE BANIMENTO PERSONALIZADA ---
exports.login = async (req, res) => {
    try {
        const email = (req.body.email || '').trim().toLowerCase();
        const senha = (req.body.senha || '').trim();

        if (!email || !senha) {
            return res.status(400).json({ message: "E-mail e senha são obrigatórios." });
        }

        // Tenta encontrar em produtores, depois em usuários
        let result = await db.query('SELECT * FROM public.produtores WHERE LOWER(email) = $1 AND senha = $2', [email, senha]);
        
        if (result.rows.length === 0) {
            result = await db.query('SELECT * FROM public.usuarios WHERE LOWER(email) = $1 AND senha = $2', [email, senha]);
        }
        
        if (result.rows.length === 0) {
            return res.status(401).json({ message: "E-mail ou senha incorretos." });
        }

        const user = result.rows[0];

        // --- 🛡️ TRAVA DE SEGURANÇA: CONTA BANIDA ---
        if (user.status === 'Banido') {
            return res.status(403).json({ 
                message: "VOCÊ FOI BANIDO", 
                details: "🚨 Sua conta foi suspensa por violação dos termos de uso da Linkah. O acesso está permanentemente bloqueado." 
            });
        }

        if (user.status === 'Inativo') {
            return res.status(403).json({ 
                message: "CONTA INATIVA", 
                details: "Sua conta está inativa no momento. Por favor, fale com o suporte para reativar." 
            });
        }

        const perfilCompleto = !!(user.cpf_cnpj && user.cep);

        return res.status(200).json({ 
            message: "Login realizado!", 
            user: { 
                nome: user.nome || 'Usuário', 
                email: user.email, 
                role: user.role || 'user',
                status: user.status,
                cpf_cnpj: user.cpf_cnpj || null,
                cep: user.cep || null,
                perfil_completo: perfilCompleto 
            } 
        });
    } catch (err) { 
        console.error("❌ ERRO LOGIN:", err.message);
        return res.status(500).json({ message: "Erro interno no servidor de login" }); 
    }
};

// --- 3. BUSCAR PERFIL ---
exports.getPerfil = async (req, res) => {
    try {
        const email = (req.query.email || '').trim().toLowerCase();
        
        let result = await db.query('SELECT * FROM public.produtores WHERE LOWER(email) = $1', [email]);
        if (result.rows.length === 0) {
            result = await db.query('SELECT * FROM public.usuarios WHERE LOWER(email) = $1', [email]);
        }

        if (result.rows.length === 0) return res.status(404).json({ message: "Usuário não encontrado." });
        
        // Se o usuário for banido enquanto navega, bloqueamos o retorno do perfil também
        if (result.rows[0].status === 'Banido') {
            return res.status(403).json({ message: "Conta Banida" });
        }

        return res.status(200).json(result.rows[0]);
    } catch (err) { 
        return res.status(500).json({ message: "Erro ao buscar perfil" }); 
    }
};

// --- 4. ATUALIZAR PERFIL ---
exports.updatePerfil = async (req, res) => {
    try {
        const { email_original, nome, cpf_cnpj, cep, rua, numero, bairro, estado, telefone } = req.body;
        const emailLower = email_original.toLowerCase();

        // Tenta atualizar produtores
        let updateResult = await db.query(
            `UPDATE public.produtores SET nome=$1, cpf_cnpj=$2, cep=$3, rua=$4, numero=$5, bairro=$6, estado=$7, telefone=$8 WHERE LOWER(email)=$9`,
            [nome, cpf_cnpj, cep, rua, numero, bairro, estado, telefone, emailLower]
        );

        // Tenta atualizar usuários se não afetou produtores
        if (updateResult.rowCount === 0) {
            await db.query(
                `UPDATE public.usuarios SET nome=$1 WHERE LOWER(email)=$2`,
                [nome, emailLower]
            );
        }

        return res.status(200).json({ message: "Perfil atualizado!" });
    } catch (err) { 
        console.error("❌ ERRO UPDATE:", err.message);
        return res.status(500).json({ message: "Erro ao atualizar perfil" }); 
    }
};