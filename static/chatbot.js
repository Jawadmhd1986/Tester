// Fix for mobile viewport height
window.addEventListener('load', () => {
  let vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
});
window.addEventListener('resize', () => {
  let vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
});

// Main chatbot logic
document.addEventListener('DOMContentLoaded', () => {
  const chatBox    = document.getElementById('chat-box');
  const chatToggle = document.querySelector('.chat-toggle');
  const chatClose  = document.getElementById('chat-close');
  const sendBtn    = document.getElementById('chat-send');
  const inputEl    = document.getElementById('chat-input');
  const msgsEl     = document.getElementById('chat-messages');

  chatToggle.addEventListener('click', () => chatBox.classList.toggle('open'));
  chatClose .addEventListener('click', () => chatBox.classList.remove('open'));
  sendBtn   .addEventListener('click', sendMessage);
  inputEl   .addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text) return;
    appendMessage('user', text);
    inputEl.value = '';

    try {
      const res = await fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });
      const data = await res.json();
      const reply = data.reply ?? 'Sorry, something went wrong.';
      appendMessage('bot', reply, true); // typewriter with links
    } catch {
      appendMessage('bot', 'Sorry, something went wrong.');
    }
  }

  // --- helpers ---
function escapeHTML(s) {
  return String(s)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#39;');
}
function linkify(safe) {
  // turn plain http/https into links
  const urlRe = /(https?:\/\/[^\s<]+)/g;
  return safe.replace(urlRe, (u) =>
    `<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`
  );
}
function keepOnlyAnchors(html) {
  // keep <a ...>..</a>, escape everything else, keep \n as <br>
  let out = String(html)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;');
  out = out.replace(/&lt;a\b([\s\S]*?)&gt;/gi, '<a$1>')
           .replace(/&lt;\/a&gt;/gi, '</a>');
  out = out.replace(/\n/g,'<br>');
  // force rel/target for safety
  out = out.replace(/<a\s+href="([^"]+)"([^>]*)>/gi,
    (m, href) => `<a href="${href}" target="_blank" rel="noopener noreferrer">`);
  return out;
}
function finalBotHTML(text) {
  if (/<a\s+href=/i.test(text)) {
    // server already sent an anchor; sanitize but keep it
    return keepOnlyAnchors(text);
  }
  // otherwise: escape, linkify plain URLs, and add <br> for newlines
  const safe = escapeHTML(text);
  return linkify(safe).replace(/\n/g,'<br>');
}

// --- unified appendMessage with typewriter ---
function appendMessage(sender, text, typewriter = false) {
  const wrapper = document.createElement('div');
  wrapper.className = `message ${sender}`;
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  wrapper.appendChild(bubble);
  msgsEl.appendChild(wrapper);
  msgsEl.scrollTop = msgsEl.scrollHeight;

  // Users or non-typewriter path
  if (sender !== 'bot' || !typewriter) {
    if (sender === 'bot') {
      bubble.innerHTML = finalBotHTML(text);
    } else {
      bubble.textContent = text; // user text, preserve \n via CSS pre-line
    }
    return;
  }

  // Bot + typewriter: type safely, then swap to linkified HTML at the end
  let i = 0;
  (function tick() {
    if (i <= text.length) {
      bubble.textContent = text.slice(0, i);
      msgsEl.scrollTop = msgsEl.scrollHeight;
      i++;
      setTimeout(tick, 15);
    } else {
      bubble.innerHTML = finalBotHTML(text); // make any links clickable
    }
  })();
}
