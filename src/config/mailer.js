const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587, // MUDAR PARA 587
  secure: false, // MUDAR PARA FALSE (obrigatório para porta 587)
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Aquela senha de 16 dígitos
  },
  tls: {
    rejectUnauthorized: false // Ajuda a passar pelo firewall do Render
  }
});

// Teste de conexão
transporter.verify((error, success) => {
  if (error) {
    console.log("❌ ERRO NO MOTOR DE EMAIL:", error.message);
  } else {
    console.log("📧 ✅ MOTOR DE EMAIL PRONTO!");
  }
});

module.exports = transporter;