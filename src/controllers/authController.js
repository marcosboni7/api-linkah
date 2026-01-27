const db = require('../config/database');

// --- 1. CADASTRO DE PRODUTOR ---
exports.registerProdutor = async (req, res) => {
    try {
        // ESSA LINHA É A MAIS IMPORTANTE PARA O DEBUG:
        console.log("📦 CORPO DA REQUISIÇÃO RECEBIDO:", req.body);

        const nome = req.body?.nome || req.body?.name || req.body?.userName;
        const email = req.body?.email || req.body?.userEmail || req.body?.produtor_email;
        const senha = req.body?.senha || req.body?.password || req.body?.userPassword;

        if (!nome || !email || !senha) {
            console.error("⚠️ CAMPOS FALTANDO:", { nome, email, senha });
            return res.status(400).json({ 
                message: "Preencha todos os campos obrigatórios.",
                debug: { 
                    recebido: req.body, 
                    esperado: ["nome", "email", "senha"] 
                }
            });
        }

        // Verifica duplicidade
        const checkUser = await db.query('SELECT * FROM public.produtores WHERE email = $1', [email]);
        if (checkUser.rows.length > 0) {
            return res.status(400).json({ message: "Este e-mail já está cadastrado." });
        }

        const query = `INSERT INTO public.produtores (nome, email, senha) VALUES ($1, $2, $3) RETURNING id, nome, email`;
        const result = await db.query(query, [nome, email, senha]);

        return res.status(201).json({ message: "Cadastro realizado!", user: result.rows[0] });
    } catch (err) {
        console.error("❌ ERRO NO SELETOR:", err.message);
        return res.status(500).json({ message: "Erro interno", error: err.message });
    }
};

// --- 2. LOGIN ---
exports.login = async (req, res) => {
    try {
        // Também deixei o login flexível para evitar erros
        const email = req.body.email || req.body.userEmail;
        const senha = req.body.senha || req.body.password;

        if (!email || !senha) {
            return res.status(400).json({ message: "E-mail e senha são obrigatórios." });
        }

        const query = 'SELECT * FROM public.produtores WHERE email = $1 AND senha = $2';
        const result = await db.query(query, [email, senha]);

        if (result.rows.length === 0) {
            return res.status(401).json({ message: "E-mail ou senha incorretos." });
        }

        const user = result.rows[0];
        console.log(`✅ Login realizado: ${user.nome}`);
        
        return res.status(200).json({
            message: "Login realizado com sucesso",
            user: { id: user.id, nome: user.nome, email: user.email }
        });
    } catch (err) {
        console.error("❌ ERRO NO LOGIN:", err.message);
        return res.status(500).json({ message: "Erro ao realizar login" });
    }
};

// --- 3. BUSCAR PERFIL ---
exports.getPerfil = async (req, res) => {
    try {
        const { email } = req.query; 
        const query = 'SELECT id, nome, email, foto_perfil FROM public.produtores WHERE email = $1';
        const result = await db.query(query, [email]);

        if (result.rows.length === 0) {
            return res.status(200).json({}); // Retorna vazio em vez de erro para não travar o Front
        }

        return res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error("❌ ERRO AO BUSCAR PERFIL:", err.message);
        return res.status(500).json({ message: "Erro ao buscar dados" });
    }
};

// --- 4. ATUALIZAR PERFIL ---
exports.updatePerfil = async (req, res) => {
    try {
        const { email_original, nome, email_novo, foto_perfil } = req.body;

        const query = `
            UPDATE public.produtores 
            SET nome = $1, email = $2, foto_perfil = $3
            WHERE email = $4
            RETURNING id, nome, email;
        `;
        const values = [nome, email_novo, foto_perfil, email_original];
        const result = await db.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }

        console.log(`✅ Perfil atualizado: ${email_novo}`);
        return res.status(200).json({ message: "Perfil atualizado!", user: result.rows[0] });
    } catch (err) {
        console.error("❌ ERRO AO ATUALIZAR PERFIL:", err.message);
        return res.status(500).json({ message: "Erro ao atualizar dados" });
    }
};