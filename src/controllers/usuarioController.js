const db = require('../config/database');
const bcrypt = require('bcrypt');

/**
 * ==========================================
 * 1️⃣ LOGIN ADMINISTRATIVO (AJUSTADO)
 * ==========================================
 */
exports.loginAdmin = async (req, res) => {
  // Usamos trim() para evitar que um espaço no final do input estrague o login
  const email = req.body.email ? req.body.email.trim() : '';
  const password = req.body.password ? req.body.password.trim() : '';

  try {
    // ILIKE faz a busca ignorando se é maiúsculo ou minúsculo (Case Insensitive)
    const result = await db.query(
      'SELECT * FROM public.usuarios WHERE email ILIKE $1', 
      [email]
    );
    const user = result.rows[0];

    // 1. Verifica se usuário existe
    if (!user) {
      console.log(`[AUTH] Usuário não encontrado: ${email}`);
      return res.status(401).json({ error: "Credenciais inválidas." });
    }

    // 2. Compara a senha digitada com o hash do banco
    const passwordMatch = await bcrypt.compare(password, user.senha);
    if (!passwordMatch) {
      console.log(`[AUTH] Senha incorreta para: ${email}`);
      return res.status(401).json({ error: "Credenciais inválidas." });
    }

    // 3. Verifica se tem permissão de admin
    if (user.role !== 'admin') {
      console.log(`[AUTH] Tentativa de acesso sem permissão: ${email}`);
      return res.status(403).json({ error: "Acesso não autorizado ao console." });
    }

    // 4. Resposta de sucesso (Enviamos um token para o seu localStorage não ficar vazio)
    res.status(200).json({ 
      message: "Autenticado com sucesso",
      token: "linkah_master_token_2026", // O front precisa disso para o seu Layout funcionar
      user: { 
        id: user.id, 
        nome: user.nome, 
        email: user.email, 
        role: user.role 
      }
    });

  } catch (err) {
    console.error('❌ ERRO LOGIN:', err.message);
    res.status(500).json({ error: "Erro interno no servidor" });
  }
};

/**
 * ==========================================
 * 2️⃣ GERENCIAMENTO DE MEMBROS
 * ==========================================
 */

// Lista todos os usuários (Membros) para o Dashboard
exports.listarUsuarios = async (req, res) => {
  try {
    const result = await db.query('SELECT id, nome, email, status, role, criado_em FROM public.usuarios ORDER BY id DESC');
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('❌ ERRO LISTAR:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// Atualiza status (Ativo/Banido)
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

// Altera a senha com criptografia
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