const nodemailer = require('nodemailer');

console.log("--- 📧 Configurando Motor de E-mail ---");
console.log("Variável EMAIL_USER:", process.env.EMAIL_USER ? "Definida ✅" : "Faltando ❌");
console.log("Variável EMAIL_PASS:", process.env.EMAIL_PASS ? "Definida ✅" : "Faltando ❌");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, 
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, 
  },
  tls: {
    rejectUnauthorized: false 
  },
  // Aumentamos o tempo de espera para evitar o Timeout rápido
  connectionTimeout: 10000, 
  greetingTimeout: 10000
});

// Teste de conexão imediato ao ligar o servidor
transporter.verify((error, success) => {
  if (error) {
    console.log("❌ ERRO DE CONEXÃO NO MAILER:", error.message);
  } else {
    console.log("📧 ✅ MOTOR DE EMAIL PRONTO E AUTENTICADO!");
  }
});

module.exports = transporter;