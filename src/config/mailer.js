const { Resend } = require('resend');

// O Resend usa API (HTTPS), por isso não dá timeout como o Gmail (SMTP)
const resend = new Resend(process.env.RESEND_API_KEY);

module.exports = resend;