const db = require('../config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken'); // Opcional: para gerar tokens de acesso

/**
 * ==========================================
 * 1️⃣ LOGIN ADMINISTRATIVO
 * ==========================================
 */
exports.loginAdmin = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Busca o usuário pelo e-mail
    const result = await db.query('SELECT * FROM public.usuarios WHERE email = $1', [email]);
    const user = result.rows[0];

    // Verifica se usuário existe
    if (!user) {
      return res.status(401).json({ error: "Credenciais inválidas." });
    }

    // Compara a senha digitada com o hash no banco
    const passwordMatch = await bcrypt.compare(password, user.senha);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Credenciais inválidas." });
    }

    // Verifica se tem permissão de admin
    if (user.role !== 'admin') {
      return res.status(403).json({ error: "Acesso não autorizado ao console." });
    }

    // Resposta de sucesso
    res.status(200).json({ 
      message: "Autenticado com sucesso",
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