const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // Use false para a porta 587
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false // Ajuda a evitar erros de certificado no Render
  }
});

// O verify pode demorar, então vamos deixar ele não-bloqueante
transporter.verify().catch(error => {
  console.log("❌ ERRO NO MOTOR DE EMAIL:", error.message);
});

module.exports = transporter;