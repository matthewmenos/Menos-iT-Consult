// Markdown to HTML converter for live preview
function markdownToHtml(md) {
  if (!md) return '';
  let html = md
    // Headings (must be processed before bold/italic)
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

  // Wrap non-tagged lines in paragraphs
  html = html
    .split(/\n\n+/)
    .map(p => {
      const trimmed = p.trim();
      if (!trimmed) return '';
      // Already wrapped in a block element? leave it
      if (/^<(h[1-6]|ul|ol|li|blockquote|pre|table)/.test(trimmed)) return trimmed;
      return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
    })
    .join('\n');

  return html;
}

// Initialize editor — wires up live preview and toolbar buttons
function initEditor() {
  const contentArea = document.getElementById('blog-content');
  const preview = document.getElementById('blog-preview');
  if (!contentArea || !preview) return;

  // Live preview on input
  contentArea.addEventListener('input', () => {
    preview.innerHTML = markdownToHtml(contentArea.value);
  });

  // Toolbar actions — insert markdown at cursor
  document.querySelectorAll('.toolbar-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      const start = contentArea.selectionStart;
      const end = contentArea.selectionEnd;
      const selected = contentArea.value.substring(start, end);
      let replacement = '';

      switch (action) {
        case 'bold':
          replacement = `**${selected || 'bold text'}**`;
          break;
        case 'italic':
          replacement = `*${selected || 'italic text'}*`;
          break;
        case 'heading':
          replacement = `## ${selected || 'Heading'}`;
          break;
        case 'link': {
          const url = prompt('Enter URL:', 'https://');
          if (url) {
            replacement = `[${selected || 'link text'}](${url})`;
          } else {
            return;
          }
          break;
        }
        default:
          return;
      }

      const before = contentArea.value.substring(0, start);
      const after  = contentArea.value.substring(end);
      contentArea.value = before + replacement + after;

      // Move cursor to end of replacement
      const newPos = start + replacement.length;
      contentArea.setSelectionRange(newPos, newPos);

      // Trigger live preview update
      contentArea.dispatchEvent(new Event('input'));
      contentArea.focus();
    });
  });
}

// Expose to app.js
window.markdownToHtml = markdownToHtml;
window.initEditor = initEditor;
