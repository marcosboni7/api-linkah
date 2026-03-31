const { Resend } = require('resend');

// LOG DE INICIALIZAÇÃO IMEDIATA
console.log('--------------------------------------------------');
if (!process.env.RESEND_API_KEY) {
  console.error('❌ DEBUG CRÍTICO: RESEND_API_KEY ESTÁ VAZIA NO RENDER!');
  console.log('Vá em: Dashboard Render -> Seu Web Service -> Environment -> Adicione RESEND_API_KEY');
} else {
  console.log('📡 RESEND_API_KEY detectada:', process.env.RESEND_API_KEY.substring(0, 8) + '***');
}
console.log('--------------------------------------------------');

const resend = new Resend(process.env.RESEND_API_KEY);

const enviarIngressoEmail = async (emailCliente, dadosIngresso) => {
  console.log(`\n--- 🚀 [DEBUG] DISPARANDO ENVIARINGRESSOEMAIL ---`);
  console.log(`📍 Para: ${emailCliente}`);
  console.log(`📍 Evento: ${dadosIngresso?.tituloEvento}`);

  try {
    // Verificação de dados antes de chamar a API
    if (!process.env.RESEND_API_KEY) {
      throw new Error('Tentativa de envio sem API KEY configurada.');
    }

    if (!emailCliente) {
      console.error('❌ Erro: Destinatário (emailCliente) veio vazio!');
      return null;
    }

    const localExibicao = dadosIngresso.linkReuniao ? 'Plataforma Online' : (dadosIngresso.localEvento || 'A confirmar');
    
    console.log('⏳ Aguardando resposta da API do Resend...');
    
    const { data, error } = await resend.emails.send({
      from: 'Linkah Eventos <contato@linkah.com.br>', 
      to: [emailCliente],
      subject: `🎟️ Seu ingresso para: ${dadosIngresso.tituloEvento}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #f1f5f9; border-radius: 24px; overflow: hidden; background-color: #ffffff;">
          <div style="background: #C22973; padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">LINKAH.</h1>
          </div>
          <div style="padding: 40px; color: #1e293b;">
            <h2>Seu lugar está reservado!</h2>
            <div style="background: #fff1f2; padding: 25px; border-radius: 20px; border: 2px dashed #C22973;">
              <h3>${dadosIngresso.tituloEvento}</h3>
              <p>📅 DATA: ${dadosIngresso.dataEvento}</p>
              <p>📍 LOCAL: ${localExibicao}</p>
              <p>🎫 QTD: ${dadosIngresso.quantidade}</p>
            </div>
            <div style="text-align: center; margin-top: 30px;">
              <a href="${dadosIngresso.linkIngresso}" style="background: #0f172a; color: white; padding: 15px 25px; text-decoration: none; border-radius: 12px; font-weight: bold;">
                VER MEU INGRESSO
              </a>
            </div>
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