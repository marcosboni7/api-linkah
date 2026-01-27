const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // false para porta 587
  auth: {
    user: 'marcosphara@gmail.com',
    pass: 'kytyrxzjlgsxqvjq' 
  },
  tls: {
    rejectUnauthorized: false // Ajuda a evitar bloqueios de certificados no Render
  },
  connectionTimeout: 20000, // Aumentamos para 20 segundos
  greetingTimeout: 20000
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
    return info;
  } catch (error) {
    console.error('❌ Erro real no envio:', error.message);
    // Não vamos travar o registro se o e-mail falhar
    return null; 
  }
};

module.exports = sendMail;