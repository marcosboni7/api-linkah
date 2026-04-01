const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { sendMail } = require('../config/mailer');

// --- CONFIGURAÇÃO DO JWT ---
const JWT_SECRET = process.env.JWT_SECRET || 'linkah_secret_fallback_2026';

// --- 1. CADASTRO DE PRODUTOR ---
exports.registerProdutor = async (req, res) => {
    console.log("📝 [DEBUG] Cadastro: Iniciando registro...");
    try {
        const nome = (req.body.nome || '').trim();
        const email = (req.body.email || '').trim().toLowerCase();
        const senha = String(req.body.senha || '');

        const checkUser = await db.query(
            'SELECT email FROM public.produtores WHERE LOWER(email) = $1 UNION SELECT email FROM public.usuarios WHERE LOWER(email) = $1', 
            [email]
        );
        
        if (checkUser.rows.length > 0) {
            return res.status(400).json({ message: "Este e-mail já está cadastrado." });
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

        sendMail(email, 'Bem-vindo à Linkah!', `<h2>Olá ${nome}!</h2>`).catch(err => console.error("⚠️ Mailer Error:", err.message));

        return res.status(201).json({ message: "Cadastro realizado!", user: newUser });
    } catch (err) {
        console.error("❌ [DEBUG] Erro Registro:", err.stack);
        return res.status(500).json({ message: "Erro no cadastro", error: err.message });
    }
};

// --- 2. LOGIN ---
exports.login = async (req, res) => {
    try {
        const email = (req.body.email || '').trim().toLowerCase();
        const senha = String(req.body.senha || '').trim();

        let result = await db.query('SELECT * FROM public.produtores WHERE LOWER(email) = $1 AND senha = $2', [email, senha]);
        if (result.rows.length === 0) {
            result = await db.query('SELECT * FROM public.usuarios WHERE LOWER(email) = $1 AND senha = $2', [email, senha]);
        }
        
        if (result.rows.length === 0) return res.status(401).json({ message: "Credenciais inválidas." });

        const user = result.rows[0];
        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

        return res.status(200).json({ token, user });
    } catch (err) { 
        return res.status(500).json({ message: "Erro login" }); 
    }
};

// --- 3. BUSCAR PERFIL ---
exports.getPerfil = async (req, res) => {
    try {
        const email = (req.query.email || '').trim().toLowerCase();
        let result = await db.query('SELECT * FROM public.produtores WHERE LOWER(email) = $1', [email]);
        if (result.rows.length === 0) result = await db.query('SELECT * FROM public.usuarios WHERE LOWER(email) = $1', [email]);
        
        if (result.rows.length === 0) return res.status(404).json({ message: "Não encontrado" });
        const { senha, ...dados } = result.rows[0];
        return res.status(200).json(dados);
    } catch (err) { return res.status(500).json({ message: "Erro perfil" }); }
};

// --- 4. ATUALIZAR PERFIL (DEBUG ATIVADO) ---
exports.updatePerfil = async (req, res) => {
    console.log("--------------------------------------------------");
    console.log("🆙 [DEBUG] UPDATE PERFIL - DADOS RECEBIDOS:");
    console.log("Body:", JSON.stringify(req.body, null, 2));
    
    try {
        const { 
            email_original, nome, cpf_cnpj, cep, rua, numero, 
            bairro, estado, telefone, razao_social, 
            bio, instagram, linkedin 
        } = req.body;
        
        if (!email_original) {
            console.log("❌ [DEBUG] Erro: email_original não enviado pelo Front-end.");
            return res.status(400).json({ message: "E-mail original é obrigatório." });
        }

        const emailLower = email_original.toLowerCase();

        // LOG DO SQL QUE SERÁ EXECUTADO
        console.log(`🔎 [DEBUG] Tentando atualizar Produtor: ${emailLower}`);
        console.log(`📝 [DEBUG] Novos valores: Bio: ${bio}, Insta: ${instagram}, Link: ${linkedin}`);

        let updateResult = await db.query(
            `UPDATE public.produtores SET 
                nome=$1, cpf_cnpj=$2, cep=$3, rua=$4, numero=$5, bairro=$6, 
                estado=$7, telefone=$8, razao_social=$9, bio=$10, instagram=$11, linkedin=$12 
             WHERE LOWER(email)=$13 RETURNING id`,
            [nome, cpf_cnpj, cep, rua, numero, bairro, estado, telefone, razao_social, bio, instagram, linkedin, emailLower]
        );

        console.log(`📊 [DEBUG] Linhas afetadas em Produtores: ${updateResult.rowCount}`);

        if (updateResult.rowCount === 0) {
            console.log(`🔎 [DEBUG] Não era produtor. Tentando atualizar em Usuarios...`);
            const updateUsr = await db.query(
                `UPDATE public.usuarios SET 
                    nome=$1, telefone=$2, bio=$3, instagram=$4, linkedin=$5 
                 WHERE LOWER(email)=$6 RETURNING id`,
                [nome, telefone, bio, instagram, linkedin, emailLower]
            );
            console.log(`📊 [DEBUG] Linhas afetadas em Usuarios: ${updateUsr.rowCount}`);
        }

        console.log("✅ [DEBUG] Processo de atualização finalizado.");
        console.log("--------------------------------------------------");
        return res.status(200).json({ message: "Perfil atualizado com sucesso!" });

    } catch (err) { 
        console.error("❌ [DEBUG] ERRO NO UPDATE SQL:");
        console.error("Mensagem:", err.message);
        console.error("Stack:", err.stack);
        return res.status(500).json({ message: "Erro ao atualizar", error: err.message }); 
    }
};

// --- 5. PERFIL PÚBLICO ---
exports.getPerfilPublico = async (req, res) => {
    try {
        const { nome } = req.query;
        let result = await db.query('SELECT nome, bio, instagram, linkedin, role FROM public.produtores WHERE nome = $1', [nome]);
        if (result.rows.length === 0) result = await db.query('SELECT nome, bio, instagram, linkedin, role FROM public.usuarios WHERE nome = $1', [nome]);
        
        if (result.rows.length === 0) return res.status(404).json({ message: "Usuário não encontrado" });
        return res.status(200).json(result.rows[0]);
    } catch (err) { return res.status(500).json({ message: "Erro public profile" }); }
};