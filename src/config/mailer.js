const { Resend } = require('resend');

// Usamos process.env para segurança, mas a chave que você mandou deve estar no Render
const resend = new Resend(process.env.RESEND_API_KEY || 're_gHQdcehD_JtWrrfTzh3LpCHMTLNX1Y4Mo');

module.exports = resend;