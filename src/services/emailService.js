const { Resend } = require('resend');

// O Resend usa apenas a API KEY que você colocou no Render
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Função para enviar o e-mail do ingresso via RESEND
 * @param {string} emailCliente 
 * @param {object} dadosIngresso 
 */
const enviarIngressoEmail = async (emailCliente, dadosIngresso) => {
  try {
    const data = await resend.emails.send({
      from: 'Linkah Eventos <onboarding@resend.dev>', // No início, use este remetente padrão do Resend
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
              Apresente o seu ticket na entrada do evento.
            </p>
          </div>
        </div>
      `,
    });

    console.log('✅ E-mail enviado via Resend ID:', data.id);
    return data;
  } catch (error) {
    console.error('❌ Erro no Resend:', error.message);
    return null;
  }
};

module.exports = { enviarIngressoEmail };