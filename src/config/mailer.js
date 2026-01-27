const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // EX: seuemail@gmail.com
    pass: process.env.EMAIL_PASS, // EX: aaaa bbbb cccc dddd (16 digitos)
  },
  pool: true, // Mantém a conexão aberta, evita timeout
  maxConnections: 1,
  maxMessages: Infinity,
  socketTimeout: 30000, // Espera até 30 segundos
  connectionTimeout: 30000,
  tls: {
    rejectUnauthorized: false // Não barra por causa de certificado
  },
  debug: true, // VAI MOSTRAR TUDO NO LOG DO RENDER
  logger: true // LOGA O PROTOCOLO SMTP COMPLETO
});

// Isso aqui vai te dizer no log assim que o servidor subir se o email está OK
transporter.verify((error, success) => {
  if (error) {
    console.log("❌ ERRO CRÍTICO NO MOTOR DE EMAIL:", error);
  } else {
    console.log("📧 ✅ MOTOR DE EMAIL PRONTO E CONECTADO!");
  }
});

module.exports = transporter;