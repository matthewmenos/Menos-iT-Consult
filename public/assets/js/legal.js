/* ─────────────────────────────────────────────
   legal.js — TOC active-link tracking
   ───────────────────────────────────────────── */

(() => {
  'use strict';

  const tocLinks = Array.from(document.querySelectorAll('.legal-toc ol a'));
  const sections = tocLinks.map(a => document.querySelector(a.getAttribute('href')));

  if (!tocLinks.length) return;

  const setActive = (idx) => {
    tocLinks.forEach((a, i) => a.classList.toggle('toc-active', i === idx));
  };

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const idx = sections.indexOf(entry.target);
        if (idx !== -1) setActive(idx);
      }
    });
  }, { rootMargin: '-10% 0px -75% 0px', threshold: 0 });

  sections.forEach(s => s && io.observe(s));

  /* smooth scroll for TOC clicks */
  tocLinks.forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      const target = document.querySelector(a.getAttribute('href'));
      if (!target) return;
      const top = target.getBoundingClientRect().top + window.scrollY - 88;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });
})();
