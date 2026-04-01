const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { sendMail } = require('../config/mailer');

// --- CONFIGURAÇÃO DO JWT ---
const JWT_SECRET = process.env.JWT_SECRET || 'linkah_secret_fallback_2026';

// --- 1. CADASTRO DE PRODUTOR ---
exports.registerProdutor = async (req, res) => {
    console.log("📝 [DEPLOY LOG] Iniciando registro de produtor...");
    try {
        const nome = (req.body.nome || '').trim();
        const email = (req.body.email || '').trim().toLowerCase();
        const senha = String(req.body.senha || '');

        console.log(`🔎 [DEPLOY LOG] Verificando existência do email: ${email}`);

        const checkUser = await db.query(
            'SELECT email FROM public.produtores WHERE LOWER(email) = $1 UNION SELECT email FROM public.usuarios WHERE LOWER(email) = $1', 
            [email]
        );
        
        if (checkUser.rows.length > 0) {
            console.log(`⚠️ [DEPLOY LOG] Email já cadastrado: ${email}`);
            return res.status(400).json({ message: "Este e-mail já está cadastrado no sistema." });
        }

        const query = `
            INSERT INTO public.produtores (
                nome, email, senha, cpf_cnpj, telefone, tipo, 
                data_nascimento, cep, rua, numero, bairro, estado,
                razao_social, status, role
            ) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) 
            RETURNING id, email, nome;
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

        console.log(`💾 [DEPLOY LOG] Tentando salvar no banco...`);
        const resultInsert = await db.query(query, values);
        const newUser = resultInsert.rows[0];
        console.log(`✅ [DEPLOY LOG] Sucesso! ID: ${newUser.id}`);

        // E-mail em background
        sendMail(email, 'Bem-vindo à Linkah!', `<h2>Olá ${nome}!</h2><p>Sua conta de produtor foi criada.</p>`).catch(err => {
            console.error("⚠️ [DEPLOY LOG] Erro Mailer:", err.message);
        });

        return res.status(201).json({ 
            message: "Cadastro realizado!",
            user: { id: newUser.id, nome, email }
        });

    } catch (err) {
        console.error("❌ [DEPLOY LOG] ERRO NO REGISTRO:", err.stack);
        return res.status(500).json({ 
            message: "Erro ao processar cadastro",
            debug: err.message,
            stack: err.stack
        });
    }
};

// --- 2. LOGIN (Com Geração de Token JWT) ---
exports.login = async (req, res) => {
    console.log("🔑 [DEPLOY LOG] Nova tentativa de Login recebida");
    try {
        const email = (req.body.email || '').trim().toLowerCase();
        const senha = String(req.body.senha || '').trim();

        if (!email || !senha) {
            return res.status(400).json({ message: "E-mail e senha são obrigatórios." });
        }

        console.log(`📡 [DEPLOY LOG] Buscando usuário: ${email}`);

        // Busca em produtores
        let result = await db.query('SELECT * FROM public.produtores WHERE LOWER(email) = $1 AND senha = $2', [email, senha]);
        
        if (result.rows.length === 0) {
            console.log(`📡 [DEPLOY LOG] Não achou em produtores, buscando em usuários...`);
            result = await db.query('SELECT * FROM public.usuarios WHERE LOWER(email) = $1 AND senha = $2', [email, senha]);
        }
        
        if (result.rows.length === 0) {
            console.log(`❌ [DEPLOY LOG] Credenciais incorretas para: ${email}`);
            return res.status(401).json({ message: "E-mail ou senha incorretos." });
        }

        const user = result.rows[0];
        console.log(`👤 [DEPLOY LOG] Usuário encontrado: ${user.email}`);

        if (user.status === 'Banido') {
            return res.status(403).json({ message: "Sua conta está suspensa." });
        }

        // --- GERAÇÃO DO TOKEN JWT ---
        const token = jwt.sign(
            { 
                id: user.id, 
                email: user.email, 
                role: user.role || 'user' 
            },
            JWT_SECRET,
            { expiresIn: '7d' } 
        );

        const perfilCompleto = !!(user.cpf_cnpj && user.cep && user.telefone);

        console.log(`✅ [DEPLOY LOG] Login OK. Token gerado para: ${user.email}`);

        return res.status(200).json({ 
            message: "Login realizado!", 
            token: token, 
            user: { 
                id: user.id || null, 
                nome: user.nome || 'Usuário', 
                email: user.email, 
                role: user.role || 'user',
                status: user.status || 'Ativo',
                perfil_completo: perfilCompleto 
            } 
        });

    } catch (err) { 
        console.error("❌ [DEPLOY LOG] ERRO CRÍTICO NO LOGIN:", err.stack);
        return res.status(500).json({ 
            message: "Erro interno no servidor de login",
            debug: err.message,
            stack: err.stack 
        }); 
    }
};

// --- 3. BUSCAR PERFIL (Privado/Logado) ---
exports.getPerfil = async (req, res) => {
    console.log("👤 [DEPLOY LOG] Buscando perfil...");
    try {
        const email = (req.query.email || '').trim().toLowerCase();
        let result = await db.query('SELECT * FROM public.produtores WHERE LOWER(email) = $1', [email]);
        if (result.rows.length === 0) {
            result = await db.query('SELECT * FROM public.usuarios WHERE LOWER(email) = $1', [email]);
        }
        if (result.rows.length === 0) return res.status(404).json({ message: "Não encontrado." });
        
        const { senha, ...dadosPublicos } = result.rows[0];
        return res.status(200).json(dadosPublicos);
    } catch (err) { 
        console.error("❌ [DEPLOY LOG] ERRO GET PERFIL:", err.message);
        return res.status(500).json({ message: "Erro ao buscar perfil", debug: err.message }); 
    }
};

// --- 4. ATUALIZAR PERFIL ---
exports.updatePerfil = async (req, res) => {
    console.log("🆙 [DEPLOY LOG] Atualizando perfil...");
    try {
        const { email_original, nome, cpf_cnpj, cep, rua, numero, bairro, estado, telefone, razao_social, bio, instagram, linkedin } = req.body;
        const emailLower = email_original.toLowerCase();

        let updateResult = await db.query(
            `UPDATE public.produtores SET nome=$1, cpf_cnpj=$2, cep=$3, rua=$4, numero=$5, bairro=$6, estado=$7, telefone=$8, razao_social=$9, bio=$10, instagram=$11, linkedin=$12 WHERE LOWER(email)=$13`,
            [nome, cpf_cnpj, cep, rua, numero, bairro, estado, telefone, razao_social, bio, instagram, linkedin, emailLower]
        );

        if (updateResult.rowCount === 0) {
            await db.query(
                `UPDATE public.usuarios SET nome=$1, telefone=$2, bio=$3, instagram=$4, linkedin=$5 WHERE LOWER(email)=$6`,
                [nome, telefone, bio, instagram, linkedin, emailLower]
            );
        }

        console.log(`✅ [DEPLOY LOG] Perfil atualizado para: ${emailLower}`);
        return res.status(200).json({ message: "Perfil atualizado com sucesso!" });
    } catch (err) { 
        console.error("❌ [DEPLOY LOG] ERRO UPDATE:", err.message);
        return res.status(500).json({ message: "Erro ao atualizar perfil", debug: err.message }); 
    }
};

// --- 5. BUSCAR PERFIL PÚBLICO (PARA O CHAT) ---
// Esta é a função que o Modal de Perfil chama!
exports.getPerfilPublico = async (req, res) => {
    console.log("🔍 [DEPLOY LOG] Buscando perfil público para o chat...");
    try {
        const { nome } = req.query;

        if (!nome) {
            return res.status(400).json({ message: "Nome do usuário é obrigatório." });
        }

        // Busca dados limitados (segurança) em ambas as tabelas pelo nome
        let result = await db.query(
            'SELECT nome, bio, instagram, linkedin, role, status FROM public.produtores WHERE nome = $1', 
            [nome]
        );

        if (result.rows.length === 0) {
            result = await db.query(
                'SELECT nome, bio, instagram, linkedin, role, status FROM public.usuarios WHERE nome = $1', 
                [nome]
            );
        }

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Usuário não encontrado." });
        }

        console.log(`✅ [DEPLOY LOG] Perfil público de ${nome} encontrado.`);
        return res.status(200).json(result.rows[0]);

    } catch (err) {
        console.error("❌ [DEPLOY LOG] ERRO GET PERFIL PUBLICO:", err.message);
        return res.status(500).json({ message: "Erro ao buscar dados públicos", debug: err.message });
    }
};