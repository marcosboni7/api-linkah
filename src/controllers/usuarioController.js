const db = require('../config/database');
const bcrypt = require('bcrypt');

/**
 * ==========================================
 * 1️⃣ LOGIN ADMINISTRATIVO
 * ==========================================
 */
exports.loginAdmin = async (req, res) => {
  const email = req.body.email ? req.body.email.trim() : '';
  const password = req.body.password ? req.body.password.trim() : '';

  try {
    // Busca o usuário ignorando case-sensitive
    const result = await db.query(
      'SELECT * FROM public.usuarios WHERE email ILIKE $1', 
      [email]
    );
    const user = result.rows[0];

    // Verifica se usuário existe e se a senha bate
    if (!user || !(await bcrypt.compare(password, user.senha))) {
      return res.status(401).json({ error: "Credenciais inválidas." });
    }

    // Verifica permissão de admin
    if (user.role !== 'admin') {
      return res.status(403).json({ error: "Acesso não autorizado." });
    }

    // Retorna sucesso com o token para o seu layout do Next.js
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
    console.error('Erro no login:', err.message);
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
    const result = await db.query(
      'SELECT id, nome, email, status, role, criado_em FROM public.usuarios ORDER BY id DESC'
    );
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Erro ao listar usuários" });
  }
};

exports.atualizarUsuario = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    await db.query('UPDATE public.usuarios SET status = $1 WHERE id = $2', [status, id]);
    res.status(200).json({ message: 'Status atualizado com sucesso' });
  } catch (err) {
    res.status(500).json({ error: "Erro ao atualizar status" });
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
    res.status(500).json({ error: "Erro ao atualizar senha" });
  }
};