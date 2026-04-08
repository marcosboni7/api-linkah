const db = require('../config/database');
const bcrypt = require('bcrypt');

/**
 * ==========================================
 * 1️⃣ LOGIN ADMINISTRATIVO (COM AUTO-HASH DEBUG)
 * ==========================================
 */
exports.loginAdmin = async (req, res) => {
  console.log("--- [DEBUG LOGIN START] ---");
  
  const email = req.body.email ? req.body.email.trim() : '';
  const password = req.body.password ? req.body.password.trim() : '';

  try {
    // LOG AUXILIAR: Gera o hash correto no seu ambiente atual
    // Use o valor que aparecer aqui para atualizar seu banco de dados
    const generatedHash = await bcrypt.hash('admin26', 10);
    console.log(`🚀 [IMPORTANTE] Hash gerado agora para 'admin26': ${generatedHash}`);

    const result = await db.query(
      'SELECT * FROM public.usuarios WHERE email ILIKE $1', 
      [email]
    );
    const user = result.rows[0];

    // 1. Verifica se usuário existe no banco
    if (!user) {
      console.log(`❌ [DEBUG] Usuário NÃO encontrado: ${email}`);
      return res.status(401).json({ error: "Credenciais inválidas." });
    }

    console.log(`✅ [DEBUG] Usuário encontrado: ${user.email}`);
    console.log(`🔍 [DEBUG] Hash que está HOJE no Banco: ${user.senha}`);

    // 2. Compara a senha
    const passwordMatch = await bcrypt.compare(password, user.senha);
    
    if (!passwordMatch) {
      console.log(`❌ [DEBUG] Senha digitada NÃO bate com o hash do banco.`);
      return res.status(401).json({ error: "Credenciais inválidas." });
    }

    // 3. Verifica se tem permissão de admin
    if (user.role !== 'admin') {
      console.log(`⚠️ [DEBUG] Role '${user.role}' não autorizado.`);
      return res.status(403).json({ error: "Acesso não autorizado." });
    }

    console.log(`🚀 [DEBUG] Login Master Autorizado!`);

    res.status(200).json({ 
      message: "Autenticado com sucesso",
      token: "linkah_master_token_2026",
      user: { 
        id: user.id, 
        nome: user.nome, 
        email: user.email, 
        role: user.role 
      }
    });

  } catch (err) {
    console.error('🔥 [DEBUG ERROR]:', err.message);
    res.status(500).json({ error: "Erro interno no servidor" });
  }
};

/**
 * ==========================================
 * 2️⃣ GERENCIAMENTO DE MEMBROS
 * ==========================================
 */
exports.listarUsuarios = async (req, res) => {
  try {
    const result = await db.query('SELECT id, nome, email, status, role, criado_em FROM public.usuarios ORDER BY id DESC');
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('❌ ERRO LISTAR:', err.message);
    res.status(500).json({ error: err.message });
  }
};

exports.atualizarUsuario = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    await db.query('UPDATE public.usuarios SET status = $1 WHERE id = $2', [status, id]);
    res.status(200).json({ message: 'Status atualizado com sucesso' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * ==========================================
 * 3️⃣ SEGURANÇA
 * ==========================================
 */
exports.alterarSenha = async (req, res) => {
  const { id } = req.params;
  const { senha } = req.body;
  
  if (!senha) return res.status(400).json({ error: "A senha é obrigatória" });

  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(senha, salt);
    
    await db.query('UPDATE public.usuarios SET senha = $1 WHERE id = $2', [hash, id]);
    res.status(200).json({ message: 'Senha alterada com sucesso' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};