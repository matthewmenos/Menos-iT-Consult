/**
 * site-content.js — pulls admin-managed content into the public pages.
 *
 *   GET /api/content/settings      -> stats counters, WhatsApp/location hooks
 *   GET /api/content/testimonials  -> renders into #testiGrid (testimonials page)
 *   GET /api/content/projects      -> renders into #pfGrid (portfolio page)
 *
 * If the API is unreachable (or returns nothing published), the page keeps its
 * built-in static content, so the site degrades gracefully.
 *
 * Hooks used by this script (all optional):
 *   [data-stat="clients|years|satisfaction|projects"]  on counter elements (data-to)
 *   .wa-bubble / [data-contact="whatsapp"]             -> href set to https://wa.me/<digits>
 *   [data-contact="location|phone|email"]              -> textContent replaced
 *   #testiGrid                                         -> testimonial card grid
 *   #pfGrid                                            -> portfolio card grid
 */
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async function getJSON(url) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  /* ── settings ─────────────────────────────────────────────────────────── */
  function applySettings(data) {
    const stats = data.stats || {};
    const contact = data.contact || {};

    document.querySelectorAll('[data-stat]').forEach((el) => {
      const key = el.dataset.stat;
      const v = stats[key];
      if (v == null) return;
      el.setAttribute('data-to', String(v));
      el.textContent = String(v); // in case the count-up already ran
    });

    if (contact.whatsapp) {
      const href = 'https://wa.me/' + String(contact.whatsapp).replace(/[^0-9]/g, '');
      document.querySelectorAll('.wa-bubble, [data-contact="whatsapp"]').forEach((a) => {
        a.setAttribute('href', href);
      });
    }
    if (contact.location) {
      document.querySelectorAll('[data-contact="location"]').forEach((el) => {
        el.textContent = contact.location;
      });
    }
    if (contact.phone) {
      document.querySelectorAll('[data-contact="phone"]').forEach((el) => {
        el.textContent = contact.phone;
      });
    }
    if (contact.email) {
      document.querySelectorAll('[data-contact="email"]').forEach((el) => {
        if (el.tagName === 'A') {
          el.setAttribute('href', 'mailto:' + contact.email);
        }
        el.textContent = contact.email;
      });
    }
  }

  /* ── testimonials ─────────────────────────────────────────────────────── */
  function initialsOf(name) {
    const parts = String(name || '?').trim().split(/\s+/);
    return parts.slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('');
  }

  function starsHtml(rating) {
    const n = Math.max(1, Math.min(5, Number(rating) || 5));
    return '★'.repeat(n) + '<span style="opacity:.25">' + '★'.repeat(5 - n) + '</span>';
  }

  function hueFor(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
    return h;
  }

  function renderTestimonial(t) {
    const meta = [t.role, t.company].filter(Boolean).join(', ');
    const avatar = t.image
      ? '<img class="tcard-av tcard-av-img" src="' + esc(t.image) + '" alt="' + esc(t.name) + '" loading="lazy">'
      : '<div class="tcard-av" style="--h:' + hueFor(t.name || 'm') + '">' + esc(initialsOf(t.name)) + '</div>';
    const where = t.location ? ' · ' + esc(t.location) : '';
    return (
      '<div class="tcard reveal visible">' +
      '<div class="tcard-stars">' + starsHtml(t.rating) + '</div>' +
      '<p>"' + esc(t.quote) + '"</p>' +
      '<div class="tcard-author">' +
      avatar +
      '<div><strong>' + esc(t.name) + '</strong>' +
      '<span>' + esc(meta) + where + '</span></div>' +
      '</div></div>'
    );
  }

  async function initTestimonials() {
    const grid = document.getElementById('testiGrid');
    if (!grid) return;
    const list = await getJSON('/api/content/testimonials');
    if (!Array.isArray(list) || list.length === 0) return; // keep static fallback
    grid.innerHTML = list.map(renderTestimonial).join('');
  }

  /* ── projects ─────────────────────────────────────────────────────────── */
  const CAT_LABELS = {
    network: 'Network',
    security: 'Cybersecurity',
    cloud: 'Cloud',
    webdev: 'Web Dev',
    softdev: 'Software Dev',
    consult: 'Consulting',
    support: 'IT Support',
    data: 'Data',
  };

  /* compact line-art illustrations, one per category (site's stroke style) */
  const CAT_SVGS = {
    network: '<rect x="4" y="10" width="40" height="28" rx="3"/><path d="M4 20h40M14 38v6M34 38v6M10 44h28"/><circle cx="10" cy="15" r="1.5" fill="currentColor" stroke="none"/><circle cx="16" cy="15" r="1.5" fill="currentColor" stroke="none"/>',
    security: '<path d="M24 6l16 6v10c0 10-7 16-16 20-9-4-16-10-16-20V12l16-6z"/><path d="M17 24l5 5 9-10"/>',
    cloud: '<path d="M8 32a10 10 0 0 1 0-20 12 12 0 0 1 23.4-3A10 10 0 0 1 40 28"/><path d="M20 36v-10M28 36v-10M16 32l4-4 4 4M24 32l4-4 4 4"/>',
    webdev: '<rect x="4" y="6" width="40" height="32" rx="3"/><path d="M4 14h40"/><circle cx="10" cy="10" r="1.5" fill="currentColor" stroke="none"/><circle cx="16" cy="10" r="1.5" fill="currentColor" stroke="none"/><path d="M16 26l-6 3 6 3M32 26l6 3-6 3M22 34l4-12"/><path d="M14 42h20M24 38v4"/>',
    softdev: '<rect x="4" y="6" width="40" height="32" rx="3"/><path d="M4 14h40"/><rect x="10" y="20" width="10" height="10" rx="1"/><path d="M26 22h10M26 27h7"/><path d="M14 42h20M24 38v4"/>',
    consult: '<rect x="6" y="6" width="36" height="28" rx="3"/><path d="M6 18h36M18 34v8M30 34v8M14 42h20"/><path d="M16 12h4M26 12h6"/>',
    support: '<path d="M24 8a14 14 0 0 0-14 14v6a6 6 0 0 0 6 6h2v-12h-6M38 28a14 14 0 0 0-14-14"/>',
    data: '<rect x="10" y="28" width="6" height="12"/><rect x="21" y="20" width="6" height="20"/><rect x="32" y="12" width="6" height="28"/><path d="M10 20l11-8 8 4 11-8"/>',
  };

  function renderProject(p) {
    const svg = CAT_SVGS[p.category] || CAT_SVGS.consult;
    const label = CAT_LABELS[p.category] || 'Project';
    const visual = p.image
      ? '<img class="pf-img" src="' + esc(p.image) + '" alt="' + esc(p.title) + '" loading="lazy">'
      : '<svg class="pf-illustration" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + svg + '</svg>';
    const outcomes = Array.isArray(p.outcomes) ? p.outcomes : [];
    const tick = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    const arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';
    return (
      '<div class="pf-card' + (p.featured ? ' pf-featured' : '') + ' reveal visible" data-cat="' + esc(p.category) + '">' +
      '<div class="pf-visual">' +
      visual +
      '<span class="pf-tag tag-' + esc(p.category) + '">' + esc(label) + '</span>' +
      '</div>' +
      '<div class="pf-body">' +
      '<p class="pf-client">' + esc(p.client) + (p.location ? ' · ' + esc(p.location) : '') + '</p>' +
      '<h3>' + esc(p.title) + '</h3>' +
      '<p>' + esc(p.description) + '</p>' +
      (outcomes.length
        ? '<div class="pf-outcomes">' + outcomes.map((o) => '<span class="pf-outcome">' + tick + ' ' + esc(o) + '</span>').join('') + '</div>'
        : '') +
      '<div class="pf-card-foot">' +
      '<span class="pf-year">' + esc(p.year || '') + '</span>' +
      '<a href="/contact" class="pf-more">Similar project? ' + arrow + '</a>' +
      '</div></div></div>'
    );
  }

  async function initProjects() {
    const grid = document.getElementById('pfGrid');
    if (!grid) return;
    const list = await getJSON('/api/content/projects');
    if (!Array.isArray(list) || list.length === 0) return; // keep static fallback
    grid.innerHTML = list.map(renderProject).join('');
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const settings = await getJSON('/api/content/settings');
    if (settings && typeof settings === 'object') applySettings(settings);
    initTestimonials();
    initProjects();
  });
})();
