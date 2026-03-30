const db = require('../config/database');
const { sendMail } = require('../config/mailer');

// --- 1. CADASTRO DE PRODUTOR ---
exports.registerProdutor = async (req, res) => {
    try {
        const nome = (req.body.nome || '').trim();
        const email = (req.body.email || '').trim().toLowerCase();
        const senha = req.body.senha;

        if (!nome || !email || !senha) {
            return res.status(400).json({ message: "Nome, E-mail e Senha são obrigatórios." });
        }

        // Verifica se já existe em produtores ou usuários
        const checkUser = await db.query(
            'SELECT email FROM public.produtores WHERE LOWER(email) = $1 UNION SELECT email FROM public.usuarios WHERE LOWER(email) = $1', 
            [email]
        );
        
        if (checkUser.rows.length > 0) {
            return res.status(400).json({ message: "Este e-mail já está cadastrado." });
        }

        // INSERT com todos os campos que criamos no pgAdmin
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

        // 🛡️ PASSO 1: Salva no Banco primeiro
        await db.query(query, values);

        // 🛡️ PASSO 2: Tenta enviar e-mail (SEM AWAIT para não travar o registro)
        const htmlContent = `
            <div style="font-family: sans-serif; padding: 20px;">
                <h2>Olá ${nome}, bem-vindo à Linkah!</h2>
                <p>Sua conta de produtor foi criada com sucesso.</p>
                <p>Acesse o painel para cadastrar seus eventos.</p>
            </div>
        `;

        sendMail(email, 'Bem-vindo à Linkah!', htmlContent).catch(err => {
            // Se a API Key for inválida, o erro aparece no log, mas o usuário não percebe
            console.error("⚠️ Erro de E-mail (Resend):", err.message);
        });

        // 🛡️ PASSO 3: Resposta de sucesso imediata
        return res.status(201).json({ 
            message: "Cadastro realizado com sucesso!",
            user: { nome, email }
        });

    } catch (err) {
        console.error("❌ ERRO NO REGISTRO:", err.message);
        return res.status(500).json({ message: "Erro ao processar cadastro: " + err.message });
    }
};

// --- 2. LOGIN ---
exports.login = async (req, res) => {
    try {
        const email = (req.body.email || '').trim().toLowerCase();
        const senha = (req.body.senha || '').trim();

        if (!email || !senha) {
            return res.status(400).json({ message: "E-mail e senha são obrigatórios." });
        }

        // Busca em ambas as tabelas
        let result = await db.query('SELECT * FROM public.produtores WHERE LOWER(email) = $1 AND senha = $2', [email, senha]);
        
        if (result.rows.length === 0) {
            result = await db.query('SELECT * FROM public.usuarios WHERE LOWER(email) = $1 AND senha = $2', [email, senha]);
        }
        
        if (result.rows.length === 0) {
            return res.status(401).json({ message: "E-mail ou senha incorretos." });
        }

        const user = result.rows[0];

        // Verificação de Status
        if (user.status === 'Banido') {
            return res.status(403).json({ message: "Sua conta está permanentemente suspensa." });
        }

        const perfilCompleto = !!(user.cpf_cnpj && user.cep);

        return res.status(200).json({ 
            message: "Login realizado!", 
            user: { 
                nome: user.nome, 
                email: user.email, 
                role: user.role,
                status: user.status,
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
        
        return res.status(200).json(result.rows[0]);
    } catch (err) { 
        return res.status(500).json({ message: "Erro ao buscar perfil" }); 
    }
};

// --- 4. ATUALIZAR PERFIL ---
exports.updatePerfil = async (req, res) => {
    try {
        const { email_original, nome, cpf_cnpj, cep, rua, numero, bairro, estado, telefone, razao_social } = req.body;
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