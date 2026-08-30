/* ──────────────────────────────────────────
   Menos iT Consult — vanilla JS
   Works offline / via file:// — no CDN.
   ────────────────────────────────────────── */

(() => {
  'use strict';

  /* ── Active nav link based on current page ── */
  const _seg = location.pathname.split('/').filter(Boolean).pop() || 'index';
  // Mark the Blog item active on article pages too (/blog/<slug>)
  let page = _seg.replace('.html', '');
  if (page !== 'blog' && location.pathname.startsWith('/blog/')) page = 'blog';
  document.querySelectorAll('.nav-links a[data-page]').forEach(a => {
    if (a.dataset.page === page) a.classList.add('active');
  });

  /* ── Scroll-reveal ── */
  const revealIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const siblings = Array.from(e.target.parentElement?.querySelectorAll('.reveal') || []);
      const idx = siblings.indexOf(e.target);
      e.target.style.transitionDelay = Math.min(idx * 0.07, 0.42) + 's';
      e.target.classList.add('visible');
      revealIO.unobserve(e.target);
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -5% 0px' });

  document.querySelectorAll('.reveal').forEach(el => revealIO.observe(el));

  /* ── Count-up numbers ── */
  const countIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      countUp(e.target);
      countIO.unobserve(e.target);
    });
  }, { threshold: 0.7 });

  document.querySelectorAll('.count').forEach(el => countIO.observe(el));

  function countUp(el) {
    const to = parseInt(el.dataset.to, 10);
    const duration = 1600;
    const start = performance.now();
    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * to);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ── Navbar scroll behaviour ── */
  const nav = document.getElementById('nav');
  let lastScroll = 0;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    nav.classList.toggle('scrolled', y > 20);
    nav.style.transform = (y > lastScroll && y > 120) ? 'translateY(-100%)' : 'translateY(0)';
    nav.style.transition = 'transform .4s cubic-bezier(.25,.46,.45,.94), box-shadow .3s';
    lastScroll = y;
  }, { passive: true });

  /* ── Mobile burger + drawer ── */
  const burger = document.getElementById('burger');
  const drawer = document.getElementById('drawer');
  if (burger && drawer) {
    burger.addEventListener('click', () => {
      const open = burger.classList.toggle('open');
      drawer.classList.toggle('open', open);
      document.body.style.overflow = open ? 'hidden' : '';
    });
    drawer.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        burger.classList.remove('open');
        drawer.classList.remove('open');
        document.body.style.overflow = '';
      });
    });
  }

  /* ── Smooth anchor scroll (same-page links only) ── */
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      const offset = target.getBoundingClientRect().top + window.scrollY - 72;
      window.scrollTo({ top: offset, behavior: 'smooth' });
    });
  });

  /* ── Page transition: fade out before navigating ── */
  document.querySelectorAll('a[href]').forEach(a => {
    a.addEventListener('click', (e) => {
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto') || href.startsWith('http') || href.startsWith('//') || a.target === '_blank') return;
      e.preventDefault();
      const main = document.querySelector('.page-transition, main');
      if (main) {
        main.style.transition = 'opacity .25s, transform .25s';
        main.style.opacity = '0';
        main.style.transform = 'translateY(-10px)';
      }
      setTimeout(() => { window.location.href = href; }, 240);
    });
  });

  /* ── Service card hover tilt ── */
  document.querySelectorAll('.service-card, .preview-card, .value-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const r = card.getBoundingClientRect();
      const x = e.clientX - r.left - r.width / 2;
      const y = e.clientY - r.top - r.height / 2;
      card.style.transform = `translateY(-5px) rotateX(${-(y / r.height) * 4}deg) rotateY(${(x / r.width) * 4}deg)`;
      card.style.transition = 'transform .08s';
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
      card.style.transition = 'transform .55s cubic-bezier(.16,1,.3,1), box-shadow .35s, border-color .3s';
    });
  });

  /* ── Hero cards float animation ── */
  if (!document.querySelector('#heroFloatKf')) {
    const style = document.createElement('style');
    style.id = 'heroFloatKf';
    style.textContent = `
      @keyframes cardFloat {
        0%,100% { transform: translateY(0); }
        50%      { transform: translateY(-7px); }
      }`;
    document.head.appendChild(style);
  }
  document.querySelectorAll('.hero-card').forEach((card, i) => {
    card.style.animation = `cardFloat ${2.8 + i * 0.35}s ease-in-out ${i * 0.3}s infinite`;
  });

  /* ── FAQ accordion ── */
  document.querySelectorAll('.faq-q').forEach(btn => {
    btn.addEventListener('click', () => {
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      // close all
      document.querySelectorAll('.faq-q').forEach(b => {
        b.setAttribute('aria-expanded', 'false');
        b.nextElementSibling?.classList.remove('open');
      });
      // open clicked if it was closed
      if (!expanded) {
        btn.setAttribute('aria-expanded', 'true');
        btn.nextElementSibling?.classList.add('open');
      }
    });
  });

  const API = '/api';

  /* ── Contact form ── */
  const contactForm = document.getElementById('contactForm');
  const formSuccess = document.getElementById('formSuccess');
  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = contactForm.querySelector('button[type="submit"]');
      const inputs = contactForm.querySelectorAll('input,select,textarea');

      // Serialize BEFORE disabling anything: FormData omits disabled controls,
      // so collecting values afterwards would always send an empty payload.
      const fd = new FormData(contactForm);
      const payload = Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v).trim()]));

      btn.textContent = 'Sending…';
      btn.disabled = true;
      inputs.forEach(el => el.disabled = true);

      try {
        const res  = await fetch(`${API}/contact`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();

        if (res.ok) {
          formSuccess.querySelector('p, span, div') || (formSuccess.textContent = data.message);
          formSuccess.classList.add('show');
          contactForm.reset();
          setTimeout(() => formSuccess.classList.remove('show'), 7000);
        } else {
          alert(data.error || 'Something went wrong. Please try again.');
        }
      } catch {
        alert('Could not reach the server. Please email us directly at minnahmat50@gmail.com');
      } finally {
        btn.textContent = 'Send Message';
        btn.disabled = false;
        inputs.forEach(el => el.disabled = false);
      }
    });
  }

  /* ── Newsletter form ── */
  const nlForms = document.querySelectorAll('.nl-form, #nlForm');
  nlForms.forEach(nlForm => {
    nlForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = nlForm.querySelector('input[type="email"]');
      const btn   = nlForm.querySelector('button');
      const email = input?.value.trim();
      if (!email) return;

      const origText = btn.textContent;
      btn.textContent = '…';
      btn.disabled = true;

      try {
        const res  = await fetch(`${API}/newsletter`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        btn.textContent = res.ok ? 'Subscribed ✓' : 'Try again';
        if (res.ok) nlForm.reset();
        setTimeout(() => {
          btn.textContent = origText;
          btn.disabled = false;
        }, 3500);
      } catch {
        btn.textContent = origText;
        btn.disabled = false;
        alert('Could not subscribe. Please try again later.');
      }
    });
  });

  /* ── Preloader ── */
  const preloader = document.getElementById('preloader');
  if (preloader) {
    const hide = () => preloader.classList.add('done');
    if (document.readyState === 'complete') {
      setTimeout(hide, 400);
    } else {
      window.addEventListener('load', () => setTimeout(hide, 400));
    }
  }

  /* ── Cookie consent banner ── */
  const cookieBanner  = document.getElementById('cookieBanner');
  const cookieAccept  = document.getElementById('cookieAccept');
  const cookieDecline = document.getElementById('cookieDecline');
  if (cookieBanner && !localStorage.getItem('mit_cookie_choice')) {
    setTimeout(() => cookieBanner.classList.add('show'), 1200);
  }
  if (cookieAccept) {
    cookieAccept.addEventListener('click', () => {
      localStorage.setItem('mit_cookie_choice', 'accepted');
      cookieBanner.classList.remove('show');
    });
  }
  if (cookieDecline) {
    cookieDecline.addEventListener('click', () => {
      localStorage.setItem('mit_cookie_choice', 'declined');
      cookieBanner.classList.remove('show');
    });
  }

  /* ── Testimonial marquee — duplicate items for seamless loop ── */
  const track = document.querySelector('.marquee-track');
  if (track) {
    track.innerHTML += track.innerHTML;
  }

})();
