const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('./cloudinary');

// 🔥 Configuração do storage na Cloudinary
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    return {
      folder: 'linkah/eventos',
      resource_type: 'image',

      // 🔥 formatos permitidos
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],

      // 🔥 otimização automática (TOP)
      transformation: [
        { quality: 'auto', fetch_format: 'auto' }
      ],
    };
  },
});

// 🔥 filtro de arquivo (segurança)
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('❌ Tipo de arquivo não permitido'), false);
  }
};

// 🔥 limite de tamanho (5MB)
const limits = {
  fileSize: 5 * 1024 * 1024,
};

// 🔥 export final
const upload = multer({
  storage,
  fileFilter,
  limits,
});

module.exports = upload;