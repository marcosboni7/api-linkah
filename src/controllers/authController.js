const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { sendMail } = require('../config/mailer');

const JWT_SECRET = process.env.JWT_SECRET || 'linkah_secret_fallback_2026';

function safeString(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function safeLowerEmail(value) {
  return safeString(value).toLowerCase();
}

function emptyToNull(value) {
  const str = safeString(value);
  return str === '' ? null : str;
}

function getErrorMessage(err) {
  if (!err) return 'Erro desconhecido';
  if (typeof err === 'string') return err;
  if (typeof err.message === 'string' && err.message.trim()) return err.message;

  try {
    const asString = err.toString?.();
    if (typeof asString === 'string' && asString.trim() && asString !== '[object Object]') {
      return asString;
    }
  } catch {}

  return 'Erro desconhecido';
}

// ------------------------------------------------------
// 🛠️ SINCRONIZAÇÃO AUTOMÁTICA DAS TABELAS (GARANTIA DO BANCO NOVO)
// ------------------------------------------------------
async function inicializarTabelasAutenticacao() {
  try {
    // Cria a tabela de produtores caso ela não exista no banco novo
    await db.query(`
      CREATE TABLE IF NOT EXISTS public.produtores (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        senha VARCHAR(255) NOT NULL,
        cpf_cnpj VARCHAR(50),
        telefone VARCHAR(50),
        tipo VARCHAR(10) DEFAULT 'PF',
        data_nascimento VARCHAR(50),
        cep VARCHAR(20),
        rua VARCHAR(255),
        numero VARCHAR(50),
        bairro VARCHAR(255),
        estado VARCHAR(10),
        razao_social VARCHAR(255),
        status VARCHAR(50) DEFAULT 'Ativo',
        role VARCHAR(50) DEFAULT 'produtor',
        avatar TEXT,
        bio TEXT,
        instagram VARCHAR(255),
        linkedin VARCHAR(255),
        stripe_account_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Cria a tabela de usuarios caso ela não exista no banco novo
    await db.query(`
      CREATE TABLE IF NOT EXISTS public.usuarios (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        senha VARCHAR(255) NOT NULL,
        telefone VARCHAR(50),
        status VARCHAR(50) DEFAULT 'Ativo',
        role VARCHAR(50) DEFAULT 'user',
        avatar TEXT,
        bio TEXT,
        instagram VARCHAR(255),
        linkedin VARCHAR(255),
        stripe_account_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ [BANCO] Tabelas public.produtores e public.usuarios prontas para uso!');
  } catch (err) {
    console.error('❌ [BANCO] Erro ao criar a estrutura de autenticação:', err);
  }
}

// Executa a verificação na inicialização do arquivo
inicializarTabelasAutenticacao();


// -----------------------------
// 1️⃣ REGISTRO DE PRODUTOR
// -----------------------------
exports.registerProdutor = async (req, res) => {
  console.log('📝 [REGISTRO] Iniciando cadastro...');

  try {
    const nome = safeString(req.body.nome);
    const email = safeLowerEmail(req.body.email);
    const senha = safeString(req.body.senha);

    const cpf_cnpj = emptyToNull(req.body.cpf_cnpj);
    const telefone = emptyToNull(req.body.telefone);
    const tipo = safeString(req.body.tipo || 'PF') || 'PF';
    const data_nascimento = emptyToNull(req.body.data_nascimento);
    const cep = emptyToNull(req.body.cep);
    const rua = emptyToNull(req.body.rua);
    const numero = emptyToNull(req.body.numero);
    const bairro = emptyToNull(req.body.bairro);
    const estado = emptyToNull(req.body.estado ? String(req.body.estado).toUpperCase() : null);
    const razao_social = emptyToNull(req.body.razao_social);

    if (!nome) {
      return res.status(400).json({
        message: 'Nome é obrigatório.'
      });
    }

    if (!email) {
      return res.status(400).json({
        message: 'E-mail é obrigatório.'
      });
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({
        message: 'E-mail inválido.'
      });
    }

    if (!senha) {
      return res.status(400).json({
        message: 'Senha é obrigatória.'
      });
    }

    if (senha.length < 6) {
      return res.status(400).json({
        message: 'A senha deve ter pelo menos 6 caracteres.'
      });
    }

    const checkUser = await db.query(
      `
      SELECT email FROM public.produtores WHERE LOWER(email) = $1
      UNION
      SELECT email FROM public.usuarios WHERE LOWER(email) = $1
      `,
      [email]
    );

    if (checkUser.rows.length > 0) {
      return res.status(400).json({
        message: 'Este e-mail já está cadastrado.'
      });
    }

    const result = await db.query(
      `
      INSERT INTO public.produtores (
        nome, email, senha, cpf_cnpj, telefone, tipo,
        data_nascimento, cep, rua, numero, bairro, estado,
        razao_social, status, role
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,
        $7,$8,$9,$10,$11,$12,
        $13,$14,$15
      )
      RETURNING id,nome,email
      `,
      [
        nome,
        email,
        senha,
        cpf_cnpj,
        telefone,
        tipo,
        data_nascimento,
        cep,
        rua,
        numero,
        bairro,
        estado,
        razao_social,
        'Ativo',
        'produtor'
      ]
    );

    const user = result.rows[0];

    try {
      await sendMail(
        email,
        'Bem-vindo à Linkah!',
        `<h2>Olá ${nome}</h2><p>Sua conta foi criada com sucesso.</p>`
      );
    } catch (mailErr) {
      console.log('MAIL ERROR:', getErrorMessage(mailErr));
    }

    return res.status(201).json({
      message: 'Cadastro realizado com sucesso!',
      user
    });

  } catch (err) {
    console.error('❌ ERRO REGISTRO:', err);
    return res.status(500).json({
      message: 'Erro ao cadastrar',
      error: getErrorMessage(err)
    });
  }
};

// -----------------------------
// 2️⃣ LOGIN
// -----------------------------
exports.login = async (req, res) => {
  console.log('🔑 [LOGIN] Tentativa...');

  try {
    const email = safeLowerEmail(req.body.email);
    const senha = safeString(req.body.senha);

    if (!email || !senha) {
      return res.status(400).json({
        message: 'Dados incompletos.'
      });
    }

    let result = await db.query(
      'SELECT * FROM public.produtores WHERE LOWER(email)=$1 AND senha=$2',
      [email, senha]
    );

    if (result.rows.length === 0) {
      result = await db.query(
        'SELECT * FROM public.usuarios WHERE LOWER(email)=$1 AND senha=$2',
        [email, senha]
      );
    }

    if (result.rows.length === 0) {
      return res.status(401).json({
        message: 'Credenciais incorretas.'
      });
    }

    const user = result.rows[0];

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role || 'user'
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    delete user.senha;

    return res.status(200).json({
      token,
      user
    });

  } catch (err) {
    console.error('❌ ERRO LOGIN:', err);
    return res.status(500).json({
      message: 'Erro no servidor',
      error: getErrorMessage(err)
    });
  }
};

// -----------------------------
// 3️⃣ BUSCAR PERFIL
// -----------------------------
exports.getPerfil = async (req, res) => {
  console.log('👤 [PERFIL] Buscando...');

  try {
    const email = safeLowerEmail(req.query.email);

    if (!email) {
      return res.status(400).json({
        message: 'E-mail não informado.'
      });
    }

    let result = await db.query(
      'SELECT * FROM public.produtores WHERE LOWER(email)=$1',
      [email]
    );

    if (result.rows.length === 0) {
      result = await db.query(
        'SELECT * FROM public.usuarios WHERE LOWER(email)=$1',
        [email]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: 'Perfil não encontrado'
      });
    }

    const user = result.rows[0];
    delete user.senha;

    return res.status(200).json(user);

  } catch (err) {
    console.error('❌ ERRO PERFIL:', err);
    return res.status(500).json({
      message: 'Erro ao buscar perfil',
      error: getErrorMessage(err)
    });
  }
};

// -----------------------------
// 4️⃣ ATUALIZAR PERFIL
// -----------------------------
exports.updatePerfil = async (req, res) => {
  console.log('🆙 [UPDATE PERFIL]');

  try {
    const {
      email_original,
      nome,
      cpf_cnpj,
      cep,
      rua,
      numero,
      bairro,
      estado,
      telefone,
      razao_social,
      bio,
      instagram,
      linkedin
    } = req.body;

    const email = safeLowerEmail(email_original);

    if (!email) {
      return res.status(400).json({
        message: 'Email original não informado.'
      });
    }

    let result = await db.query(
      `
      UPDATE public.produtores
      SET
        nome=$1,
        cpf_cnpj=$2,
        cep=$3,
        rua=$4,
        numero=$5,
        bairro=$6,
        estado=$7,
        telefone=$8,
        razao_social=$9,
        bio=$10,
        instagram=$11,
        linkedin=$12
      WHERE LOWER(email)=$13
      RETURNING *
      `,
      [
        emptyToNull(nome),
        emptyToNull(cpf_cnpj),
        emptyToNull(cep),
        emptyToNull(rua),
        emptyToNull(numero),
        emptyToNull(bairro),
        emptyToNull(estado ? String(estado).toUpperCase() : null),
        emptyToNull(telefone),
        emptyToNull(razao_social),
        emptyToNull(bio),
        emptyToNull(instagram),
        emptyToNull(linkedin),
        email
      ]
    );

    if (result.rowCount === 0) {
      result = await db.query(
        `
        UPDATE public.usuarios
        SET
          nome=$1,
          telefone=$2,
          bio=$3,
          instagram=$4,
          linkedin=$5
        WHERE LOWER(email)=$6
        RETURNING *
        `,
        [
          emptyToNull(nome),
          emptyToNull(telefone),
          emptyToNull(bio),
          emptyToNull(instagram),
          emptyToNull(linkedin),
          email
        ]
      );
    }

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: 'Usuário não encontrado.'
      });
    }

    const user = result.rows[0];
    delete user.senha;

    return res.status(200).json({
      message: 'Perfil updated com sucesso!',
      user
    });

  } catch (err) {
    console.error('❌ ERRO UPDATE:', err);
    return res.status(500).json({
      message: 'Erro interno ao atualizar',
      error: getErrorMessage(err)
    });
  }
};

// -----------------------------
// 5️⃣ UPLOAD AVATAR
// -----------------------------
exports.uploadAvatar = async (req, res) => {
  console.log('📷 [UPLOAD AVATAR]');

  try {
    const email = safeLowerEmail(req.body.email);

    if (!email) {
      return res.status(400).json({
        message: 'E-mail não informado'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: 'Nenhuma imagem enviada'
      });
    }

    const avatarUrl = req.file.path;

    let result = await db.query(
      `
      UPDATE public.produtores
      SET avatar=$1
      WHERE LOWER(email)=$2
      RETURNING *
      `,
      [avatarUrl, email]
    );

    if (result.rowCount === 0) {
      result = await db.query(
        `
        UPDATE public.usuarios
        SET avatar=$1
        WHERE LOWER(email)=$2
        RETURNING *
        `,
        [avatarUrl, email]
      );
    }

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: 'Usuário não encontrado'
      });
    }

    return res.status(200).json({
      message: 'Avatar atualizado com sucesso!',
      avatar: avatarUrl
    });

  } catch (err) {
    console.error('❌ ERRO AVATAR:', err);

    return res.status(500).json({
      message: 'Erro ao enviar avatar',
      error: getErrorMessage(err)
    });
  }
};

// -----------------------------
// 6️⃣ PERFIL PUBLICO
// -----------------------------
exports.getPerfilPublico = async (req, res) => {
  try {
    const nome = safeString(req.query.nome);

    if (!nome) {
      return res.status(400).json({
        message: 'Nome é obrigatório.'
      });
    }

    let result = await db.query(
      `
      SELECT nome,bio,instagram,linkedin,avatar,role,status
      FROM public.produtores
      WHERE TRIM(LOWER(nome)) = TRIM(LOWER($1))
      LIMIT 1
      `,
      [nome]
    );

    if (result.rows.length === 0) {
      result = await db.query(
        `
        SELECT nome,bio,instagram,linkedin,avatar,role,status
        FROM public.usuarios
        WHERE TRIM(LOWER(nome)) = TRIM(LOWER($1))
        LIMIT 1
        `,
        [nome]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: 'Usuário não encontrado'
      });
    }

    return res.status(200).json(result.rows[0]);

  } catch (err) {
    console.error('❌ ERRO PERFIL PUBLICO:', err);
    return res.status(500).json({
      message: 'Erro ao buscar perfil público',
      error: getErrorMessage(err)
    });
  }
};