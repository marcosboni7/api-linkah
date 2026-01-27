const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // true para porta 465, false para outras
  auth: {
    user: 'marcosphara@gmail.com',
    pass: 'kytyrxzjlgsxqvjq' // Sua senha de app
  },
  connectionTimeout: 10000, // 10 segundos de limite
});

const sendMail = async (to, subject, html) => {
  const mailOptions = {
    from: '"LINKAH" <marcosphara@gmail.com>',
    to,
    subject,
    html
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ E-mail enviado com sucesso!');
    return { success: true, info };
  } catch (error) {
    console.error('❌ Erro real no envio:', error.message);
    throw error; // Lança o erro para o controller saber que falhou
  }
};

module.exports = sendMail;