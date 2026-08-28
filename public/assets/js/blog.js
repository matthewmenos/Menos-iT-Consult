/* ─────────────────────────────────────────────────────────────
   Menos iT Consult — shared public blog helpers
   Used by blog.html (article grid) and blog-post.html (single
   article) to load published posts from the backend API and
   render them safely (escaping, no frameworks).
   ───────────────────────────────────────────────────────────── */
window.blog = (() => {
  'use strict';

  const API = '/api';

  // Category tokens (from the admin dashboard's category list) → display
  // label + the CSS colour class already defined in blog.css.
  const CATEGORY_MAP = {
    security: { label: 'Cybersecurity', cls: 'cat-security' },
    cloud:    { label: 'Cloud',         cls: 'cat-cloud' },
    network:  { label: 'Network',       cls: 'cat-network' },
    webdev:   { label: 'Web Dev',       cls: 'cat-webdev' },
    software: { label: 'Software',      cls: 'cat-software' },
    business: { label: 'Business IT',   cls: 'cat-business' },
    tips:     { label: 'Quick Tips',    cls: 'cat-tips' },
  };

  function escHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escAttr(str) {
    if (str == null) return '';
    return String(str).replace(/'/g, '&#39;').replace(/"/g, '&quot;');
  }

  // 'Security' | 'Web Dev' | 'Anything Else' → { key, label, cls }
  function categoryMeta(category) {
    const key = (category || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    const meta = CATEGORY_MAP[key] || { label: category || 'Article', cls: '' };
    return { key, label: meta.label, cls: meta.cls };
  }

  function postUrl(slug) {
    return slug ? '/blog/' + encodeURIComponent(slug) : '#';
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-GB', {
      month: 'long', year: 'numeric',
    });
  }

  /* Markdown → HTML for article bodies. Matches the syntax the admin editor
     produces: #/##/### headings, **bold**, *italic*, `code`, [text](url) and
     "- item" lists. Input is escaped first, so admin-authored content can
     never inject raw HTML. */
  function markdownToHtml(md) {
    if (!md) return '';
    let html = escHtml(md);

    html = html
      // Headings (before inline formatting so `## **bold**` still works)
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      // Inline code (before bold/italic so ** inside code stays literal)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // Bold
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Links
      .replace(
        /\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,
        '<a href="$2" target="_blank" rel="noopener">$1</a>'
      );

    // Unordered markdown lists ("- item")
    html = html.replace(/(?:^|\n)((?:\s*[-*] .*(?:\n|$))+)/g, (_m, block) => {
      const items = block
        .split('\n')
        .map(line => line.replace(/^\s*[-*] /, '').trim())
        .filter(Boolean)
        .map(item => `<li>${item}</li>`)
        .join('');
      return `\n<ul>${items}</ul>\n`;
    });

    // Paragraph wrapping: blank line = new paragraph, block elements stay raw
    const out = [];
    let para = [];
    const flush = () => {
      if (para.length) out.push(`<p>${para.join('<br>')}</p>`);
      para = [];
    };
    for (const line of html.split('\n')) {
      const t = line.trim();
      if (!t) { flush(); continue; }
      if (/^<(h[1-6]|ul|ol|blockquote|pre|table|p|li)/.test(t)) {
        flush(); out.push(line);
      } else {
        para.push(line);
      }
    }
    flush();
    return out.join('\n');
  }

  return { API, escHtml, escAttr, categoryMeta, postUrl, fmtDate, markdownToHtml };
})();