const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const BREVO_API = 'https://api.brevo.com/v3';

async function brevoRequest(path, body) {
  const res = await fetch(`${BREVO_API}${path}`, {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      'api-key': process.env.BREVO_API_KEY,
    },
    body: JSON.stringify(body),
  });
  return res;
}

module.exports = async (req, res) => {
  // CORS
  const origin = req.headers.origin;
  const allowed = ['https://voca.com.mx', 'https://www.voca.com.mx', 'http://localhost:3000'];
  if (allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { email } = req.body || {};

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!email || !emailRegex.test(email.trim())) {
    return res.status(400).json({ error: 'Email inválido' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || '';
  const userAgent = req.headers['user-agent'] || '';

  try {
    // Verificar si ya existe
    const { data: existing } = await supabase
      .from('wishlist')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (!existing) {
      // Insertar en Supabase
      const { error: insertError } = await supabase
        .from('wishlist')
        .insert({ email: normalizedEmail, ip_address: ip, user_agent: userAgent });

      if (insertError) throw insertError;

      // Añadir a lista VOCA-Early-Access en Brevo
      await brevoRequest('/contacts', {
        email: normalizedEmail,
        listIds: [parseInt(process.env.BREVO_WISHLIST_LIST_ID)],
        updateEnabled: true,
      });

      // Enviar email de confirmación
      await brevoRequest('/smtp/email', {
        to: [{ email: normalizedEmail }],
        templateId: parseInt(process.env.BREVO_WISHLIST_TEMPLATE_ID),
      });
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('[wishlist] Error:', error?.message || error);
    return res.status(500).json({ error: 'Error interno. Intenta de nuevo.' });
  }
};
