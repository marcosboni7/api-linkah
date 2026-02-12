const nodemailer = require('nodemailer');

// Configuração flexível usando variáveis de ambiente
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com', // Padrão Gmail se não houver ENV
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: process.env.EMAIL_SECURE === 'true', // true para 465, false para 587
  auth: {
    user: process.env.EMAIL_USER, // Seu e-mail (ex: marcosphara@gmail.com)
    pass: process.env.EMAIL_PASS, // Sua Senha de App (16 dígitos)
  },
  tls: {
    rejectUnauthorized: false // Essencial para funcionar no Render/Hospedagens
  }
});

/**
 * Função para enviar o e-mail do ingresso
 * @param {string} emailCliente 
 * @param {object} dadosIngresso 
 */
const enviarIngressoEmail = async (emailCliente, dadosIngresso) => {
  const mailOptions = {
    from: '"Linkah Eventos" <marcosphara@gmail.com>', // O Gmail exige que o 'from' seja o seu e-mail de login
    to: emailCliente,
    subject: `Seu ingresso para ${dadosIngresso.tituloEvento} chegou! 🎟️`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 20px; overflow: hidden;">
        <div style="background: #f43f5e; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-style: italic;">LINKAH.</h1>
        </div>
        <div style="padding: 30px;">
          <h2 style="color: #1e293b; margin-top: 0;">Seu lugar está garantido!</h2>
          <p style="color: #64748b;">Olá! Seu pagamento foi confirmado e seu ingresso já está disponível.</p>
          
          <div style="background: #fff1f2; padding: 25px; border-radius: 15px; border: 1px dashed #f43f5e;">
            <h3 style="margin: 0; color: #f43f5e; text-transform: uppercase;">${dadosIngresso.tituloEvento}</h3>
            <hr style="border: none; border-top: 1px solid #fecdd3; margin: 15px 0;" />
            <p style="margin: 5px 0; font-size: 14px;"><strong>🛒 QUANTIDADE:</strong> ${dadosIngresso.quantidade}x</p>
            <p style="margin: 5px 0; font-size: 14px;"><strong>👤 TITULAR:</strong> ${emailCliente.split('@')[0].toUpperCase()}</p>
          </div>

          <div style="text-align: center; margin-top: 30px;">
            <a href="${dadosIngresso.linkIngresso}" 
               style="background: #f43f5e; color: white; padding: 15px 25px; text-decoration: none; border-radius: 12px; font-weight: bold; display: inline-block; box-shadow: 0 4px 10px rgba(244, 63, 94, 0.3);">
              VISUALIZAR INGRESSO
            </a>
          </div>
          
          <p style="margin-top: 30px; font-size: 12px; color: #94a3b8; text-align: center;">
            Apresente o QR Code ou este e-mail na entrada do evento.
          </p>
        </div>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ E-mail de ingresso enviado:', info.messageId);
    return info;
  } catch (error) {
    console.error('❌ Erro no Nodemailer:', error.message);
    return null;
  }
};

module.exports = { enviarIngressoEmail };