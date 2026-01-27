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

        // 1. Verifica se já existe
        const checkUser = await db.query('SELECT * FROM public.produtores WHERE LOWER(email) = $1', [email]);
        if (checkUser.rows.length > 0) {
            return res.status(400).json({ message: "Este e-mail já está cadastrado." });
        }

        // 2. SALVA NO BANCO (A prioridade é essa!)
        const query = `
            INSERT INTO public.produtores (
                nome, email, senha, cpf_cnpj, telefone, tipo, 
                data_nascimento, cep, rua, numero, bairro, estado,
                razao_social
            ) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) 
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
            req.body.razao_social || null
        ];

        await db.query(query, values);

        // 3. ENVIA O E-MAIL (Sem o 'await' para não travar se o Gmail demorar)
        const htmlContent = `<h2>Olá ${nome}, bem-vindo à LINKAH!</h2><p>Sua conta foi criada com sucesso.</p>`;
        
        sendMail(email, 'Bem-vindo à Linkah!', htmlContent).catch(err => {
            console.error("📧 Erro ao enviar e-mail de boas-vindas (mas o user foi criado):", err.message);
        });

        // 4. RESPONDE AO FRONT-END (Rápido!)
        return res.status(201).json({ 
            message: "Cadastro realizado com sucesso!",
            user: { nome, email }
        });

    } catch (err) {
        console.error("❌ ERRO NO REGISTRO:", err.message);
        return res.status(500).json({ message: "Erro ao processar cadastro no banco." });
    }
};

// ... (mantenha as outras funções login, getPerfil, updatePerfil iguais)

exports.login = async (req, res) => {
    try {
        const email = (req.body.email || '').trim().toLowerCase();
        const senha = (req.body.senha || '').trim();
        const result = await db.query('SELECT * FROM public.produtores WHERE LOWER(email) = $1 AND senha = $2', [email, senha]);
        if (result.rows.length === 0) return res.status(401).json({ message: "E-mail ou senha incorretos." });
        const user = result.rows[0];
        return res.status(200).json({ message: "Login realizado!", user: { id: user.id, nome: user.nome, email: user.email } });
    } catch (err) { return res.status(500).json({ message: "Erro no login" }); }
};

exports.getPerfil = async (req, res) => {
    try {
        const email = (req.query.email || '').trim().toLowerCase();
        const result = await db.query('SELECT * FROM public.produtores WHERE LOWER(email) = $1', [email]);
        if (result.rows.length === 0) return res.status(404).json({ message: "Usuário não encontrado." });
        return res.status(200).json(result.rows[0]);
    } catch (err) { return res.status(500).json({ message: "Erro ao buscar perfil" }); }
};

exports.updatePerfil = async (req, res) => {
    try {
        const { email_original, nome, cpf_cnpj, cep, rua, numero, bairro, estado } = req.body;
        const query = `UPDATE public.produtores SET nome=$1, cpf_cnpj=$2, cep=$3, rua=$4, numero=$5, bairro=$6, estado=$7 WHERE LOWER(email)=$8`;
        await db.query(query, [nome, cpf_cnpj, cep, rua, numero, bairro, estado, email_original.toLowerCase()]);
        return res.status(200).json({ message: "Perfil atualizado!" });
    } catch (err) { return res.status(500).json({ message: "Erro ao atualizar perfil" }); }
};