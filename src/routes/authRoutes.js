const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// 📷 Importação correta desestruturada para o Cloudinary
const { uploadAvatar } = require('../config/multer');


// -----------------------------
// 🔐 AUTENTICAÇÃO
// -----------------------------

// Cadastro de produtor
router.post('/register', authController.registerProdutor);

// Login
router.post('/login', authController.login);


// -----------------------------
// 👤 GERENCIAMENTO DE PERFIL
// -----------------------------

// Buscar perfil (usado para preencher o formulário que editamos no front)
router.get('/perfil', authController.getPerfil);

// Atualizar perfil (nome, bio, redes sociais, etc)
router.put('/perfil', authController.updatePerfil);

// 📷 Upload de foto de perfil (Aqui o middleware uploadAvatar faz a mágica)
router.post(
  '/upload-avatar',
  uploadAvatar.single('avatar'),
  authController.uploadAvatar
);


// -----------------------------
// 🌐 PERFIL PÚBLICO
// -----------------------------

// Usado no modal de chat ou página pública
router.get('/perfil-publico', authController.getPerfilPublico);


// -----------------------------
// 🛠️ MANUTENÇÃO
// -----------------------------

router.get('/status', (req, res) => {
  res.status(200).json({
    message: "API de Autenticação Online"
  });
});


module.exports = router;