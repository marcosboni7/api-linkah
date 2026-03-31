const { Resend } = require('resend');

// LOG DE INICIALIZAÇÃO IMEDIATA
console.log('--------------------------------------------------');
if (!process.env.RESEND_API_KEY) {
  console.error('❌ DEBUG CRÍTICO: RESEND_API_KEY ESTÁ VAZIA NO RENDER!');
} else {
  console.log('📡 RESEND_API_KEY detectada:', process.env.RESEND_API_KEY.substring(0, 8) + '***');
}
console.log('--------------------------------------------------');

const resend = new Resend(process.env.RESEND_API_KEY);

const enviarIngressoEmail = async (emailCliente, dadosIngresso) => {
  console.log(`\n--- 🚀 [DEBUG] DISPARANDO ENVIARINGRESSOEMAIL ---`);
  console.log(`📍 Para: ${emailCliente}`);
  console.log(`📍 Evento: ${dadosIngresso?.tituloEvento}`);
  console.log(`📍 Tipo: ${dadosIngresso?.tipo}`);

  try {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('Tentativa de envio sem API KEY configurada.');
    }

    if (!emailCliente) {
      console.error('❌ Erro: Destinatário (emailCliente) veio vazio!');
      return null;
    }

    // Define se o evento é online (independente de maiúscula/minúscula)
    const isOnline = dadosIngresso.tipo?.toLowerCase() === 'online';
    const localExibicao = isOnline ? '📍 Evento Online (Link Abaixo)' : (dadosIngresso.localEvento || 'A confirmar');
    
    // Bloco HTML condicional para o Link da Reunião
    const blocoLinkReuniao = (isOnline && dadosIngresso.linkReuniao) 
      ? `
        <div style="margin-top: 20px; padding: 15px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; text-align: center;">
          <p style="margin: 0 0 10px 0; color: #64748b; font-size: 14px;">Este evento será online. Acesse pelo link:</p>
          <a href="${dadosIngresso.linkReuniao}" style="color: #C22973; font-weight: bold; word-break: break-all;">
            ${dadosIngresso.linkReuniao}
          </a>
          <div style="margin-top: 15px;">
            <a href="${dadosIngresso.linkReuniao}" style="background: #C22973; color: white; padding: 10px 20px; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: bold;">
              ENTRAR NA REUNIÃO AGORA
            </a>
          </div>
        </div>
      ` : '';

    console.log('⏳ Aguardando resposta da API do Resend...');
    
    const { data, error } = await resend.emails.send({
      from: 'Linkah Eventos <contato@linkah.com.br>', 
      to: [emailCliente],
      subject: `🎟️ Seu ingresso para: ${dadosIngresso.tituloEvento}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #f1f5f9; border-radius: 24px; overflow: hidden; background-color: #ffffff;">
          <div style="background: #C22973; padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; letter-spacing: 2px;">LINKAH.</h1>
          </div>
          <div style="padding: 40px; color: #1e293b;">
            <h2 style="margin-top: 0;">Seu lugar está reservado!</h2>
            <p>Olá! Seu pagamento foi confirmado. Aqui estão os detalhes do seu acesso:</p>
            
            <div style="background: #fff1f2; padding: 25px; border-radius: 20px; border: 2px dashed #C22973;">
              <h3 style="margin-top: 0; color: #C22973;">${dadosIngresso.tituloEvento}</h3>
              <p style="margin: 5px 0;">📅 <strong>DATA:</strong> ${dadosIngresso.dataEvento}</p>
              <p style="margin: 5px 0;">📍 <strong>LOCAL:</strong> ${localExibicao}</p>
              <p style="margin: 5px 0;">🎫 <strong>QTD:</strong> ${dadosIngresso.quantidade} ingresso(s)</p>
              
              ${blocoLinkReuniao}
            </div>

            <div style="text-align: center; margin-top: 30px;">
              <p style="font-size: 14px; color: #64748b; margin-bottom: 20px;">Você também pode visualizar seu QR Code e gerenciar sua reserva clicando no botão abaixo:</p>
              <a href="${dadosIngresso.linkIngresso}" style="background: #0f172a; color: white; padding: 15px 25px; text-decoration: none; border-radius: 12px; font-weight: bold; display: inline-block;">
                VER MEU INGRESSO COMPLETO
              </a>
            </div>

            <hr style="margin: 40px 0; border: 0; border-top: 1px solid #f1f5f9;" />
            <p style="font-size: 12px; color: #94a3b8; text-align: center;">
              Linkah Digital Studio - Votuporanga, SP.
            </p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error('❌ Erro retornado pela API Resend:', JSON.stringify(error, null, 2));
      return null;
    }

    console.log('✅ SUCESSO: Resend processou o envio. ID:', data?.id);
    return data;

  } catch (err) {
    console.error('❌ ERRO CAPTURADO NO CATCH:', err.message);
    return null;
  }
};

const sendMail = async (to, subject, html) => {
  console.log(`📧 [DEBUG] sendMail genérico para: ${to}`);
  try {
    const { data, error } = await resend.emails.send({
      from: 'Linkah <contato@linkah.com.br>', 
      to: [to],
      subject: subject,
      html: html,
    });
    if (error) {
      console.error('❌ Erro no sendMail:', error);
      return null;
    }
    console.log('✅ E-mail enviado!');
    return data;
  } catch (error) {
    console.error('❌ Erro crítico no sendMail:', error.message);
    return null; 
  }
};

module.exports = { enviarIngressoEmail, sendMail };