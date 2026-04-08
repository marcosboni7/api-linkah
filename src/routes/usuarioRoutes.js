const express = require('express');
const router = express.Router();
const db = require('../config/database'); // Ajustado para o nome do seu arquivo de conexão
const bcrypt = require('bcrypt');

// 1. LISTAR TODOS (GET /api/usuarios)
router.get('/', async (req, res) => {
    try {
        // No Postgres usamos db.query e não desestruturamos [rows]
        const result = await db.query('SELECT id, nome, email, status FROM public.usuarios ORDER BY id DESC');
        res.json(result.rows);
    } catch (error) {
        console.error("Erro ao buscar usuários:", error.message);
        res.status(500).json({ error: "Erro ao buscar usuários" });
    }
});

// 2. ATUALIZAR STATUS (PUT /api/usuarios/:id)
// Usado pelo botão de Banir/Reativar do seu Front
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    try {
        await db.query(
            'UPDATE public.usuarios SET status = $1 WHERE id = $2',
            [status, id]
        );
        res.json({ message: "Status atualizado!" });
    } catch (error) {
        res.status(500).json({ error: "Erro ao atualizar status" });
    }
});

// 3. ALTERAR SENHA (PATCH /api/usuarios/:id/senha)
// Usado pelo modal de nova senha do seu Front
router.patch('/:id/senha', async (req, res) => {
    const { id } = req.params;
    const { senha } = req.body;

    try {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(senha, salt);

        await db.query(
            'UPDATE public.usuarios SET senha = $1 WHERE id = $2',
            [hash, id]
        );
        res.json({ message: "Senha alterada com sucesso!" });
    } catch (error) {
        res.status(500).json({ error: "Erro ao atualizar senha" });
    }
});

module.exports = router;