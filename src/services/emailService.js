const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST, // ex: smtp.gmail.com ou smtp.resend.com
  port: 587,
  secure: false, 
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const enviarIngressoEmail = async (emailCliente, dadosIngresso) => {
  const mailOptions = {
    from: '"Linkah Eventos" <contato@linkah.com.br>',
    to: emailCliente,
    subject: `Seu ingresso para ${dadosIngresso.tituloEvento} chegou! 🎟️`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto;">
        <h1 style="color: #e11d48;">Seu ingresso está aqui!</h1>
        <p>Olá! Seu pagamento foi confirmado e seu lugar está garantido.</p>
        <div style="background: #f1f5f9; padding: 20px; border-radius: 15px;">
          <h2>${dadosIngresso.tituloEvento}</h2>
          <p><strong>Quantidade:</strong> ${dadosIngresso.quantidade}</p>
          <p><strong>E-mail:</strong> ${emailCliente}</p>
        </div>
        <p style="margin-top: 20px;">Apresente este e-mail ou seu documento na entrada do evento.</p>
      </div>
    `,
  };

  return transporter.sendMail(mailOptions);
};