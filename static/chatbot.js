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
      const { reply } = await res.json();
      const hasHTML = /<[^>]+>/.test(reply);
      // show reply; we keep \n and let CSS (white-space: pre-line) render them
      appendMessage('bot', reply, !hasHTML);
    } catch {
      appendMessage('bot', 'Sorry, something went wrong.');
    }
  }

  // typewriter = true uses a safe textContent typewriter (preserves \n)
  function appendMessage(sender, text, typewriter = false) {
    const wrapper = document.createElement('div');
    wrapper.className = `message ${sender}`;
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    wrapper.appendChild(bubble);
    msgsEl.appendChild(wrapper);
    msgsEl.scrollTop = msgsEl.scrollHeight;

    if (!typewriter) {
      bubble.textContent = text; // ✅ preserve \n
      return;
    }

    // Safe typewriter with \n preservation
    let i = 0;
    (function typeChar() {
      if (i <= text.length) {
        bubble.textContent = text.slice(0, i); // ✅ preserve \n
        msgsEl.scrollTop = msgsEl.scrollHeight;
        i++;
        setTimeout(typeChar, 15);
      }
    })();
  }
});

