const db = require('../config/database');
const transporter = require('../config/mailer');
const crypto = require('crypto');

// --- REGISTRO ---
exports.registerProdutor = async (req, res) => {
  try {
    const { 
      email, nome, cpf_cnpj, tipo, telefone, data_nascimento, 
      cep, rua, numero, bairro, estado, instagram, facebook, 
      descricao, razao_social 
    } = req.body;

    const senhaGerada = crypto.randomBytes(4).toString('hex');

    const query = `
      INSERT INTO public.produtores (
        email, nome, cpf_cnpj, senha, tipo, telefone, data_nascimento, 
        cep, rua, numero, bairro, estado, instagram, facebook, 
        descricao, razao_social
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    `;
    
    const values = [
      email, nome, cpf_cnpj, senhaGerada, tipo, telefone, data_nascimento, 
      cep, rua, numero, bairro, estado, instagram, facebook, 
      descricao, razao_social
    ];
    
    await db.query(query, values);

    // Envio de E-mail
    await transporter.sendMail({
      from: `"Linkah" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🚀 Sua Senha Linkah',
      html: `<h2>Olá, ${nome}!</h2><p>Sua senha de acesso é: <b>${senhaGerada}</b></p>`
    });

    return res.status(201).json({ message: "Sucesso!" });
  } catch (err) {
    console.error("Erro no registro:", err);
    return res.status(500).json({ message: "Erro no cadastro" });
  }
};

// --- LOGIN ---
exports.login = async (req, res) => {
  console.log("--- 🔐 Tentativa de login ---");
  try {
    const { email, senha } = req.body;

    const query = 'SELECT * FROM public.produtores WHERE email = $1';
    const result = await db.query(query, [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Usuário não encontrado" });
    }

    const usuario = result.rows[0];

    // Comparação simples de senha
    if (String(usuario.senha).trim() !== String(senha).trim()) {
      return res.status(401).json({ message: "Senha incorreta" });
    }

    console.log(`✅ Login autorizado: ${usuario.nome}`);
    return res.status(200).json({ 
      message: "Sucesso",
      user: { 
        nome: usuario.nome, 
        email: usuario.email 
      } 
    });
  } catch (err) {
    console.error("Erro interno no login:", err);
    return res.status(500).json({ message: "Erro interno" });
  }
};

// --- BUSCAR PERFIL (GET) ---
exports.getPerfil = async (req, res) => {
  const { email } = req.query; // Pega o email da query string
  console.log(`--- 🔍 Buscando perfil: ${email} ---`);
  
  try {
    const query = `
      SELECT nome, email, cpf_cnpj, telefone, cep, rua, numero, bairro, estado, 
             instagram, facebook, descricao, razao_social
      FROM public.produtores 
      WHERE email = $1
    `;
    const result = await db.query(query, [email]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Perfil não encontrado" });
    }

    return res.status(200).json({ user: result.rows[0] });
  } catch (err) {
    console.error("Erro ao buscar perfil:", err);
    return res.status(500).json({ message: "Erro no servidor ao buscar dados" });
  }
};

// --- ATUALIZAR PERFIL (PUT) ---
exports.updatePerfil = async (req, res) => {
  console.log("--- 📝 Atualizando perfil ---");
  try {
    const { 
      email, nome, cpf_cnpj, telefone, cep, rua, numero, bairro, 
      instagram, facebook, descricao 
    } = req.body;

    const query = `
      UPDATE public.produtores 
      SET nome = $1, cpf_cnpj = $2, telefone = $3, cep = $4, rua = $5, 
          numero = $6, bairro = $7, instagram = $8, facebook = $9, descricao = $10
      WHERE email = $11
    `;
    const values = [
      nome, cpf_cnpj, telefone, cep, rua, numero, 
      bairro, instagram, facebook, descricao, email
    ];

    await db.query(query, values);
    
    console.log(`✅ Perfil atualizado com sucesso: ${email}`);
    return res.status(200).json({ message: "Dados atualizados com sucesso!" });
  } catch (err) {
    console.error("Erro ao atualizar perfil:", err);
    return res.status(500).json({ message: "Erro ao atualizar dados" });
  }
};