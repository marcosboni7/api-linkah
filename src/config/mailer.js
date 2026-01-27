const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail', // Usar 'service' é mais seguro que configurar host/porta manualmente
  auth: {
    user: process.env.EMAIL_USER, // Agora vai ler seu e-mail correto do Render
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false
  }
});

module.exports = transporter;