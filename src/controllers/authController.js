const db = require('../config/database');
const transporter = require('../config/mailer');
const crypto = require('crypto');

/**
 * 🛠️ AUTO-REPARO DO BANCO DE DADOS
 * Garante que todas as colunas existam para evitar erros de "column does not exist".
 */
const sincronizarBanco = async () => {
  try {
    const colunas = [
      'cpf_cnpj VARCHAR(20)',
      'tipo VARCHAR(50)',
      'telefone VARCHAR(20)',
      'data_nascimento VARCHAR(20)',
      'cep VARCHAR(10)',
      'rua VARCHAR(255)',
      'numero VARCHAR(20)',
      'bairro VARCHAR(100)',
      'estado VARCHAR(50)',
      'instagram VARCHAR(100)',
      'facebook VARCHAR(100)',
      'descricao TEXT',
      'razao_social VARCHAR(255)',
      'senha VARCHAR(255)'
    ];

    for (const col of colunas) {
      await db.query(`ALTER TABLE public.produtores ADD COLUMN IF NOT EXISTS ${col}`);
    }
    console.log("✅ Estrutura completa pronta para uso!");
  } catch (err) {
    console.error("⚠️ Erro ao sincronizar colunas:", err.message);
  }
};

sincronizarBanco();

// --- REGISTRO ---
exports.registerProdutor = async (req, res) => {
  console.log("--- 📝 Iniciando registro de novo produtor ---");
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
    
    // 1. Salva no Banco (Obrigatório e prioritário)
    await db.query(query, values);
    console.log(`✅ Usuário ${email} salvo com sucesso!`);

    // 2. Envio de e-mail (SEM 'AWAIT' PARA NÃO TRAVAR A TELA)
    transporter.sendMail({
      from: `"Linkah" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🚀 Sua Senha Linkah',
      html: `
        <div style="font-family: sans-serif;">
          <h2>Olá, ${nome}!</h2>
          <p>Sua senha de acesso é: <strong style="color: #C22973;">${senhaGerada}</strong></p>
        </div>
      `
    }).then(() => {
      console.log("📧 E-mail enviado em segundo plano!");
    }).catch(mailErr => {
      console.error("❌ Falha no envio do e-mail (background):", mailErr.message);
    });

    // 3. Responde ao frontend IMEDIATAMENTE
    return res.status(201).json({ 
      message: "Sucesso!", 
      temp_senha: senhaGerada 
    });

  } catch (err) {
    console.error("❌ Erro no registro:", err);
    return res.status(500).json({ message: "Erro ao realizar cadastro no banco." });
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

    if (String(usuario.senha).trim() !== String(senha).trim()) {
      return res.status(401).json({ message: "Senha incorreta" });
    }

    return res.status(200).json({ 
      message: "Sucesso",
      user: { nome: usuario.nome, email: usuario.email } 
    });
  } catch (err) {
    console.error("Erro interno no login:", err);
    return res.status(500).json({ message: "Erro interno no servidor." });
  }
};

// --- BUSCAR PERFIL (GET) ---
exports.getPerfil = async (req, res) => {
  const { email } = req.query;
  try {
    const query = `
      SELECT nome, email, cpf_cnpj, tipo, telefone, data_nascimento, cep, rua, numero, 
             bairro, estado, instagram, facebook, descricao, razao_social
      FROM public.produtores 
      WHERE email = $1
    `;
    const result = await db.query(query, [email]);
    if (result.rows.length === 0) return res.status(404).json({ message: "Perfil não encontrado" });
    return res.status(200).json({ user: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ message: "Erro ao buscar perfil." });
  }
};

// --- ATUALIZAR PERFIL (PUT) ---
exports.updatePerfil = async (req, res) => {
  try {
    const { email, nome, cpf_cnpj, telefone, cep, rua, numero, bairro, instagram, facebook, descricao } = req.body;
    const query = `
      UPDATE public.produtores 
      SET nome = $1, cpf_cnpj = $2, telefone = $3, cep = $4, rua = $5, 
          numero = $6, bairro = $7, instagram = $8, facebook = $9, descricao = $10
      WHERE email = $11
    `;
    await db.query(query, [nome, cpf_cnpj, telefone, cep, rua, numero, bairro, instagram, facebook, descricao, email]);
    return res.status(200).json({ message: "Dados atualizados com sucesso!" });
  } catch (err) {
    return res.status(500).json({ message: "Erro ao atualizar dados." });
  }
};