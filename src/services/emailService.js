const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Envia o e-mail do ingresso com layout profissional
 */
const enviarIngressoEmail = async (emailCliente, dadosIngresso) => {
  try {
    const { data, error } = await resend.emails.send({
      // Nome que aparece na caixa de entrada do cliente
      from: 'Linkah Eventos <onboarding@resend.dev>',
      to: emailCliente,
      // Assunto personalizado com o nome do evento
      subject: `🎟️ Seu ingresso para: ${dadosIngresso.tituloEvento}`,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; border: 1px solid #f1f5f9; border-radius: 24px; overflow: hidden; background-color: #ffffff; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
          
          <div style="background: #f43f5e; padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-style: italic; font-size: 32px; letter-spacing: -1px;">LINKAH.</h1>
          </div>

          <div style="padding: 40px; color: #1e293b;">
            <h2 style="margin-top: 0; font-size: 24px; color: #0f172a;">Seu lugar está reservado!</h2>
            <p style="font-size: 16px; line-height: 1.6; color: #64748b;">
                Tudo pronto! Seu pagamento foi processado com sucesso. Abaixo estão os detalhes do seu evento:
            </p>
            
            <div style="background: #fff1f2; padding: 25px; border-radius: 20px; border: 2px dashed #f43f5e; margin: 30px 0;">
              <h3 style="margin: 0 0 15px 0; color: #f43f5e; text-transform: uppercase; font-size: 18px; letter-spacing: 1px;">
                ${dadosIngresso.tituloEvento}
              </h3>
              
              <div style="font-size: 15px; color: #475569;">
                <p style="margin: 8px 0;"><strong>📅 DATA:</strong> ${dadosIngresso.dataEvento}</p>
                <p style="margin: 8px 0;"><strong>⏰ HORA:</strong> ${dadosIngresso.horaEvento}</p>
                <p style="margin: 8px 0;"><strong>📍 LOCAL:</strong> ${dadosIngresso.localEvento}</p>
                <p style="margin: 8px 0;"><strong>🎫 QTD:</strong> ${dadosIngresso.quantidade} ingresso(s)</p>
              </div>
            </div>

            <div style="text-align: center; margin: 40px 0;">
              <a href="${dadosIngresso.linkIngresso}" 
                 style="background: #f43f5e; color: white; padding: 18px 35px; text-decoration: none; border-radius: 16px; font-weight: bold; display: inline-block; font-size: 16px; box-shadow: 0 4px 12px rgba(244, 63, 94, 0.4);">
                ACESSAR MEU INGRESSO
              </a>
            </div>
            
            <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 30px 0;" />
            
            <p style="font-size: 13px; color: #94a3b8; text-align: center; line-height: 1.5;">
              Apresente o ingresso digital no seu celular ao chegar no evento. <br/>
              Caso tenha dúvidas, entre em contato com o suporte.
            </p>
          </div>

          <div style="background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #cbd5e1;">
            © 2026 Linkah Eventos. Todos os direitos reservados.
          </div>
        </div>
      `,
    });

    if (error) {
        console.error('❌ Erro API Resend:', error);
        return null;
    }

    return data;
  } catch (err) {
    console.error('❌ Erro fatal no envio:', err.message);
    return null;
  }
};

module.exports = { enviarIngressoEmail };