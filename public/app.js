// ---- Supabase ----
const SUPABASE_URL = 'https://vduqcuoouudqqmlibbxm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkdXFjdW9vdXVkcXFtbGliYnhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4Mzk5NTQsImV4cCI6MjA5MTQxNTk1NH0.jqS1pfemgBUzGJmic37yfHswlB-pqPMomTsbK4e9L34';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---- Confetti ----
(function spawnConfetti() {
  const container = document.getElementById('confetti');
  const colors = ['#ff6eb4','#ffe066','#b48aff','#6ee7b7','#60a5fa','#fb923c'];
  for (let i = 0; i < 50; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.left = Math.random() * 100 + 'vw';
    el.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    el.style.width  = (6 + Math.random() * 8) + 'px';
    el.style.height = (6 + Math.random() * 8) + 'px';
    el.style.borderRadius = Math.random() > .5 ? '50%' : '2px';
    const duration = 4 + Math.random() * 8;
    el.style.animationDuration  = duration + 's';
    el.style.animationDelay     = (Math.random() * duration) + 's';
    container.appendChild(el);
  }
})();

// ---- Lightbox ----
const lightbox = document.createElement('div');
lightbox.className = 'lightbox';
lightbox.innerHTML = '<button class="lightbox-close" aria-label="Close">✕</button><img alt="Expanded photo" />';
document.body.appendChild(lightbox);
const lightboxImg = lightbox.querySelector('img');

function openLightbox(src) {
  lightboxImg.src = src;
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeLightbox() {
  lightbox.classList.remove('open');
  document.body.style.overflow = '';
}
lightbox.addEventListener('click', (e) => { if (e.target !== lightboxImg) closeLightbox(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });

// ---- DOM refs ----
const form          = document.getElementById('post-form');
const nameInput     = document.getElementById('name');
const textInput     = document.getElementById('text');
const imageInput    = document.getElementById('image');
const charCount     = document.getElementById('char-count');
const fileName      = document.getElementById('file-name');
const removeBtn     = document.getElementById('remove-image');
const previewWrap   = document.getElementById('image-preview-wrapper');
const preview       = document.getElementById('image-preview');
const formError     = document.getElementById('form-error');
const submitBtn     = document.getElementById('submit-btn');
const submitLabel   = document.getElementById('submit-label');
const submitSpinner = document.getElementById('submit-spinner');
const board         = document.getElementById('board');
const boardLoading  = document.getElementById('board-loading');

// ---- Char counter ----
textInput.addEventListener('input', () => {
  charCount.textContent = `${textInput.value.length} / 1000`;
});

// ---- Image preview ----
imageInput.addEventListener('change', () => {
  const file = imageInput.files[0];
  if (!file) return;
  fileName.textContent = file.name;
  removeBtn.hidden = false;
  const reader = new FileReader();
  reader.onload = (e) => {
    preview.src = e.target.result;
    previewWrap.hidden = false;
  };
  reader.readAsDataURL(file);
});

removeBtn.addEventListener('click', () => {
  imageInput.value = '';
  fileName.textContent = 'Choose image…';
  removeBtn.hidden = true;
  previewWrap.hidden = true;
  preview.src = '';
});

// ---- Helpers ----
function showError(msg) {
  formError.textContent = msg;
  formError.hidden = false;
}
function clearError() {
  formError.hidden = true;
  formError.textContent = '';
}
function setLoading(on) {
  submitBtn.disabled = on;
  submitLabel.hidden = on;
  submitSpinner.hidden = !on;
}
function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ---- Render a single card ----
function createCard(msg) {
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.id = msg.id;

  if (msg.image_url) {
    const img = document.createElement('img');
    img.className = 'card-image';
    img.src = msg.image_url;
    img.alt = `Photo from ${msg.name}`;
    img.loading = 'lazy';
    img.addEventListener('click', () => openLightbox(msg.image_url));
    card.appendChild(img);
  }

  const body = document.createElement('div');
  body.className = 'card-body';

  const name = document.createElement('div');
  name.className = 'card-name';
  name.textContent = msg.name;

  const text = document.createElement('div');
  text.className = 'card-text';
  text.textContent = msg.text;

  const footer = document.createElement('div');
  footer.className = 'card-footer';

  const date = document.createElement('span');
  date.className = 'card-date';
  date.textContent = formatDate(msg.created_at);

  const del = document.createElement('button');
  del.className = 'delete-btn';
  del.title = 'Delete';
  del.textContent = '✕';
  del.addEventListener('click', () => deleteMessage(msg.id, msg.image_url, card));

  footer.appendChild(date);
  footer.appendChild(del);
  body.appendChild(name);
  body.appendChild(text);
  body.appendChild(footer);
  card.appendChild(body);

  return card;
}

// ---- Load messages ----
async function loadMessages() {
  try {
    const { data: messages, error } = await sb
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    boardLoading.remove();

    if (messages.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'board-empty';
      empty.id = 'board-empty';
      empty.textContent = 'No messages yet — be the first to post! 🎉';
      board.appendChild(empty);
    } else {
      messages.forEach((msg) => board.appendChild(createCard(msg)));
    }
  } catch {
    boardLoading.textContent = 'Could not load messages.';
  }
}

// ---- Delete message ----
async function deleteMessage(id, imageUrl, card) {
  if (!confirm('Delete this message?')) return;
  try {
    const { error } = await sb.from('messages').delete().eq('id', id);
    if (error) throw error;

    // Best-effort: remove image from storage
    if (imageUrl) {
      const key = imageUrl.split('/message-images/')[1];
      if (key) await sb.storage.from('message-images').remove([key]);
    }

    card.style.transition = 'opacity .3s, transform .3s';
    card.style.opacity = '0';
    card.style.transform = 'scale(.85)';
    setTimeout(() => {
      card.remove();
      if (!board.querySelector('.card')) {
        const empty = document.createElement('div');
        empty.className = 'board-empty';
        empty.id = 'board-empty';
        empty.textContent = 'No messages yet — be the first to post! 🎉';
        board.appendChild(empty);
      }
    }, 300);
  } catch {
    alert('Could not delete message.');
  }
}

// ---- Submit form ----
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError();

  const nameVal = nameInput.value.trim();
  const textVal = textInput.value.trim();

  if (!nameVal) { showError('Please enter your name.'); nameInput.focus(); return; }
  if (!textVal) { showError('Please write a message.'); textInput.focus(); return; }

  setLoading(true);
  try {
    // Upload image if present
    let imageUrl = null;
    const file = imageInput.files[0];
    if (file) {
      const ext = file.name.split('.').pop().toLowerCase();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await sb.storage
        .from('message-images')
        .upload(path, file);
      if (uploadError) throw new Error('Image upload failed: ' + uploadError.message);
      const { data: urlData } = sb.storage.from('message-images').getPublicUrl(path);
      imageUrl = urlData.publicUrl;
    }

    // Insert message
    const { data: message, error } = await sb
      .from('messages')
      .insert({ name: nameVal.slice(0, 60), text: textVal.slice(0, 1000), image_url: imageUrl })
      .select()
      .single();
    if (error) throw error;

    // Remove empty-state placeholder if present
    const emptyEl = document.getElementById('board-empty');
    if (emptyEl) emptyEl.remove();

    // Prepend new card
    board.insertBefore(createCard(message), board.firstChild);

    // Reset form
    form.reset();
    charCount.textContent = '0 / 1000';
    fileName.textContent = 'Choose image…';
    removeBtn.hidden = true;
    previewWrap.hidden = true;
    preview.src = '';

    board.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    showError(err.message || 'Something went wrong. Please try again.');
  } finally {
    setLoading(false);
  }
});

// ---- Init ----
loadMessages();
