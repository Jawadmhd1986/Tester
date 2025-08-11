/* ==========================================================================
   DSV Chatbot — full drop‑in JS
   - Keeps bot newlines (like your 2nd screenshot) via injected CSS
   - Mobile-safe: sticks composer above the keyboard (iOS/Android)
   - Calls /chat backend; falls back to local logic if offline
   - No HTML/CSS edits required
   ========================================================================== */

(() => {
  // Flexible selectors so it works with your existing HTML
  const SELECTORS = {
    chat: '#chat, .chat-window, #chat-window',
    form: '#composer, form.chat-composer, #chat-form',
    input: '#prompt, .chat-input, input[name="prompt"], #chat-input',
    send: '#send, .chat-send, button[type="submit"]'
  };

  /* ---------- utils ---------- */
  function $(selector) {
    const list = selector.split(',').map(s => s.trim());
    for (const s of list) {
      const el = document.querySelector(s);
      if (el) return el;
    }
    return null;
  }

  function ensureStyles() {
    if (document.getElementById('chatbot-runtime-styles')) return;
    const style = document.createElement('style');
    style.id = 'chatbot-runtime-styles';
    style.textContent = `
      /* Preserve line breaks + prevent overflow in bot bubbles */
      .message.bot .message-text,
      .chat-bubble.bot .message-text,
      .bot-message .message-text,
      .message.bot,
      .chat-bubble.bot,
      .bot-message {
        white-space: pre-line !important;  /* <-- key fix */
        word-break: break-word;
        line-height: 1.42;
      }

      /* Smooth scrolling & mobile-friendly container */
      #chat, .chat-window, #chat-window {
        -webkit-overflow-scrolling: touch;
        scroll-behavior: smooth;
        overscroll-behavior: contain;
      }

      /* Keep composer visible above iOS/Android keyboards */
      #composer, form.chat-composer, #chat-form {
        position: sticky;
        bottom: 0;
        background: transparent;
        padding-bottom: max(8px, env(safe-area-inset-bottom));
        z-index: 5;
      }

      /* Prefer dynamic viewport on modern browsers */
      @supports (height: 100dvh) {
        #chat, .chat-window, #chat-window {
          height: 60dvh;
        }
      }

      /* Small screens: give messages more width and a taller viewport */
      @media (max-width: 640px) {
        #chat, .chat-window, #chat-window {
          height: 65dvh;
        }
        .message .message-text { max-width: 92vw; }
      }
    `;
    document.head.appendChild(style);
  }

  function init() {
    ensureStyles();

    const chatEl = $(SELECTORS.chat);
    const formEl = $(SELECTORS.form);
    const inputEl = $(SELECTORS.input);
    const sendEl = $(SELECTORS.send);

    if (!chatEl || !formEl || !inputEl) {
      console.error('Chatbot init: required elements not found.');
      return;
    }

    /* ---- Mobile keyboard / safe-area handling ---- */
    if (window.visualViewport) {
      const vv = window.visualViewport;
      const adjust = () => {
        const inset = Math.max(0, (window.innerHeight - vv.height));
        chatEl.style.paddingBottom = `calc(${inset}px + env(safe-area-inset-bottom))`;
        formEl.style.bottom = `${inset}px`;
      };
      vv.addEventListener('resize', adjust);
      vv.addEventListener('scroll', adjust);
      window.addEventListener('orientationchange', () => setTimeout(adjust, 250));
      adjust();
    }

    // Scroll to bottom when focusing the input (helps on mobile)
    inputEl.addEventListener('focus', () => {
      setTimeout(() => chatEl.scrollTop = chatEl.scrollHeight, 100);
    });

    // Enter to send; Shift+Enter for newline
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        formEl.requestSubmit
          ? formEl.requestSubmit()
          : formEl.dispatchEvent(new Event('submit', { cancelable: true }));
      }
    });

    // Submit handler
    formEl.addEventListener('submit', onSend);

    // Optional: show a hint message if chat is empty
    if (!chatEl.querySelector('.message')) {
      appendMessage(chatEl, 'bot',
        'Welcome! Ask me about DSV storage, VAS, fleet, routes, or facilities.\nTry: "fleet" to see bullet formatting.'
      );
    }
  }

  async function onSend(e) {
    e.preventDefault();
    const chatEl = $(SELECTORS.chat);
    const formEl = $(SELECTORS.form);
    const inputEl = $(SELECTORS.input);
    const sendEl = $(SELECTORS.send);

    const text = inputEl.value.trim();
    if (!text) return;

    appendMessage(chatEl, 'user', text);
    inputEl.value = '';
    inputEl.focus();
    if (sendEl) sendEl.disabled = true;

    try {
      const reply = await getReply(text);
      appendMessage(chatEl, 'bot', reply);
    } catch (err) {
      console.error(err);
      appendMessage(chatEl, 'bot', 'Sorry, I had trouble responding just now. Please try again.');
    } finally {
      if (sendEl) sendEl.disabled = false;
    }
  }

  /* ---------- Render helpers ---------- */
  function appendMessage(chatEl, role, text) {
    const row = document.createElement('div');
    row.className = `message ${role}`;

    const bubble = document.createElement('div');
    bubble.className = 'message-text';

    // Keep it safe; preserve \n (CSS shows them as real line breaks)
    bubble.textContent = text;

    row.appendChild(bubble);
    chatEl.appendChild(row);
    chatEl.scrollTop = chatEl.scrollHeight;
  }

  /* ---------- Backend + fallback logic ---------- */
  async function getReply(userText) {
    // Try your Flask /chat route first
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000); // 20s timeout
      const res = await fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText }),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (res.ok) {
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const data = await res.json();
          const reply = data.reply ?? data.message ?? data.text;
          if (reply) return String(reply);
        } else {
          const txt = await res.text();
          if (txt) return String(txt);
        }
        // fall through to local if nothing useful returned
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (_err) {
      // ignore and use local fallback
    }
    return localBot(userText);
  }

  // Local "main chatbot logic" (concise, covers common DSV topics).
  // Your Flask bot has the full knowledge; this is just an offline safety net.
  function localBot(text) {
    const q = normalize(text);

    if (match(q, ['fleet','trucks','vehicle types','transport fleet'])) {
      return `DSV operates a large fleet in the UAE including:
- Flatbed trailers
- Box trucks
- Double trailers
- Reefer trucks (chiller/freezer)
- Lowbeds
- Tippers
- Small city delivery trucks

Fleet vehicles support all types of transport including full truckload (FTL), LTL, and container movements.`;
    }

    if (match(q, ['hello','hi','hey','good morning','good evening'])) {
      return 'Hello! How can I help you today with storage, VAS, transport, or DSV services?';
    }

    if (match(q, ['storage rate','storage rates','ac storage','non ac storage','open shed','open yard','warehouse storage'])) {
      return `Which storage type do you need the rate for?
- AC (temperature-controlled)
- Non‑AC / Open Shed
- Open Yard

Tell me e.g. “AC storage rate” or “Open Yard rate”.`;
    }

    if (match(q, ['standard vas','ac vas','non ac vas','open shed vas'])) {
      return `Standard VAS (for AC/Non‑AC/Open Shed) includes:
- Handling in/out (per pallet)
- Palletization / de‑palletization
- Case/each picking
- Labeling & relabeling
- Packing with pallet / shrink wrap
- Loading / offloading
- Cycle count / stock take
- WMS transaction fees (for warehouse storage types)

Say a quantity to calculate, e.g., “calculate packing with pallet for 15 pallets”.`;
    }

    if (match(q, ['chemical vas','chem vas'])) {
      return `Chemical VAS includes:
- Handling in/out (per pallet)
- Packing with pallet
- Labeling (incl. hazard labels)
- MSDS handling requirement
- Case/each picking
- Loading/offloading

Provide quantities and I’ll calculate: “handling in 20 pallets (chemical)”.`;
    }

    if (match(q, ['21k','mussafah warehouse','racks','aisle width'])) {
      return `DSV’s 21K warehouse (21,000 sqm, 15 m clear height) supports:
- Rack types: Selective, VNA, Drive‑in
- Aisle widths: Selective 2.95–3.3 m, VNA 1.95 m, Drive‑in 2.0 m
- Rack height: 12 m with 6 pallet levels
- Pallets: Standard & Euro (14 Standard or 21 Euro per bay).`;
    }

    if (match(q, ['md','managing director','who is our ceo','ceo abu dhabi'])) {
      return 'Mr. Hossam Mahmoud is the Managing Director, Road & Solutions and CEO of DSV Abu Dhabi.';
    }

    if (match(q, ['occupancy','warehouse occupancy','space availability'])) {
      return 'For warehouse occupancy contact Biju Krishnan at biju.krishnan@dsv.com';
    }

    if (match(q, ['transport rate','transport availability','truck availability','book a truck','transport contact'])) {
      return 'For transport rates and availability, contact the OCC team: Ronnell Toring at ronnell.toring@dsv.com';
    }

    if (match(q, ['distance abu dhabi to dubai','distance between emirates','distances km'])) {
      return `Approximate road distances (one‑way):
- Abu Dhabi ↔ Dubai: 140–150 km
- Abu Dhabi ↔ Sharjah: 160–170 km
- Dubai ↔ Sharjah: 25–35 km
- Dubai ↔ Fujairah: 120–130 km
- Abu Dhabi ↔ Fujairah: 260–280 km`;
    }

    if (match(q, ['temperature zone','cold room','freezer','chiller'])) {
      return `Warehouse temperature zones:
- Temperature‑controlled: +18°C to +25°C
- Cold room: +2°C to +8°C
- Freezer: –22°C`;
    }

    return 'I can help with DSV storage, VAS, fleet, routes, and warehouse details. Try “fleet”, “AC storage rate”, “standard VAS list”, or “distance from Abu Dhabi to Dubai”.';
  }

  function normalize(t) {
    return String(t || '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function match(q, keywords) {
    return keywords.some(kw => q.includes(kw));
  }

  // boot
  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init)
    : init();
})();
