const multer = require('multer');
const path = require('path');

// Configuração básica para aceitar o formulário mesmo sem upload de arquivo real
const storage = multer.memoryStorage(); 

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) return cb(null, true);
    cb(new Error("Formato de arquivo inválido"));
  }
});

module.exports = upload;