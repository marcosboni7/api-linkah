const { Resend } = require('resend');

// O Token deve estar no seu painel do Render (Environment Variables)
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Função genérica para enviar e-mails (Boas-vindas, Recuperação, etc.)
 * Configurada para chegar em qualquer provedor.
 */
const sendMail = async (to, subject, html) => {
  try {
    const { data, error } = await resend.emails.send({
      // IMPORTANTE: Agora que seu domínio está verificado, use @linkah.com.br
      from: 'Linkah <contato@linkah.com.br>', 
      to: [to],
      subject: subject,
      html: html,
    });

    if (error) {
      console.error('❌ Erro retornado pelo Resend:', error.message);
      return null;
    }

    console.log('✅ E-mail transacional enviado para:', to);
    return data;
  } catch (error) {
    console.error('❌ Erro crítico no envio (Resend):', error.message);
    return null; 
  }
};

module.exports = sendMail;