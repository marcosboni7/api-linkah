const db = require('../config/database');
const bcrypt = require('bcrypt');

// Lista todos os usuários (Membros)
exports.listarUsuarios = async (req, res) => {
  try {
    const result = await db.query('SELECT id, nome, email, status FROM public.usuarios ORDER BY id DESC');
    res.status(200).json(result.rows);
  } catch (err) {
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

// Altera a senha com criptografia
exports.alterarSenha = async (req, res) => {
  const { id } = req.params;
  const { senha } = req.body;
  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(senha, salt);
    await db.query('UPDATE public.usuarios SET senha = $1 WHERE id = $2', [hash, id]);
    res.status(200).json({ message: 'Senha alterada com sucesso' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};