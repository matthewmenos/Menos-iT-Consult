/* =============================================================
   Menos iT Consult — Admin Dashboard SPA
   ============================================================= */

const API = '';  // same origin

// Track current editing state
let currentBlogId = null;

// ─────────────────────────────────────────────
// Utility: Toast notifications
// ─────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  document.getElementById('toast-container').appendChild(t);
  // Trigger transition
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 3000);
}

// ─────────────────────────────────────────────
// Utility: Format date
// ─────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

// ─────────────────────────────────────────────
// Auth helpers
// ─────────────────────────────────────────────
async function checkAuth() {
  try {
    const res = await fetch(`${API}/api/auth/me`, { credentials: 'include' });
    const data = await res.json();
    return data.loggedIn === true;
  } catch {
    return false;
  }
}

function showLogin() {
  document.getElementById('login-screen').style.display = '';
  document.getElementById('dashboard-shell').style.display = 'none';
}

function showDashboard() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('dashboard-shell').style.display = '';
}

// ─────────────────────────────────────────────
// Section navigation
// ─────────────────────────────────────────────
const SECTION_TITLES = {
  dashboard:    'Dashboard',
  blogs:        'Blog Posts',
  messages:     'Messages',
  newsletter:   'Newsletter',
  testimonials: 'Testimonials',
  settings:     'Settings',
};

function showSection(name) {
  // Hide all sections
  document.querySelectorAll('.section').forEach(s => s.style.display = 'none');
  // Show target section
  const target = document.getElementById(`section-${name}`);
  if (target) target.style.display = '';

  // Update active nav
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.section === name);
  });

  // Update page title
  document.getElementById('page-title').textContent = SECTION_TITLES[name] || name;

  // Close mobile sidebar
  document.querySelector('.sidebar').classList.remove('open');

  // Load data for the section
  switch (name) {
    case 'dashboard':   loadDashboard();   break;
    case 'blogs':       loadBlogs();       break;
    case 'messages':    loadMessages();    break;
    case 'newsletter':  loadNewsletter();  break;
    default: break;
  }
}

// ─────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────
async function loadDashboard() {
  try {
    const [blogsRes, msgsRes, subsRes] = await Promise.all([
      fetch(`${API}/api/blogs`, { credentials: 'include' }),
      fetch(`${API}/api/messages`, { credentials: 'include' }),
      fetch(`${API}/api/newsletter/subscribers`, { credentials: 'include' }),
    ]);

    const blogs = blogsRes.ok ? await blogsRes.json() : [];
    const msgs  = msgsRes.ok  ? await msgsRes.json()  : [];
    const subs  = subsRes.ok  ? await subsRes.json()  : { subscribers: [], count: 0 };

    const published = blogs.filter(b => b.status === 'published').length;
    const unread    = msgs.filter(m => !m.read).length;

    document.getElementById('stat-total-blogs').textContent     = blogs.length;
    document.getElementById('stat-published-blogs').textContent = published;
    document.getElementById('stat-total-messages').textContent  = msgs.length;
    document.getElementById('stat-unread-messages').textContent = unread;
    document.getElementById('stat-subscribers').textContent     = subs.count || (subs.subscribers || []).length;

    // Unread badge in sidebar
    updateUnreadBadge(unread);

    // Recent messages (latest 5)
    const tbody = document.getElementById('recent-messages-tbody');
    const recent = msgs.slice(0, 5);
    if (recent.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-row">No messages yet.</td></tr>';
    } else {
      tbody.innerHTML = recent.map(m => `
        <tr class="${!m.read ? 'unread-row' : ''}" style="cursor:pointer" onclick="viewMessage('${m.id}')">
          <td>${escHtml(m.name)}</td>
          <td>${escHtml(m.email)}</td>
          <td>${escHtml(m.service || '—')}</td>
          <td>${fmtDate(m.createdAt)}</td>
          <td><span class="status-pill ${m.read ? 'pill-read' : 'pill-unread'}">${m.read ? 'Read' : 'Unread'}</span></td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error('loadDashboard error:', err);
  }
}

function updateUnreadBadge(count) {
  const badge = document.getElementById('unread-badge');
  if (count > 0) {
    badge.textContent = count;
    badge.style.display = '';
  } else {
    badge.style.display = 'none';
  }
}

// ─────────────────────────────────────────────
// Blog Posts
// ─────────────────────────────────────────────
async function loadBlogs() {
  const tbody = document.getElementById('blogs-tbody');
  tbody.innerHTML = '<tr><td colspan="5" class="empty-row">Loading...</td></tr>';
  try {
    const res = await fetch(`${API}/api/blogs`, { credentials: 'include' });
    const blogs = await res.json();

    if (!Array.isArray(blogs) || blogs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-row">No blog posts yet. Click "+ New Post" to create one.</td></tr>';
      return;
    }

    // Sort newest first
    blogs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    tbody.innerHTML = blogs.map(b => `
      <tr>
        <td><strong>${escHtml(b.title || 'Untitled')}</strong>${b.featured ? ' <span class="status-pill pill-published" style="font-size:10px">Featured</span>' : ''}</td>
        <td>${escHtml(b.category || '—')}</td>
        <td><span class="status-pill ${b.status === 'published' ? 'pill-published' : 'pill-draft'}">${b.status}</span></td>
        <td>${fmtDate(b.createdAt)}</td>
        <td>
          <div class="action-btns">
            <button class="btn btn-sm btn-secondary" onclick="editBlog('${b.id}')">Edit</button>
            ${b.status === 'published'
              ? `<button class="btn btn-sm btn-secondary" onclick="unpublishBlog('${b.id}')">Unpublish</button>`
              : `<button class="btn btn-sm btn-primary" onclick="publishBlog('${b.id}')">Publish</button>`}
            <button class="btn btn-sm btn-danger" onclick="deleteBlog('${b.id}')">Delete</button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-row">Failed to load blog posts.</td></tr>';
    console.error('loadBlogs error:', err);
  }
}

async function publishBlog(id) {
  try {
    const res = await fetch(`${API}/api/blogs/${id}/publish`, { method: 'PATCH', credentials: 'include' });
    if (res.ok) { showToast('Post published!'); loadBlogs(); }
    else showToast('Failed to publish.', 'error');
  } catch { showToast('Network error.', 'error'); }
}

async function unpublishBlog(id) {
  try {
    const res = await fetch(`${API}/api/blogs/${id}/unpublish`, { method: 'PATCH', credentials: 'include' });
    if (res.ok) { showToast('Post moved to draft.'); loadBlogs(); }
    else showToast('Failed to unpublish.', 'error');
  } catch { showToast('Network error.', 'error'); }
}

async function deleteBlog(id) {
  if (!confirm('Are you sure you want to delete this blog post? This cannot be undone.')) return;
  try {
    const res = await fetch(`${API}/api/blogs/${id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) { showToast('Post deleted.'); loadBlogs(); }
    else showToast('Failed to delete.', 'error');
  } catch { showToast('Network error.', 'error'); }
}

async function editBlog(id) {
  try {
    const res = await fetch(`${API}/api/blogs/${id}`, { credentials: 'include' });
    if (!res.ok) { showToast('Failed to load post.', 'error'); return; }
    const blog = await res.json();
    currentBlogId = id;
    document.getElementById('modal-title').textContent = 'Edit Blog Post';
    document.getElementById('blog-title').value    = blog.title    || '';
    document.getElementById('blog-slug').value     = blog.slug     || '';
    document.getElementById('blog-category').value = blog.category || 'Security';
    document.getElementById('blog-readtime').value = blog.readTime || '';
    document.getElementById('blog-excerpt').value  = blog.excerpt  || '';
    document.getElementById('blog-content').value  = blog.content  || '';
    document.getElementById('blog-featured').checked = !!blog.featured;
    // Update preview
    document.getElementById('blog-preview').innerHTML = window.markdownToHtml(blog.content || '');
    openBlogModal();
  } catch { showToast('Network error.', 'error'); }
}

function openBlogModal() {
  document.getElementById('blog-modal').style.display = '';
  document.getElementById('blog-title').focus();
  window.initEditor();
}

function closeBlogModal() {
  document.getElementById('blog-modal').style.display = 'none';
  currentBlogId = null;
  // Reset form
  document.getElementById('blog-title').value    = '';
  document.getElementById('blog-slug').value     = '';
  document.getElementById('blog-category').value = 'Security';
  document.getElementById('blog-readtime').value = '';
  document.getElementById('blog-excerpt').value  = '';
  document.getElementById('blog-content').value  = '';
  document.getElementById('blog-featured').checked = false;
  document.getElementById('blog-preview').innerHTML = '';
  document.getElementById('modal-title').textContent = 'New Blog Post';
}

async function saveBlog() {
  const title   = document.getElementById('blog-title').value.trim();
  const slug    = document.getElementById('blog-slug').value.trim();
  const category= document.getElementById('blog-category').value;
  const readTime= document.getElementById('blog-readtime').value.trim();
  const excerpt = document.getElementById('blog-excerpt').value.trim();
  const content = document.getElementById('blog-content').value;
  const featured= document.getElementById('blog-featured').checked;

  if (!title) { showToast('Title is required.', 'error'); return; }

  const payload = { title, slug, category, readTime, excerpt, content, featured };
  const btn = document.getElementById('save-blog-btn');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    let res;
    if (currentBlogId) {
      res = await fetch(`${API}/api/blogs/${currentBlogId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      res = await fetch(`${API}/api/blogs`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }

    if (res.ok) {
      showToast(currentBlogId ? 'Post updated!' : 'Post created!');
      closeBlogModal();
      loadBlogs();
    } else {
      const err = await res.json();
      showToast(err.error || 'Failed to save.', 'error');
    }
  } catch {
    showToast('Network error.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Post';
  }
}

// ─────────────────────────────────────────────
// Messages
// ─────────────────────────────────────────────
let _messages = [];

async function loadMessages() {
  const tbody = document.getElementById('messages-tbody');
  tbody.innerHTML = '<tr><td colspan="6" class="empty-row">Loading...</td></tr>';
  try {
    const res = await fetch(`${API}/api/messages`, { credentials: 'include' });
    _messages = res.ok ? await res.json() : [];

    if (_messages.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-row">No messages yet.</td></tr>';
      updateUnreadBadge(0);
      return;
    }

    updateUnreadBadge(_messages.filter(m => !m.read).length);

    tbody.innerHTML = _messages.map(m => `
      <tr class="${!m.read ? 'unread-row' : ''}" style="cursor:pointer" onclick="viewMessage('${m.id}')">
        <td><strong>${escHtml(m.name)}</strong></td>
        <td>${escHtml(m.email)}</td>
        <td>${escHtml(m.service || '—')}</td>
        <td>${fmtDate(m.createdAt)}</td>
        <td><span class="status-pill ${m.read ? 'pill-read' : 'pill-unread'}">${m.read ? 'Read' : 'Unread'}</span></td>
        <td onclick="event.stopPropagation()">
          <div class="action-btns">
            ${!m.read ? `<button class="btn btn-sm btn-secondary" onclick="markRead('${m.id}')">Mark Read</button>` : ''}
            <button class="btn btn-sm btn-danger" onclick="deleteMessage('${m.id}')">Delete</button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-row">Failed to load messages.</td></tr>';
    console.error('loadMessages error:', err);
  }
}

async function viewMessage(id) {
  const msg = _messages.find(m => m.id === id);
  if (!msg) return;

  // Mark as read (fire-and-forget if already read)
  if (!msg.read) await markRead(id, false);

  const body = document.getElementById('message-detail-body');
  body.innerHTML = `
    <div class="msg-detail">
      <div class="msg-field">
        <label>From</label>
        <span>${escHtml(msg.name)}</span>
      </div>
      <div class="msg-field">
        <label>Email</label>
        <span><a href="mailto:${escHtml(msg.email)}" style="color:var(--blue)">${escHtml(msg.email)}</a></span>
      </div>
      ${msg.phone ? `<div class="msg-field"><label>Phone</label><span>${escHtml(msg.phone)}</span></div>` : ''}
      ${msg.service ? `<div class="msg-field"><label>Service</label><span>${escHtml(msg.service)}</span></div>` : ''}
      ${msg.source ? `<div class="msg-field"><label>Source</label><span>${escHtml(msg.source)}</span></div>` : ''}
      <div class="msg-field">
        <label>Date</label>
        <span>${fmtDateTime(msg.createdAt)}</span>
      </div>
      <div class="msg-field">
        <label>Message</label>
        <div class="msg-body">${escHtml(msg.message)}</div>
      </div>
    </div>
  `;
  document.getElementById('message-modal').style.display = '';
}

async function markRead(id, reload = true) {
  try {
    const res = await fetch(`${API}/api/messages/${id}/read`, { method: 'PATCH', credentials: 'include' });
    if (res.ok) {
      // Update local cache
      const m = _messages.find(m => m.id === id);
      if (m) m.read = true;
      if (reload) loadMessages();
    }
  } catch { /* silent */ }
}

async function deleteMessage(id) {
  if (!confirm('Delete this message? This cannot be undone.')) return;
  try {
    const res = await fetch(`${API}/api/messages/${id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) { showToast('Message deleted.'); loadMessages(); }
    else showToast('Failed to delete.', 'error');
  } catch { showToast('Network error.', 'error'); }
}

// ─────────────────────────────────────────────
// Newsletter
// ─────────────────────────────────────────────
async function loadNewsletter() {
  const tbody = document.getElementById('newsletter-tbody');
  const countEl = document.getElementById('subscriber-count');
  tbody.innerHTML = '<tr><td colspan="3" class="empty-row">Loading...</td></tr>';
  try {
    const res = await fetch(`${API}/api/newsletter/subscribers`, { credentials: 'include' });
    if (!res.ok) {
      tbody.innerHTML = '<tr><td colspan="3" class="empty-row">Failed to load subscribers.</td></tr>';
      return;
    }
    const data = await res.json();
    const subscribers = data.subscribers || [];
    countEl.textContent = `${subscribers.length} subscriber${subscribers.length !== 1 ? 's' : ''}`;

    if (subscribers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="empty-row">No subscribers yet.</td></tr>';
      return;
    }

    // Sort newest first
    const sorted = subscribers.slice().sort((a, b) => new Date(b.subscribedAt) - new Date(a.subscribedAt));

    tbody.innerHTML = sorted.map(s => `
      <tr>
        <td>${escHtml(s.email)}</td>
        <td>${fmtDate(s.subscribedAt)}</td>
        <td>
          <button class="btn btn-sm btn-danger" onclick="deleteSubscriber('${escAttr(s.email)}')">Remove</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="3" class="empty-row">Error loading subscribers.</td></tr>';
    console.error('loadNewsletter error:', err);
  }
}

async function deleteSubscriber(email) {
  if (!confirm(`Remove ${email} from the newsletter list?`)) return;
  try {
    const res = await fetch(`${API}/api/newsletter/subscribers/${encodeURIComponent(email)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.ok) { showToast('Subscriber removed.'); loadNewsletter(); }
    else {
      const err = await res.json();
      showToast(err.error || 'Failed to remove.', 'error');
    }
  } catch { showToast('Network error.', 'error'); }
}

// ─────────────────────────────────────────────
// Settings — change password
// ─────────────────────────────────────────────
document.getElementById('password-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const currentPassword = document.getElementById('current-password').value;
  const newPassword     = document.getElementById('new-password').value;
  const confirmPassword = document.getElementById('confirm-password').value;

  if (newPassword !== confirmPassword) {
    showToast('New passwords do not match.', 'error');
    return;
  }
  if (newPassword.length < 6) {
    showToast('New password must be at least 6 characters.', 'error');
    return;
  }

  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Updating...';

  try {
    const res = await fetch(`${API}/api/auth/password`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    if (data.success) {
      showToast('Password updated successfully!');
      e.target.reset();
    } else {
      showToast(data.error || 'Failed to update password.', 'error');
    }
  } catch {
    showToast('Network error.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Update Password';
  }
});

// ─────────────────────────────────────────────
// Login form
// ─────────────────────────────────────────────
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('login-error');
  errEl.style.display = 'none';
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Signing in...';

  try {
    const res = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: document.getElementById('login-username').value.trim(),
        password: document.getElementById('login-password').value,
      }),
    });
    const data = await res.json();
    if (data.success) {
      showDashboard();
      showSection('dashboard');
    } else {
      errEl.textContent = data.error || 'Login failed. Please try again.';
      errEl.style.display = 'block';
    }
  } catch {
    errEl.textContent = 'Network error. Is the server running?';
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
});

// ─────────────────────────────────────────────
// Logout
// ─────────────────────────────────────────────
document.getElementById('logout-btn').addEventListener('click', async () => {
  try {
    await fetch(`${API}/api/auth/logout`, { method: 'POST', credentials: 'include' });
  } catch { /* silent */ }
  showLogin();
});

// ─────────────────────────────────────────────
// Sidebar navigation
// ─────────────────────────────────────────────
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    showSection(item.dataset.section);
  });
});

// Mobile sidebar toggle
document.getElementById('sidebar-toggle').addEventListener('click', () => {
  document.querySelector('.sidebar').classList.toggle('open');
});

// ─────────────────────────────────────────────
// Blog modal controls
// ─────────────────────────────────────────────
document.getElementById('new-blog-btn').addEventListener('click', () => {
  currentBlogId = null;
  document.getElementById('modal-title').textContent = 'New Blog Post';
  openBlogModal();
});

document.getElementById('close-blog-modal').addEventListener('click', closeBlogModal);
document.getElementById('cancel-blog-btn').addEventListener('click', closeBlogModal);
document.getElementById('blog-modal-overlay').addEventListener('click', closeBlogModal);
document.getElementById('save-blog-btn').addEventListener('click', saveBlog);

// Auto-generate slug from title
document.getElementById('blog-title').addEventListener('input', (e) => {
  const slugInput = document.getElementById('blog-slug');
  // Only auto-generate if slug is empty or was auto-generated
  const currentSlug = slugInput.value;
  const expectedSlug = slugFromTitle(document.getElementById('blog-title').value);
  // Update if blank or matches previous auto value
  if (!currentSlug || currentSlug === slugFromTitle(e.target._prevTitle || '')) {
    slugInput.value = slugFromTitle(e.target.value);
  }
  e.target._prevTitle = e.target.value;
});

function slugFromTitle(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// ─────────────────────────────────────────────
// Message modal controls
// ─────────────────────────────────────────────
document.getElementById('close-message-modal').addEventListener('click', () => {
  document.getElementById('message-modal').style.display = 'none';
  // Reload to show updated read status
  const activeSection = document.querySelector('.nav-item.active')?.dataset.section;
  if (activeSection === 'messages') loadMessages();
  else loadDashboard();
});

document.getElementById('close-msg-btn').addEventListener('click', () => {
  document.getElementById('message-modal').style.display = 'none';
  const activeSection = document.querySelector('.nav-item.active')?.dataset.section;
  if (activeSection === 'messages') loadMessages();
  else loadDashboard();
});

document.getElementById('message-modal-overlay').addEventListener('click', () => {
  document.getElementById('message-modal').style.display = 'none';
  const activeSection = document.querySelector('.nav-item.active')?.dataset.section;
  if (activeSection === 'messages') loadMessages();
  else loadDashboard();
});

// ─────────────────────────────────────────────
// Security helpers
// ─────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escAttr(str) {
  if (!str) return '';
  return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// ─────────────────────────────────────────────
// Keyboard shortcuts
// ─────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (document.getElementById('blog-modal').style.display !== 'none') closeBlogModal();
    if (document.getElementById('message-modal').style.display !== 'none') {
      document.getElementById('message-modal').style.display = 'none';
    }
  }
});

// ─────────────────────────────────────────────
// Initialise
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const loggedIn = await checkAuth();
  if (loggedIn) {
    showDashboard();
    showSection('dashboard');
  } else {
    showLogin();
  }
});
