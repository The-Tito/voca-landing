// Email guardado entre paso 1 y paso 2
let pendingEmail = '';

// ── Paso 1: Registro en wishlist ──────────────────────────────
async function handleSignup(inputId) {
  const input = document.getElementById(inputId);
  const val = input.value.trim();

  // Validación básica en cliente
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!val || !emailRegex.test(val)) {
    input.style.boxShadow =
      'inset 4px 4px 10px #d4a0a0, inset -4px -4px 10px #ffffff';
    setTimeout(() => (input.style.boxShadow = ''), 1200);
    input.focus();
    return;
  }

  // Estado de carga
  const btn = input.closest('.signup-form').querySelector('.btn-cta');
  setLoading(btn, true);

  try {
    const res = await fetch('/api/wishlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: val }),
    });

    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Algo salió mal. Intenta de nuevo.', 'error');
      return;
    }

    // Éxito: guardar email, limpiar input, abrir modal
    pendingEmail = val;
    input.value = '';
    showToast('🎉 ¡Ya estás en la lista!');
    openNewsletterModal();

  } catch (err) {
    console.error(err);
    showToast('Sin conexión. Revisa tu red e intenta de nuevo.', 'error');
  } finally {
    setLoading(btn, false);
  }
}

// ── Paso 2: Confirmar newsletter ──────────────────────────────
async function confirmNewsletter() {
  const btn = document.querySelector('.nl-btn-yes');
  setLoading(btn, true);

  // Capturamos y limpiamos pendingEmail ANTES de cerrar el modal
  // para que closeNewsletterModal no dispare un accept: false
  const emailToSend = pendingEmail;
  pendingEmail = '';

  try {
    const res = await fetch('/api/newsletter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailToSend, accept: true }),
    });

    const data = await res.json();
    _closeModalUI();

    if (!res.ok) {
      console.error('[newsletter]', data.error);
      return;
    }

    showToast('📧 ¡Suscrito al newsletter!');

  } catch (err) {
    console.error(err);
    _closeModalUI();
  } finally {
    setLoading(btn, false);
  }
}

// ── Rechazar newsletter / cerrar modal ────────────────────────
function _closeModalUI() {
  document.getElementById('nl-overlay').classList.remove('open');
  document.getElementById('nl-modal').classList.remove('open');
}

async function closeNewsletterModal() {
  _closeModalUI();

  // Solo registra el rechazo si el usuario cerró sin aceptar
  if (pendingEmail) {
    const email = pendingEmail;
    pendingEmail = '';
    try {
      await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, accept: false }),
      });
    } catch (_) {
      // Fallo silencioso
    }
  }
}

function openNewsletterModal() {
  document.getElementById('nl-overlay').classList.add('open');
  document.getElementById('nl-modal').classList.add('open');
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast' + (type === 'error' ? ' toast-error' : '');
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3200);
}

// ── Loading state ─────────────────────────────────────────────
function setLoading(btn, isLoading) {
  if (!btn) return;
  btn.disabled = isLoading;
  btn.style.opacity = isLoading ? '0.7' : '1';
  btn.style.cursor = isLoading ? 'wait' : '';
}

// ── Keyboard shortcuts ────────────────────────────────────────
document.querySelectorAll('.neu-input').forEach((el) => {
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSignup(el.id);
  });
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeNewsletterModal();
});

// ── Scroll reveal ─────────────────────────────────────────────
const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        io.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.06, rootMargin: '0px 0px -20px 0px' }
);

requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    document.querySelectorAll('[data-reveal]').forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight - 20) {
        el.classList.add('revealed');
      } else {
        el.classList.add('will-reveal');
        io.observe(el);
      }
    });
  });
});
