const db = require('../config/database');
const sendMail = require('../config/mailer');

// --- 1. CADASTRO DE PRODUTOR ---
exports.registerProdutor = async (req, res) => {
    try {
        console.log("📦 NOVO CADASTRO RECEBIDO:", req.body);

        const nome = (req.body.nome || '').trim();
        const email = (req.body.email || '').trim().toLowerCase();
        const senha = req.body.senha; // Recebe a senha vinda do front-end

        if (!nome || !email || !senha) {
            return res.status(400).json({ message: "Nome, E-mail e Senha são obrigatórios." });
        }

        // Verifica duplicidade
        const checkUser = await db.query('SELECT * FROM public.produtores WHERE LOWER(email) = $1', [email]);
        if (checkUser.rows.length > 0) {
            return res.status(400).json({ message: "Este e-mail já está cadastrado." });
        }

        // Salva no Banco com a senha escolhida pelo usuário
        const query = `
            INSERT INTO public.produtores (
                nome, email, senha, cpf_cnpj, telefone, tipo, 
                data_nascimento, cep, rua, numero, bairro, estado,
                instagram, facebook, descricao, razao_social
            ) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) 
            RETURNING id, nome, email;
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
            req.body.instagram || null,
            req.body.facebook || null,
            req.body.descricao || null,
            req.body.razao_social || null
        ];

        await db.query(query, values);

        // e-mail de Boas-vindas SEM SENHA
        const htmlContent = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 25px; border-radius: 12px;">
                <h2 style="color: #C22973; text-align: center;">Bem-vindo(a) à LINKAH!</h2>
                <p>Olá <strong>${nome}</strong>,</p>
                <p>Sua conta profissional foi criada com sucesso! Agora você já pode acessar a plataforma com seu e-mail e a senha que você escolheu.</p>
                <div style="text-align: center; margin-top: 30px;">
                    <a href="https://linkah.vercel.app" style="background: #C22973; color: white; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: bold;">ACESSAR MEU PAINEL</a>
                </div>
            </div>
        `;

        await sendMail(email, 'Bem-vindo à Linkah!', htmlContent);

        return res.status(201).json({ message: "Cadastro realizado com sucesso!" });

    } catch (err) {
        console.error("❌ ERRO NO REGISTRO:", err.message);
        return res.status(500).json({ message: "Erro ao processar cadastro" });
    }
};

// --- 2. LOGIN ---
exports.login = async (req, res) => {
    try {
        const email = (req.body.email || '').trim().toLowerCase();
        const senha = (req.body.senha || '').trim();

        const query = 'SELECT * FROM public.produtores WHERE LOWER(email) = $1 AND senha = $2';
        const result = await db.query(query, [email, senha]);

        if (result.rows.length === 0) {
            return res.status(401).json({ message: "E-mail ou senha incorretos." });
        }

        const user = result.rows[0];
        return res.status(200).json({
            message: "Login realizado!",
            user: { id: user.id, nome: user.nome, email: user.email }
        });
    } catch (err) {
        return res.status(500).json({ message: "Erro no login" });
    }
};

// --- 3. BUSCAR PERFIL ---
exports.getPerfil = async (req, res) => {
    try {
        const email = (req.query.email || '').trim().toLowerCase();
        if (!email) return res.status(400).json({ message: "E-mail não fornecido." });

        const result = await db.query('SELECT * FROM public.produtores WHERE LOWER(email) = $1', [email]);
        if (result.rows.length === 0) return res.status(404).json({ message: "Usuário não encontrado." });

        return res.status(200).json(result.rows[0]);
    } catch (err) {
        return res.status(500).json({ message: "Erro ao buscar perfil" });
    }
};

// --- 4. ATUALIZAR PERFIL ---
exports.updatePerfil = async (req, res) => {
    try {
        const { email_original, nome, cpf_cnpj, cep, rua, numero, bairro, estado } = req.body;
        const query = `UPDATE public.produtores SET nome=$1, cpf_cnpj=$2, cep=$3, rua=$4, numero=$5, bairro=$6, estado=$7 WHERE LOWER(email)=$8`;
        await db.query(query, [nome, cpf_cnpj, cep, rua, numero, bairro, estado, email_original.toLowerCase()]);
        return res.status(200).json({ message: "Perfil atualizado!" });
    } catch (err) {
        return res.status(500).json({ message: "Erro ao atualizar" });
    }
};