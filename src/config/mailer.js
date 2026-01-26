const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true, 
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Senha de 16 dígitos do Google
  },
});

transporter.verify((error, success) => {
  if (error) {
    console.log("❌ ERRO NO MOTOR DE EMAIL:", error.message);
  } else {
    console.log("📧 ✅ MOTOR DE EMAIL PRONTO PARA DISPARAR!");
  }
});

module.exports = transporter;