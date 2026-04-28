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

  const { email } = req.body || {};

  // Validación de email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!email || !emailRegex.test(email.trim())) {
    return res.status(400).json({ error: 'Email inválido' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || '';
  const userAgent = req.headers['user-agent'] || '';

  try {
    // Verificar si el email ya existe
    const { data: existing } = await supabase
      .from('wishlist')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (!existing) {
      // Insertar nuevo registro
      const { error: insertError } = await supabase
        .from('wishlist')
        .insert({
          email: normalizedEmail,
          ip_address: ip,
          user_agent: userAgent,
        });

      if (insertError) throw insertError;

      // Enviar email de confirmación de wishlist (a todos)
      const emailApi = new brevo.TransactionalEmailsApi();
      emailApi.authentications['api-key'].apiKey = process.env.BREVO_API_KEY;

      await emailApi.sendTransacEmail({
        to: [{ email: normalizedEmail }],
        templateId: parseInt(process.env.BREVO_WISHLIST_TEMPLATE_ID),
      });
    }

    // Si el email ya existe, respondemos success sin error
    // (el usuario ya está en la lista, no hay que bloquearlo)
    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('[wishlist] Error:', error?.message || error);
    return res.status(500).json({ error: 'Error interno. Intenta de nuevo.' });
  }
};
