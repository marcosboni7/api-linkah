const db = require('../config/database');
const transporter = require('../config/mailer');
const crypto = require('crypto');

/**
 * 🛠️ AUTO-REPARO DO BANCO DE DADOS
 * Este bloco verifica e cria todas as colunas necessárias na tabela 'produtores'.
 * Isso evita os erros de "coluna não existe" no Render.
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
      const [nomeColuna] = col.split(' ');
      await db.query(`ALTER TABLE public.produtores ADD COLUMN IF NOT EXISTS ${col}`);
    }
    
    console.log("✅ Estrutura completa pronta para uso!");
  } catch (err) {
    console.error("⚠️ Erro ao sincronizar colunas:", err.message);
  }
};

// Executa a sincronização ao iniciar o arquivo
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

    // Gera uma senha aleatória de 8 caracteres
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
    console.log(`✅ Usuário ${email} salvo com sucesso!`);

    // Tentativa de envio de e-mail (com try/catch isolado para não travar o registro)
    try {
      await transporter.sendMail({
        from: `"Linkah" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: '🚀 Sua Senha Linkah',
        html: `
          <div style="font-family: sans-serif; color: #333;">
            <h2>Olá, ${nome}!</h2>
            <p>Seu cadastro na Linkah foi realizado com sucesso.</p>
            <p>Sua senha de acesso temporária é: <strong style="color: #C22973; font-size: 20px;">${senhaGerada}</strong></p>
            <p>Recomendamos alterar sua senha após o primeiro login.</p>
          </div>
        `
      });
      console.log("📧 E-mail de boas-vindas enviado!");
    } catch (mailErr) {
      console.error("❌ ERRO NO MOTOR DE EMAIL (Ignorado):", mailErr.message);
      // O processo continua mesmo que o e-mail falhe
    }

    return res.status(201).json({ 
      message: "Sucesso!", 
      temp_senha: senhaGerada // Retornamos a senha para garantir o acesso caso o e-mail falhe
    });

  } catch (err) {
    console.error("❌ Erro no registro:", err);
    return res.status(500).json({ message: "Erro ao realizar cadastro no banco de dados." });
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

    // Comparação de senha (removendo espaços extras)
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

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Perfil não encontrado" });
    }

    return res.status(200).json({ user: result.rows[0] });
  } catch (err) {
    console.error("Erro ao buscar perfil:", err);
    return res.status(500).json({ message: "Erro ao buscar dados do perfil." });
  }
};

// --- ATUALIZAR PERFIL (PUT) ---
exports.updatePerfil = async (req, res) => {
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
    return res.status(200).json({ message: "Dados atualizados com sucesso!" });
  } catch (err) {
    console.error("Erro ao atualizar perfil:", err);
    return res.status(500).json({ message: "Erro ao atualizar dados." });
  }
};