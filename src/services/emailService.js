const { Resend } = require('resend');

// LOG DE INICIALIZAÇÃO: Verifica se a chave existe no ambiente assim que o servidor sobe
if (!process.env.RESEND_API_KEY) {
  console.error('❌ CRÍTICO: RESEND_API_KEY não encontrada nas variáveis de ambiente!');
} else {
  console.log('📡 Resend configurado com a chave:', process.env.RESEND_API_KEY.substring(0, 7) + '...');
}

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Envia o e-mail do ingresso com layout profissional
 */
const enviarIngressoEmail = async (emailCliente, dadosIngresso) => {
  console.log(`\n--- 🚀 Iniciando processo de envio de e-mail ---`);
  console.log(`📧 Destinatário: ${emailCliente}`);
  console.log(`📦 Dados recebidos:`, JSON.stringify(dadosIngresso, null, 2));

  try {
    // Validação básica de segurança
    if (!emailCliente || !emailCliente.includes('@')) {
      console.error('❌ Erro: E-mail do cliente é inválido ou está vazio.');
      return null;
    }

    const localExibicao = dadosIngresso.linkReuniao ? 'Plataforma Online' : (dadosIngresso.localEvento || 'A confirmar');
    
    console.log('🔗 Chamando API do Resend...');
    
    const { data, error } = await resend.emails.send({
      from: 'Linkah Eventos <contato@linkah.com.br>', 
      to: [emailCliente],
      subject: `🎟️ Seu ingresso para: ${dadosIngresso.tituloEvento}`,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; border: 1px solid #f1f5f9; border-radius: 24px; overflow: hidden; background-color: #ffffff; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
          <div style="background: #C22973; padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-style: italic; font-size: 32px; letter-spacing: -1px;">LINKAH.</h1>
            <p style="color: #ffc0d9; font-size: 10px; text-transform: uppercase; letter-spacing: 2px; margin-top: 5px;">Official Ticket • AWS Secured</p>
          </div>
          <div style="padding: 40px; color: #1e293b;">
            <h2 style="margin-top: 0; font-size: 24px; color: #0f172a;">Seu lugar está reservado!</h2>
            <div style="background: #fff1f2; padding: 25px; border-radius: 20px; border: 2px dashed #C22973; margin: 30px 0;">
              <h3 style="margin: 0 0 15px 0; color: #C22973; text-transform: uppercase; font-size: 18px; letter-spacing: 1px; font-weight: 800;">
                ${dadosIngresso.tituloEvento}
              </h3>
              <div style="font-size: 14px; color: #475569;">
                <p style="margin: 8px 0;"><strong>📅 DATA:</strong> ${dadosIngresso.dataEvento}</p>
                <p style="margin: 8px 0;"><strong>⏰ HORA:</strong> ${dadosIngresso.horaEvento}</p>
                <p style="margin: 8px 0;"><strong>📍 LOCAL:</strong> ${localExibicao}</p>
                <p style="margin: 8px 0;"><strong>🎫 QTD:</strong> ${dadosIngresso.quantidade} ingresso(s)</p>
              </div>
            </div>
            <div style="text-align: center; margin: 40px 0;">
              <a href="${dadosIngresso.linkIngresso}" style="background: #0f172a; color: white; padding: 18px 35px; text-decoration: none; border-radius: 16px; font-weight: bold; display: inline-block; font-size: 15px; text-transform: uppercase; letter-spacing: 1px;">
                VER MEU INGRESSO / QR CODE
              </a>
            </div>
          </div>
          <div style="background: #f8fafc; padding: 20px; text-align: center; font-size: 11px; color: #cbd5e1; text-transform: uppercase; letter-spacing: 1px;">
            © 2026 Linkah Eventos • Powered by AWS & Stripe
          </div>
        </div>
      `,
    });

    if (error) {
      console.error('❌ Resend retornou um erro na API:', JSON.stringify(error, null, 2));
      return null;
    }

    console.log('✅ Resend confirmou o envio! ID:', data.id);
    return data;
  } catch (err) {
    console.error('❌ ERRO FATAL no emailService:', err.message);
    console.error('Stack trace:', err.stack);
    return null;
  }
};

/**
 * Função genérica para outros e-mails
 */
const sendMail = async (to, subject, html) => {
  console.log(`📧 Enviando e-mail genérico para: ${to}`);
  try {
    const { data, error } = await resend.emails.send({
      from: 'Linkah <contato@linkah.com.br>', 
      to: [to],
      subject: subject,
      html: html,
    });

    if (error) {
      console.error('❌ Erro no sendMail (Resend):', error);
      return null;
    }
    console.log('✅ E-mail transacional enviado!');
    return data;
  } catch (error) {
    console.error('❌ Erro crítico no sendMail:', error.message);
    return null; 
  }
};

module.exports = { enviarIngressoEmail, sendMail };