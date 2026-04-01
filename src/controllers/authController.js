const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { sendMail } = require('../config/mailer');

const JWT_SECRET = process.env.JWT_SECRET || 'linkah_secret_fallback_2026';

// --- 1. CADASTRO DE PRODUTOR ---
exports.registerProdutor = async (req, res) => {
    console.log("📝 [DEPLOY LOG] Iniciando registro de produtor...");
    try {
        const nome = (req.body.nome || '').trim();
        const email = (req.body.email || '').trim().toLowerCase();
        const senha = String(req.body.senha || '');

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

        const resultInsert = await db.query(query, values);
        const newUser = resultInsert.rows[0];

        sendMail(email, 'Bem-vindo à Linkah!', `<h2>Olá ${nome}!</h2><p>Sua conta foi criada.</p>`).catch(err => {
            console.error("⚠️ [MAIL ERROR]:", err.message);
        });

        return res.status(201).json({ message: "Cadastro realizado!", user: newUser });
    } catch (err) {
        console.error("❌ [ERROR REGISTRO]:", err.stack);
        return res.status(500).json({ message: "Erro ao cadastrar", error: err.message });
    }
};

// --- 2. LOGIN ---
exports.login = async (req, res) => {
    console.log("🔑 [DEPLOY LOG] Tentativa de Login");
    try {
        const email = (req.body.email || '').trim().toLowerCase();
        const senha = String(req.body.senha || '').trim();

        if (!email || !senha) return res.status(400).json({ message: "Dados incompletos." });

        let result = await db.query('SELECT * FROM public.produtores WHERE LOWER(email) = $1 AND senha = $2', [email, senha]);
        if (result.rows.length === 0) {
            result = await db.query('SELECT * FROM public.usuarios WHERE LOWER(email) = $1 AND senha = $2', [email, senha]);
        }
        
        if (result.rows.length === 0) return res.status(401).json({ message: "Credenciais incorretas." });

        const user = result.rows[0];
        const token = jwt.sign({ id: user.id, email: user.email, role: user.role || 'user' }, JWT_SECRET, { expiresIn: '7d' });

        return res.status(200).json({ 
            token, 
            user: { id: user.id, nome: user.nome, email: user.email, role: user.role || 'user' } 
        });
    } catch (err) {
        return res.status(500).json({ message: "Erro no servidor" });
    }
};

// --- 3. BUSCAR PERFIL (LOGADO) ---
exports.getPerfil = async (req, res) => {
    console.log("👤 [DEPLOY LOG] Buscando perfil...");
    try {
        const email = (req.query.email || '').trim().toLowerCase();
        let result = await db.query('SELECT * FROM public.produtores WHERE LOWER(email) = $1', [email]);
        if (result.rows.length === 0) {
            result = await db.query('SELECT * FROM public.usuarios WHERE LOWER(email) = $1', [email]);
        }
        
        if (result.rows.length === 0) return res.status(404).json({ message: "Perfil não encontrado." });
        
        const { senha, ...dados } = result.rows[0];
        return res.status(200).json(dados);
    } catch (err) {
        return res.status(500).json({ message: "Erro ao buscar perfil" });
    }
};

// --- 4. ATUALIZAR PERFIL (SEM REMOVER NADA) ---
exports.updatePerfil = async (req, res) => {
    console.log("🆙 [DEPLOY LOG] Iniciando Update...");
    try {
        const { 
            email_original, nome, cpf_cnpj, cep, rua, numero, 
            bairro, estado, telefone, razao_social, 
            bio, instagram, linkedin 
        } = req.body;
        
        const emailLower = email_original ? email_original.toLowerCase() : null;

        if (!emailLower) {
            console.log("❌ [DEBUG] Falha: email_original vazio.");
            return res.status(400).json({ message: "Email original não fornecido." });
        }

        console.log(`🔎 [DEBUG] Atualizando: ${emailLower} | Bio: ${bio ? 'Sim' : 'Não'}`);

        // Tentativa 1: Produtores
        let updateResult = await db.query(
            `UPDATE public.produtores SET 
                nome=$1, cpf_cnpj=$2, cep=$3, rua=$4, numero=$5, bairro=$6, 
                estado=$7, telefone=$8, razao_social=$9, bio=$10, instagram=$11, linkedin=$12 
             WHERE LOWER(email)=$13 RETURNING id`,
            [nome, cpf_cnpj, cep, rua, numero, bairro, estado, telefone, razao_social, bio, instagram, linkedin, emailLower]
        );

        // Tentativa 2: Usuarios (se a 1 falhar)
        if (updateResult.rowCount === 0) {
            console.log("🔎 [DEBUG] Não encontrado em produtores, tentando usuários...");
            updateResult = await db.query(
                `UPDATE public.usuarios SET 
                    nome=$1, telefone=$2, bio=$3, instagram=$4, linkedin=$5 
                 WHERE LOWER(email)=$6 RETURNING id`,
                [nome, telefone, bio, instagram, linkedin, emailLower]
            );
        }

        if (updateResult.rowCount === 0) {
            console.log("⚠️ [DEBUG] Nenhuma linha atualizada.");
            return res.status(404).json({ message: "Usuário não encontrado para atualizar." });
        }

        console.log(`✅ [DEPLOY LOG] Perfil atualizado para: ${emailLower}`);
        return res.status(200).json({ message: "Perfil atualizado com sucesso!" });
    } catch (err) { 
        console.error("❌ [ERROR UPDATE]:", err.message);
        return res.status(500).json({ message: "Erro interno ao atualizar", error: err.message }); 
    }
};

// --- 5. BUSCAR PERFIL PÚBLICO (PARA O CHAT) ---
exports.getPerfilPublico = async (req, res) => {
    try {
        const { nome } = req.query;
        if (!nome) return res.status(400).json({ message: "Nome é obrigatório." });

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

        if (result.rows.length === 0) return res.status(404).json({ message: "Usuário não encontrado." });

        return res.status(200).json(result.rows[0]);
    } catch (err) {
        return res.status(500).json({ message: "Erro ao buscar dados públicos" });
    }
};