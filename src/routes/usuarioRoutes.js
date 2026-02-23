const express = require('express');
const router = express.Router();
const db = require('../config/db'); // ajuste o caminho conforme seu projeto

// ROTA PARA LISTAR TODOS (O que o seu painel Staff precisa)
router.get('/', async (req, res) => {
    try {
        // Buscamos todos menos a senha por segurança
        const [rows] = await db.execute('SELECT id, nome, email, role, status, created_at FROM usuarios');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: "Erro ao buscar usuários" });
    }
});

// ROTA PARA ATUALIZAR (Banir, Mudar Senha, etc)
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { nome, role, status, password } = req.body;
    
    try {
        if (password) {
            // Se enviou senha nova, atualiza tudo (ideal seria usar bcrypt aqui)
            await db.execute(
                'UPDATE usuarios SET nome = ?, role = ?, status = ?, senha = ? WHERE id = ?',
                [nome, role, status, password, id]
            );
        } else {
            // Se não enviou senha, atualiza só os dados
            await db.execute(
                'UPDATE usuarios SET nome = ?, role = ?, status = ? WHERE id = ?',
                [nome, role, status, id]
            );
        }
        res.json({ message: "Usuário atualizado!" });
    } catch (error) {
        res.status(500).json({ error: "Erro ao atualizar" });
    }
});

module.exports = router;