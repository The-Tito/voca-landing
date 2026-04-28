const { createClient } = require('@supabase/supabase-js');
const brevo = require('@getbrevo/brevo');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

module.exports = async (req, res) => {
  // CORS
  const origin = req.headers.origin;
  const allowed = ['https://voca.com.mx', 'http://localhost:3000'];
  if (allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { email, accept } = req.body || {};

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!email || !emailRegex.test(email.trim())) {
    return res.status(400).json({ error: 'Email inválido' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    // Actualizar preferencia de newsletter en Supabase
    const { error: updateError } = await supabase
      .from('wishlist')
      .update({
        newsletter_accepted: accept === true,
        updated_at: new Date().toISOString(),
      })
      .eq('email', normalizedEmail);

    if (updateError) throw updateError;

    if (accept === true) {
      const contactsApi = new brevo.ContactsApi();
      contactsApi.authentications['api-key'].apiKey = process.env.BREVO_API_KEY;

      // Añadir a lista VOCA-Newsletter (solo suscriptores)
      await contactsApi.createContact({
        email: normalizedEmail,
        listIds: [parseInt(process.env.BREVO_NEWSLETTER_LIST_ID)],
        updateEnabled: true,
      });

      // Enviar email de bienvenida al newsletter
      const emailApi = new brevo.TransactionalEmailsApi();
      emailApi.authentications['api-key'].apiKey = process.env.BREVO_API_KEY;

      await emailApi.sendTransacEmail({
        to: [{ email: normalizedEmail }],
        templateId: parseInt(process.env.BREVO_NEWSLETTER_TEMPLATE_ID),
      });
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('[newsletter] Error:', error?.message || error);
    return res.status(500).json({ error: 'Error interno. Intenta de nuevo.' });
  }
};
