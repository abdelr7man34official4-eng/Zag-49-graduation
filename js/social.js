/* =========================================================================
   رسائل الكروت + حائط الذكريات — موقع دفعة 49
   =========================================================================
   الملف ده مستقل تماماً عن script.js (بيقرأ منه قائمة students بس).
   بيشتغل فقط لما تملا إعدادات Firebase في js/firebase-config.js،
   ولو لسه مملتهاش الموقع بيفضل زي ما هو بالظبط.

   الفكرة:
   - الضغط على كارت طالب  -> نافذة فيها: ابعتله رسالة / شوف الرسائل
   - "ده كارتي" بتخلي المتصفح ده يعرف كارتك، فتظهرلك نقطة حمرا (زي الآيفون)
     على كارتك لما حد يبعتلك رسالة جديدة.
   - حائط الذكريات: أي حد يقدر يكتب ذكرى، وأي حد يقدر يعلّق عليها.
   ========================================================================= */
(function socialFeatures() {
  'use strict';

  const FB_VERSION = '10.12.2';
  const LIMITS = { message: 600, memory: 700, comment: 300, name: 40 };
  const COOLDOWN_MS = 15000; // مدة الانتظار بين كل رسالتين من نفس الجهاز (ضد السبام)

  /* ---------------- أدوات صغيرة ---------------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>'"]/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[c]));

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };

  function formatWhen(ts) {
    if (!ts) return 'دلوقتي';
    const d = new Date(ts);
    try {
      return d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' }) + ' • ' +
        d.toLocaleTimeString('ar-EG', { hour: 'numeric', minute: '2-digit' });
    } catch (e) { return d.toLocaleString(); }
  }

  function tsOf(data) {
    const t = data && data.createdAt;
    if (!t) return Date.now();
    if (typeof t.toMillis === 'function') return t.toMillis();
    if (typeof t === 'number') return t;
    return Date.now();
  }

  function cooldownLeft() {
    const last = Number(store.get('p49-last-post') || 0);
    return Math.max(0, COOLDOWN_MS - (Date.now() - last));
  }
  const markPosted = () => store.set('p49-last-post', String(Date.now()));

  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
    ]);
  }

  /* ---------------- الاتصال بقاعدة البيانات ---------------- */
  const cfg = window.FIREBASE_CONFIG || {};
  const fake = window.__SOCIAL_BACKEND__ || null; // للتجارب فقط
  const configured = Boolean(fake || (cfg.apiKey && cfg.projectId));
  if (!configured) return; // الموقع يفضل زي ما هو

  let backendPromise = null;
  function getBackend() {
    if (fake) return Promise.resolve(fake);
    if (backendPromise) return backendPromise;
    backendPromise = Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-firestore.js`)
    ]).then(([appMod, fs]) => {
      const db = fs.getFirestore(appMod.initializeApp(cfg));
      const col = (name) => fs.collection(db, name);
      const snapToList = (snap, map) => snap.docs.map((d) => map(d.id, d.data({ serverTimestamps: 'estimate' })));

      return {
        addMessage: (m) => fs.addDoc(col('messages'), { ...m, createdAt: fs.serverTimestamp() }),
        addMemory: (m) => fs.addDoc(col('memories'), { ...m, createdAt: fs.serverTimestamp() }),
        addComment: (m) => fs.addDoc(col('comments'), { ...m, createdAt: fs.serverTimestamp() }),
        watchMessages: (toId, cb, onErr) => fs.onSnapshot(
          fs.query(col('messages'), fs.where('toId', '==', toId)),
          (s) => cb(snapToList(s, (id, d) => ({ id, fromName: d.fromName, text: d.text, ts: tsOf(d) }))), onErr),
        watchMemories: (cb, onErr) => fs.onSnapshot(
          fs.query(col('memories'), fs.orderBy('createdAt', 'desc'), fs.limit(50)),
          (s) => cb(snapToList(s, (id, d) => ({ id, name: d.name, text: d.text, ts: tsOf(d) }))), onErr),
        watchComments: (memoryId, cb, onErr) => fs.onSnapshot(
          fs.query(col('comments'), fs.where('memoryId', '==', memoryId)),
          (s) => cb(snapToList(s, (id, d) => ({ id, name: d.name, text: d.text, ts: tsOf(d) }))), onErr)
      };
    });
    backendPromise.catch(() => { backendPromise = null; });
    return backendPromise;
  }

  /* ---------------- هوية كل كارت ---------------- */
  if (typeof students === 'undefined') return;

  const hash = (s) => {
    let h = 5381;
    for (const ch of s) h = ((h << 5) + h + ch.codePointAt(0)) >>> 0;
    return h.toString(36);
  };
  const ids = [];
  const counts = {};
  students.forEach((s) => {
    const base = hash(String(s.name || '').trim().toLowerCase());
    counts[base] = (counts[base] || 0) + 1;
    ids.push(s.id || ('s_' + base + (counts[base] > 1 ? '_' + counts[base] : '')));
  });

  /* ---------------- حالة هذا الجهاز ---------------- */
  let me = store.get('p49-me');               // كارتي أنا (id)
  if (me && !ids.includes(me)) { store.del('p49-me'); me = null; }
  let myMessages = [];                         // رسائلي الواردة
  let stopMyWatch = null;

  const seenKey = () => 'p49-seen-' + me;
  const unreadCount = () => {
    const seen = Number(store.get(seenKey()) || 0);
    return myMessages.filter((m) => m.ts > seen).length;
  };
  const markAllSeen = () => {
    if (!me || !myMessages.length) return;
    store.set(seenKey(), String(Math.max(...myMessages.map((m) => m.ts))));
    updateDots();
  };

  /* ---------------- النقطة الحمرا على الكارت ---------------- */
  const grid = document.getElementById('gallery-grid');

  function updateDots() {
    if (!grid) return;
    const n = me ? unreadCount() : 0;
    grid.querySelectorAll('.student-card.has-chat').forEach((card) => {
      let dot = card.querySelector(':scope > .msg-dot');
      if (card.dataset.sid === me && n > 0) {
        if (!dot) {
          dot = document.createElement('span');
          dot.className = 'msg-dot';
          card.appendChild(dot);
        }
        dot.textContent = n > 9 ? '9+' : String(n);
        dot.setAttribute('aria-label', `${n} رسالة جديدة`);
      } else if (dot) {
        dot.remove();
      }
    });
  }

  function decorateCards() {
    if (!grid) return;
    const base = (currentGalleryPage - 1) * GALLERY_PAGE_SIZE;
    [...grid.querySelectorAll('.student-card')].forEach((card, i) => {
      const idx = base + i;
      const st = students[idx];
      if (!st || st.memorial || card.classList.contains('memorial-card')) return;
      card.classList.add('has-chat');
      card.dataset.sid = ids[idx];
      card.dataset.sidx = String(idx);
      card.setAttribute('role', 'button');
      card.tabIndex = 0;
      card.setAttribute('aria-label', `${st.name} — ابعتله رسالة أو شوف رسائله`);
    });
    updateDots();
  }

  function watchMine() {
    if (stopMyWatch) { stopMyWatch(); stopMyWatch = null; }
    myMessages = [];
    updateDots();
    if (!me) return;
    getBackend().then((b) => {
      stopMyWatch = b.watchMessages(me, (list) => {
        myMessages = list;
        if (modal.open && modal.sid === me && modal.view === 'inbox') {
          markAllSeen();
          renderInbox(list);
        }
        updateDots();
      }, () => {});
    }).catch(() => {});
  }

  /* ---------------- النافذة (Modal) ---------------- */
  const modal = { open: false, sid: null, idx: null, view: 'menu', stop: null, lastFocus: null };

  const overlay = document.createElement('div');
  overlay.className = 'sm-overlay';
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="sm-dialog" role="dialog" aria-modal="true" aria-labelledby="sm-title" tabindex="-1">
      <button type="button" class="sm-close" aria-label="إغلاق">×</button>
      <div class="sm-head">
        <img class="sm-photo" alt="" />
        <div class="sm-head-text">
          <span class="sm-kicker">دفعة 49</span>
          <h3 id="sm-title" class="sm-title"></h3>
        </div>
      </div>
      <div class="sm-body"></div>
    </div>`;
  document.body.appendChild(overlay);

  const dialog = $('.sm-dialog', overlay);
  const bodyEl = $('.sm-body', overlay);
  const photoEl = $('.sm-photo', overlay);
  photoEl.addEventListener('error', () => {
    if (!photoEl.dataset.fallback) { photoEl.dataset.fallback = '1'; photoEl.src = 'images/students/default-avatar.svg'; }
  });

  const curName = () => students[modal.idx].name;
  const isMine = () => me === modal.sid;

  function stopWatching() { if (modal.stop) { modal.stop(); modal.stop = null; } }

  function openModal(idx) {
    stopWatching();
    modal.open = true;
    modal.idx = idx;
    modal.sid = ids[idx];
    modal.lastFocus = document.activeElement;
    const st = students[idx];
    $('.sm-title', overlay).textContent = st.name;
    photoEl.dataset.fallback = '';
    photoEl.src = st.photo;
    overlay.hidden = false;
    document.documentElement.classList.add('sm-lock');
    requestAnimationFrame(() => overlay.classList.add('is-in'));
    showMenu();
    dialog.focus({ preventScroll: true });
  }

  function closeModal() {
    if (!modal.open) return;
    stopWatching();
    modal.open = false;
    overlay.classList.remove('is-in');
    document.documentElement.classList.remove('sm-lock');
    setTimeout(() => { if (!modal.open) overlay.hidden = true; }, 220);
    if (modal.lastFocus && modal.lastFocus.focus) modal.lastFocus.focus({ preventScroll: true });
  }

  function setView(name, html) {
    modal.view = name;
    bodyEl.innerHTML = html;
    bodyEl.scrollTop = 0;
  }

  /* --- القائمة الرئيسية --- */
  function showMenu() {
    stopWatching();
    const mine = isMine();
    const n = mine ? unreadCount() : 0;
    setView('menu', `
      <div class="sm-actions">
        <button type="button" class="sm-btn sm-btn-primary" data-act="write">
          <span class="sm-btn-ic">💌</span> ابعتله رسالة
        </button>
        <button type="button" class="sm-btn sm-btn-soft" data-act="inbox">
          <span class="sm-btn-ic">📥</span> شوف الرسائل ${n ? `<span class="sm-count">${n > 9 ? '9+' : n}</span>` : ''}
        </button>
      </div>
      <div class="sm-claim">
        ${mine
          ? `<p>✓ ده كارتك — هتظهرلك نقطة حمرا لما حد يبعتلك رسالة جديدة.</p>
             <button type="button" class="sm-link" data-act="unclaim">مش كارتي</button>`
          : `<p>ده كارتك؟ علّمه عشان تظهرلك نقطة حمرا لما حد يبعتلك رسالة.</p>
             <button type="button" class="sm-link" data-act="claim">آه، ده كارتي</button>`}
      </div>`);
  }

  /* --- كتابة رسالة --- */
  function showWrite() {
    stopWatching();
    const defaultName = store.get('p49-name') || (me ? students[ids.indexOf(me)].name : '');
    setView('write', `
      <button type="button" class="sm-back" data-act="menu">‹ رجوع</button>
      <form class="sm-form" novalidate>
        <label class="sm-label" for="sm-text">رسالتك لـ ${esc(curName())}</label>
        <textarea id="sm-text" class="sm-input sm-textarea" rows="5" maxlength="${LIMITS.message}" placeholder="اكتب رسالتك هنا..."></textarea>
        <div class="sm-hint"><span id="sm-text-count">0</span> / ${LIMITS.message}</div>

        <label class="sm-label" for="sm-sign">التوقيع (اسمك)</label>
        <input id="sm-sign" class="sm-input" type="text" maxlength="${LIMITS.name}" placeholder="اكتب اسمك" value="${esc(defaultName)}" autocomplete="name" />
        <div class="sm-sign-preview" id="sm-sign-preview"></div>

        <p class="sm-error" id="sm-error" role="alert" hidden></p>
        <button type="submit" class="sm-btn sm-btn-primary sm-send">ابعت الرسالة <span>←</span></button>
      </form>`);

    const text = $('#sm-text', bodyEl);
    const sign = $('#sm-sign', bodyEl);
    const prev = $('#sm-sign-preview', bodyEl);
    const count = $('#sm-text-count', bodyEl);
    const updatePrev = () => { prev.textContent = sign.value.trim() ? '— ' + sign.value.trim() : ''; };
    text.addEventListener('input', () => { count.textContent = String(text.value.length); });
    sign.addEventListener('input', updatePrev);
    updatePrev();
    text.focus({ preventScroll: true });

    $('.sm-form', bodyEl).addEventListener('submit', (e) => {
      e.preventDefault();
      sendMessage(text, sign);
    });
  }

  function showError(msg) {
    const el = $('#sm-error', bodyEl);
    if (!el) return;
    el.textContent = msg;
    el.hidden = !msg;
  }

  function sendMessage(textEl, signEl) {
    const text = textEl.value.trim();
    const name = signEl.value.trim();
    if (!text) { showError('اكتب رسالتك الأول.'); textEl.focus(); return; }
    if (!name) { showError('اكتب اسمك في التوقيع.'); signEl.focus(); return; }
    const wait = cooldownLeft();
    if (wait) { showError(`استنى ${Math.ceil(wait / 1000)} ثانية قبل ما تبعت رسالة تانية.`); return; }

    const btn = $('.sm-send', bodyEl);
    btn.disabled = true;
    showError('');
    const toId = modal.sid;
    const toName = curName();

    getBackend()
      .then((b) => withTimeout(b.addMessage({ toId, toName, fromName: name, text }), 12000))
      .then(() => {
        markPosted();
        store.set('p49-name', name);
        if (modal.open && modal.view === 'write') {
          setView('sent', `
            <div class="sm-sent">
              <div class="sm-sent-ic">✓</div>
              <h4>الرسالة اتبعتت</h4>
              <p>وصلت لـ ${esc(toName)} ✨</p>
              <div class="sm-actions">
                <button type="button" class="sm-btn sm-btn-soft" data-act="write">ابعت رسالة تانية</button>
                <button type="button" class="sm-btn sm-btn-primary" data-act="close">تمام</button>
              </div>
            </div>`);
        }
      })
      .catch(() => {
        if (btn.isConnected) btn.disabled = false;
        showError('معرفناش نبعت الرسالة. اتأكد من النت وحاول تاني.');
      });
  }

  /* --- صندوق الرسائل --- */
  function showInbox() {
    stopWatching();
    setView('inbox', `
      <button type="button" class="sm-back" data-act="menu">‹ رجوع</button>
      <h4 class="sm-section-title">الرسائل اللي وصلت لـ ${esc(curName())}</h4>
      <div class="sm-list" id="sm-list"><p class="sm-empty">بنحمّل الرسائل...</p></div>`);
    const sid = modal.sid;
    getBackend().then((b) => {
      if (!modal.open || modal.view !== 'inbox' || modal.sid !== sid) return;
      modal.stop = b.watchMessages(sid, (list) => {
        if (modal.view !== 'inbox' || modal.sid !== sid) return;
        if (sid === me) markAllSeen();
        renderInbox(list);
      }, () => {
        const el = $('#sm-list', bodyEl);
        if (el) el.innerHTML = '<p class="sm-empty">معرفناش نحمّل الرسائل. حاول تاني.</p>';
      });
    }).catch(() => {
      const el = $('#sm-list', bodyEl);
      if (el) el.innerHTML = '<p class="sm-empty">معرفناش نحمّل الرسائل. حاول تاني.</p>';
    });
  }

  function renderInbox(list) {
    const el = $('#sm-list', bodyEl);
    if (!el) return;
    if (!list.length) {
      el.innerHTML = '<p class="sm-empty">لسه مفيش رسائل. كن أول واحد يبعت رسالة 💌</p>';
      return;
    }
    el.innerHTML = [...list].sort((a, b) => b.ts - a.ts).map((m) => `
      <article class="sm-msg">
        <p class="sm-msg-text">${esc(m.text)}</p>
        <footer class="sm-msg-foot"><span class="sm-msg-sign">— ${esc(m.fromName)}</span><time>${esc(formatWhen(m.ts))}</time></footer>
      </article>`).join('');
  }

  /* --- الأزرار داخل النافذة --- */
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.closest('.sm-close')) { closeModal(); return; }
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'write') showWrite();
    else if (act === 'inbox') showInbox();
    else if (act === 'menu') showMenu();
    else if (act === 'close') closeModal();
    else if (act === 'claim') {
      me = modal.sid;
      store.set('p49-me', me);
      watchMine();
      showMenu();
    } else if (act === 'unclaim') {
      store.del('p49-me');
      me = null;
      watchMine();
      showMenu();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (modal.open && e.key === 'Escape') closeModal();
  });

  /* --- الضغط على كارت الطالب --- */
  if (grid) {
    const openFromCard = (card) => {
      if (card && card.dataset.sidx !== undefined) openModal(Number(card.dataset.sidx));
    };
    grid.addEventListener('click', (e) => openFromCard(e.target.closest('.student-card.has-chat')));
    grid.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const card = e.target.closest('.student-card.has-chat');
      if (!card) return;
      e.preventDefault();
      openFromCard(card);
    });
    new MutationObserver(decorateCards).observe(grid, { childList: true });
    decorateCards();

    const hint = document.querySelector('.gallery-hint');
    if (hint && !hint.textContent.trim()) hint.textContent = 'اضغط على أي كارت علشان تبعتله رسالة 💌';
  }

  /* =======================================================================
     حائط الذكريات
     ======================================================================= */
  let startMemories = () => {};
  const section = document.getElementById('memories');
  const form = document.getElementById('memory-form');
  const listEl = document.getElementById('memory-list');
  if (section && form && listEl) {
    section.hidden = false;

    const nameIn = $('#memory-name', form);
    const textIn = $('#memory-text', form);
    const countEl = $('#memory-count', form);
    const errEl = $('#memory-error', form);
    const submit = $('button[type="submit"]', form);

    nameIn.value = store.get('p49-name') || (me ? students[ids.indexOf(me)].name : '');
    nameIn.maxLength = LIMITS.name;
    textIn.maxLength = LIMITS.memory;
    textIn.addEventListener('input', () => { countEl.textContent = String(textIn.value.length); });

    const setErr = (m) => { errEl.textContent = m; errEl.hidden = !m; };

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = nameIn.value.trim();
      const text = textIn.value.trim();
      if (!text) { setErr('اكتب ذكراك الأول.'); textIn.focus(); return; }
      if (!name) { setErr('اكتب اسمك.'); nameIn.focus(); return; }
      const wait = cooldownLeft();
      if (wait) { setErr(`استنى ${Math.ceil(wait / 1000)} ثانية قبل ما تنشر تاني.`); return; }
      setErr('');
      submit.disabled = true;
      getBackend()
        .then((b) => withTimeout(b.addMemory({ name, text }), 12000))
        .then(() => {
          markPosted();
          store.set('p49-name', name);
          textIn.value = '';
          countEl.textContent = '0';
          submit.disabled = false;
          submit.classList.add('is-done');
          setTimeout(() => submit.classList.remove('is-done'), 1600);
        })
        .catch(() => {
          submit.disabled = false;
          setErr('معرفناش ننشر الذكرى. اتأكد من النت وحاول تاني.');
        });
    });

    /* قائمة الذكريات: بنحدّث العناصر بدل ما نمسحها، عشان التعليقات المفتوحة متقفلش */
    const nodes = new Map();

    function memoryNode(m) {
      const art = document.createElement('article');
      art.className = 'mem-card';
      art.dataset.id = m.id;
      art.innerHTML = `
        <p class="mem-text">${esc(m.text)}</p>
        <footer class="mem-foot">
          <span class="mem-sign">— ${esc(m.name)}</span>
          <time class="mem-time">${esc(formatWhen(m.ts))}</time>
        </footer>
        <button type="button" class="mem-toggle" aria-expanded="false">💬 التعليقات</button>
        <div class="mem-comments" hidden>
          <div class="mem-comment-list"><p class="sm-empty">بنحمّل التعليقات...</p></div>
          <form class="mem-comment-form" novalidate>
            <input class="sm-input" type="text" name="n" maxlength="${LIMITS.name}" placeholder="اسمك" aria-label="اسمك" />
            <textarea class="sm-input" name="t" rows="2" maxlength="${LIMITS.comment}" placeholder="اكتب تعليقك..." aria-label="تعليقك"></textarea>
            <p class="sm-error" role="alert" hidden></p>
            <button type="submit" class="sm-btn sm-btn-primary sm-btn-sm">علّق</button>
          </form>
        </div>`;
      wireComments(art, m.id);
      return art;
    }

    function wireComments(art, memoryId) {
      const toggle = $('.mem-toggle', art);
      const panel = $('.mem-comments', art);
      const listBox = $('.mem-comment-list', art);
      const cform = $('.mem-comment-form', art);
      const err = $('.sm-error', cform);
      const nIn = cform.elements.n;
      const tIn = cform.elements.t;
      let stop = null;

      const render = (list) => {
        if (!list.length) { listBox.innerHTML = '<p class="sm-empty">مفيش تعليقات لسه — كن أول واحد 🙂</p>'; return; }
        listBox.innerHTML = [...list].sort((a, b) => a.ts - b.ts).map((c) => `
          <div class="mem-comment">
            <p>${esc(c.text)}</p>
            <span class="mem-comment-sign">— ${esc(c.name)}</span>
          </div>`).join('');
      };

      toggle.addEventListener('click', () => {
        const open = panel.hidden;
        panel.hidden = !open;
        toggle.setAttribute('aria-expanded', String(open));
        if (open) {
          nIn.value = nIn.value || store.get('p49-name') || (me ? students[ids.indexOf(me)].name : '');
          getBackend().then((b) => {
            if (panel.hidden || stop) return;
            stop = b.watchComments(memoryId, render, () => {
              listBox.innerHTML = '<p class="sm-empty">معرفناش نحمّل التعليقات.</p>';
            });
          }).catch(() => {});
        } else if (stop) {
          stop(); stop = null;
        }
      });

      cform.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = nIn.value.trim();
        const text = tIn.value.trim();
        const show = (m) => { err.textContent = m; err.hidden = !m; };
        if (!name) { show('اكتب اسمك.'); nIn.focus(); return; }
        if (!text) { show('اكتب تعليقك الأول.'); tIn.focus(); return; }
        const wait = cooldownLeft();
        if (wait) { show(`استنى ${Math.ceil(wait / 1000)} ثانية قبل ما تعلّق تاني.`); return; }
        show('');
        const btn = $('button[type="submit"]', cform);
        btn.disabled = true;
        getBackend()
          .then((b) => withTimeout(b.addComment({ memoryId, name, text }), 12000))
          .then(() => { markPosted(); store.set('p49-name', name); tIn.value = ''; btn.disabled = false; })
          .catch(() => { btn.disabled = false; show('معرفناش نبعت التعليق. حاول تاني.'); });
      });
    }

    function renderMemories(list) {
      const seen = new Set();
      let prev = null;
      list.forEach((m) => {
        seen.add(m.id);
        let node = nodes.get(m.id);
        if (!node) { node = memoryNode(m); nodes.set(m.id, node); }
        const ref = prev ? prev.nextSibling : listEl.firstChild;
        if (node !== ref) listEl.insertBefore(node, ref);
        prev = node;
      });
      nodes.forEach((node, id) => { if (!seen.has(id)) { node.remove(); nodes.delete(id); } });
      const empty = $('#memory-empty');
      if (empty) empty.hidden = list.length > 0;
    }

    startMemories = () => getBackend().then((b) => {
      b.watchMemories(renderMemories, () => {
        const empty = $('#memory-empty');
        if (empty) { empty.hidden = false; empty.textContent = 'معرفناش نحمّل الذكريات دلوقتي.'; }
      });
    }).catch(() => {});
  }

  /* نبدأ نتابع رسائل صاحب الكارت بعد ما الصفحة تخلص تحميل (عشان السرعة) */
  const start = () => { watchMine(); startMemories(); };
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start);
})();
