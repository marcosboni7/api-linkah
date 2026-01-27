const db = require('../config/database');
const crypto = require('crypto');
const transporter = require('../config/mailer'); // Importando o seu mailer pronto

// --- 1. CADASTRO DE PRODUTOR ---
exports.registerProdutor = async (req, res) => {
    try {
        console.log("📦 CORPO DA REQUISICAO:", req.body);

        const nome = req.body.nome || req.body.name;
        const email = req.body.email || req.body['E-mail'];

        if (!nome || !email) {
            return res.status(400).json({ message: "Nome e E-mail sao obrigatorios." });
        }

        // 🔑 Geração da senha automática
        const senhaGerada = crypto.randomBytes(4).toString('hex'); 

        // Verifica duplicidade
        const checkUser = await db.query('SELECT * FROM public.produtores WHERE email = $1', [email]);
        if (checkUser.rows.length > 0) {
            return res.status(400).json({ message: "Este e-mail ja esta cadastrado." });
        }

        // 💾 Salva no Banco com todos os campos do seu formulário
        const query = `
            INSERT INTO public.produtores (
                nome, email, senha, cpf_cnpj, telefone, tipo, 
                data_nascimento, cep, rua, numero, bairro, estado
            ) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
            RETURNING id, nome, email;
        `;
        
        const values = [
            nome, email, senhaGerada, 
            req.body.cpf_cnpj || null, 
            req.body.telefone || null, 
            req.body.tipo || 'PF',
            req.body.data_nascimento || null,
            req.body.cep || null,
            req.body.rua || null,
            req.body.numero || null,
            req.body.bairro || null,
            req.body.estado || null
        ];

        const result = await db.query(query, values);

        // 📧 ENVIO DO E-MAIL USANDO SEU TRANSPORTER
        const mailOptions = {
            from: `"Linkah Sistema" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Sua senha de acesso - Linkah',
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; border-radius: 10px;">
                    <h2 style="color: #007bff; text-align: center;">Bem-vindo ao Linkah!</h2>
                    <p>Olá <strong>${nome}</strong>,</p>
                    <p>Seu cadastro foi realizado com sucesso. Aqui estão seus dados de acesso:</p>
                    <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; border: 1px dashed #ccc;">
                        <p style="margin: 5px 0;"><strong>E-mail:</strong> ${email}</p>
                        <p style="margin: 5px 0;"><strong>Senha Provisória:</strong> <span style="color: #d9534f; font-weight: bold; font-size: 1.2em;">${senhaGerada}</span></p>
                    </div>
                    <p style="font-size: 0.9em; color: #666; margin-top: 20px;">
                        Use esta senha para seu primeiro login. Você poderá alterá-la a qualquer momento no seu perfil.
                    </p>
                </div>
            `
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error("❌ ERRO AO ENVIAR E-MAIL:", error.message);
            } else {
                console.log("📧 E-mail enviado para: " + email);
            }
        });

        return res.status(201).json({ 
            message: "Cadastro realizado com sucesso! Verifique seu e-mail.", 
            user: result.rows[0] 
        });

    } catch (err) {
        console.error("❌ ERRO NO REGISTRO:", err.message);
        return res.status(500).json({ message: "Erro ao processar cadastro" });
    }
};

// --- 2. LOGIN ---
exports.login = async (req, res) => {
    try {
        const email = req.body.email || req.body.userEmail;
        const senha = req.body.senha || req.body.password;

        if (!email || !senha) {
            return res.status(400).json({ message: "E-mail e senha sao obrigatorios." });
        }

        const query = 'SELECT * FROM public.produtores WHERE email = $1 AND senha = $2';
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
        const { email } = req.query; 
        const result = await db.query('SELECT * FROM public.produtores WHERE email = $1', [email]);
        return res.status(200).json(result.rows[0] || {});
    } catch (err) {
        return res.status(500).json({ message: "Erro ao buscar perfil" });
    }
};

// --- 4. ATUALIZAR PERFIL ---
exports.updatePerfil = async (req, res) => {
    try {
        const { email_original, nome, email_novo, foto_perfil } = req.body;
        await db.query(
            'UPDATE public.produtores SET nome=$1, email=$2, foto_perfil=$3 WHERE email=$4', 
            [nome, email_novo, foto_perfil, email_original]
        );
        return res.status(200).json({ message: "Perfil atualizado!" });
    } catch (err) {
        return res.status(500).json({ message: "Erro ao atualizar perfil" });
    }
};