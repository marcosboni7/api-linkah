const nodemailer = require('nodemailer');

// Configuração do motor de envio (Gmail)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'marcosphara@gmail.com',
    pass: 'kytyrxzjlgsxqvjq' // Sua senha de app (sem espaços)
  }
});

// Função principal de envio
const sendMail = async (to, subject, html) => {
  const mailOptions = {
    from: '"LINKAH" <marcosphara@gmail.com>',
    to,
    subject,
    html
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ E-mail enviado: ' + info.response);
    return { success: true };
  } catch (error) {
    console.error('❌ Erro no mailer.js:', error);
    return { success: false, error };
  }
};

module.exports = sendMail;