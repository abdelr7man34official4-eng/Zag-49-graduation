/* =========================================================================
   رسائل الكروت + حائط الذكريات + التفاعلات — موقع دفعة 49
   =========================================================================
   الملف ده مستقل عن script.js (بيقرأ منه قائمة students بس).
   بيشتغل فقط لما تملا إعدادات Firebase في js/firebase-config.js.

   الفكرة:
   - كل شخص لازم يسجّل كارته مرة واحدة (اسمه بيتقفل على اسم الكارت).
   - الكارت الواحد ينفع يتسجّل لشخص واحد بس، والأدمن بس يقدر يفكّه.
   - أي رسالة / ذكرى / تعليق بتتوقّع تلقائي باسم الكارت ومينفعش يتغيّر.
   - النقطة الحمرا بتظهر على كارت صاحبه لما حد يبعتله رسالة.
   - التفاعلات (أعجبني / أحببته / أضحكني / أغضبني) على الذكريات والتعليقات.
   ========================================================================= */
(function socialFeatures() {
  'use strict';

  const FB_VERSION = '10.12.2';
  const LIMITS = { message: 600, memory: 700, comment: 300 };
  const COOLDOWN_MS = 15000; // مدة الانتظار بين كل مشاركتين من نفس الجهاز (ضد السبام)
  const REACTIONS = [
    { k: 'like', e: '👍', t: 'أعجبني' },
    { k: 'love', e: '❤️', t: 'أحببته' },
    { k: 'laugh', e: '😂', t: 'أضحكني' },
    { k: 'angry', e: '😡', t: 'أغضبني' }
  ];

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

  const cooldownLeft = () => Math.max(0, COOLDOWN_MS - (Date.now() - Number(store.get('p49-last-post') || 0)));
  const markPosted = () => store.set('p49-last-post', String(Date.now()));

  const withTimeout = (promise, ms) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
  ]);

  const normalize = (value) => String(value || '')
    .toLowerCase().trim()
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ');

  function errorMessage(err, fallback) {
    const code = err && err.code;
    if (code === 'permission-denied') return 'مش مسموح. اتأكد إن كارتك متسجّل، ولو لسه بيحصل كلّم أدمن الموقع.';
    if (code === 'auth/operation-not-allowed' || code === 'auth/admin-restricted-operation') {
      return 'التسجيل مش متفعّل لسه في Firebase (Authentication ← Anonymous). كلّم أدمن الموقع.';
    }
    return fallback;
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
      import(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-firestore.js`)
    ]).then(([appMod, a, fs]) => {
      const app = appMod.initializeApp(cfg);
      const auth = a.getAuth(app);
      const db = fs.getFirestore(app);
      const col = (name) => fs.collection(db, name);
      const list = (snap, map) => snap.docs.map((d) => map(d.id, d.data({ serverTimestamps: 'estimate' })));
      const ensureUid = async () => {
        if (auth.currentUser) return auth.currentUser.uid;
        return (await a.signInAnonymously(auth)).user.uid;
      };

      return {
        onAuth: (cb) => a.onAuthStateChanged(auth, (u) => cb(u ? u.uid : null)),
        ensureUid,
        getClaim: async (cardId) => {
          const s = await fs.getDoc(fs.doc(db, 'claims', cardId));
          return s.exists() ? s.data() : null;
        },
        claim: async (cardId, name) => {
          const uid = await ensureUid();
          const batch = fs.writeBatch(db);
          batch.set(fs.doc(db, 'claims', cardId), { uid, name, createdAt: fs.serverTimestamp() });
          batch.set(fs.doc(db, 'users', uid), { cardId, name, createdAt: fs.serverTimestamp() });
          await batch.commit();
        },
        watchProfile: (uid, cb, onErr) => fs.onSnapshot(fs.doc(db, 'users', uid),
          (s) => cb(s.exists() ? { cardId: s.data().cardId, name: s.data().name } : null), onErr),

        addMessage: (m) => fs.addDoc(col('messages'), { ...m, createdAt: fs.serverTimestamp() }),
        addMemory: (m) => fs.addDoc(col('memories'), { ...m, createdAt: fs.serverTimestamp() }),
        addComment: (m) => fs.addDoc(col('comments'), { ...m, createdAt: fs.serverTimestamp() }),
        react: (colName, id, uid, type) => fs.updateDoc(fs.doc(db, colName, id),
          { ['reactions.' + uid]: type ? type : fs.deleteField() }),

        watchMessages: (toId, cb, onErr) => fs.onSnapshot(
          fs.query(col('messages'), fs.where('toId', '==', toId)),
          (s) => cb(list(s, (id, d) => ({ id, fromName: d.fromName, text: d.text, ts: tsOf(d) }))), onErr),
        watchMemories: (cb, onErr) => fs.onSnapshot(
          fs.query(col('memories'), fs.orderBy('createdAt', 'desc'), fs.limit(50)),
          (s) => cb(list(s, (id, d) => ({ id, name: d.name, text: d.text, ts: tsOf(d), reactions: d.reactions || {} }))), onErr),
        watchComments: (memoryId, cb, onErr) => fs.onSnapshot(
          fs.query(col('comments'), fs.where('memoryId', '==', memoryId)),
          (s) => cb(list(s, (id, d) => ({ id, name: d.name, text: d.text, ts: tsOf(d), reactions: d.reactions || {} }))), onErr)
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

  /* ---------------- حالة هذا الحساب ---------------- */
  let uid = null;          // رقم الحساب (مجهول، بيتحفظ في المتصفح)
  let profile = null;      // { cardId, name } لو سجّل كارته
  let me = null;           // رقم كارتي
  let stopProfile = null;
  let myMessages = [];
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
      }, (err) => console.warn('[رسائل] مشكلة في متابعة الرسائل:', err));
    }).catch((err) => console.warn('[رسائل] مشكلة في الاتصال بـ Firebase:', err));
  }

  /* ---------------- التسجيل (اختيار الكارت) ---------------- */
  function setProfile(p) {
    profile = p;
    me = p ? p.cardId : null;
    watchMine();
    updateDots();
    refreshSignLines();
    if (typeof rerenderMemories === 'function') rerenderMemories();
    if (modal.open && modal.view === 'menu') showMenu();
  }

  function startAuth() {
    getBackend().then((b) => {
      b.onAuth((u) => {
        uid = u;
        if (stopProfile) { stopProfile(); stopProfile = null; }
        if (!u) { setProfile(null); return; }
        stopProfile = b.watchProfile(u, (p) => setProfile(p), (err) => console.warn('[حساب] مشكلة:', err));
      });
    }).catch((err) => console.warn('[رسائل] مشكلة في الاتصال بـ Firebase:', err));
  }

  /* ---------------- النافذة (Modal) ---------------- */
  const modal = { open: false, sid: null, idx: null, view: 'menu', stop: null, lastFocus: null, pickIdx: null };

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
  const titleEl = $('.sm-title', overlay);
  photoEl.addEventListener('error', () => {
    if (!photoEl.dataset.fallback) { photoEl.dataset.fallback = '1'; photoEl.src = 'images/students/default-avatar.svg'; }
  });

  const curName = () => students[modal.idx].name;
  const isMine = () => me !== null && me === modal.sid;

  function stopWatching() { if (modal.stop) { modal.stop(); modal.stop = null; } }

  /* idx = رقم الكارت، أو null لفتح شاشة "اختار كارتك" بدون كارت معيّن */
  function openModal(idx) {
    stopWatching();
    modal.open = true;
    modal.idx = idx;
    modal.sid = idx === null ? null : ids[idx];
    modal.lastFocus = document.activeElement;
    if (idx === null) {
      titleEl.textContent = 'سجّل كارتك';
      photoEl.hidden = true;
    } else {
      const st = students[idx];
      titleEl.textContent = st.name;
      photoEl.hidden = false;
      photoEl.dataset.fallback = '';
      photoEl.src = st.photo;
    }
    overlay.hidden = false;
    document.documentElement.classList.add('sm-lock');
    requestAnimationFrame(() => overlay.classList.add('is-in'));
    if (idx === null) showPick(); else showMenu();
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
    let claimHtml;
    if (mine) {
      claimHtml = `<p>✓ ده كارتك — اسمك على الموقع: <b>${esc(profile.name)}</b>. هتظهرلك نقطة حمرا لما حد يبعتلك رسالة.</p>`;
    } else if (profile) {
      claimHtml = `<p>انت مسجّل باسم <b>${esc(profile.name)}</b>.</p>`;
    } else {
      claimHtml = `<p>ده كارتك؟ سجّل كارتك علشان تقدر تبعت رسايل وتكتب ذكريات.</p>
        <div id="sm-claim-slot"><button type="button" class="sm-link" data-act="claim-here">آه، ده كارتي</button></div>`;
    }
    setView('menu', `
      <div class="sm-actions">
        <button type="button" class="sm-btn sm-btn-primary" data-act="write">
          <span class="sm-btn-ic">💌</span> ابعتله رسالة
        </button>
        <button type="button" class="sm-btn sm-btn-soft" data-act="inbox">
          <span class="sm-btn-ic">📥</span> شوف الرسائل ${n ? `<span class="sm-count">${n > 9 ? '9+' : n}</span>` : ''}
        </button>
      </div>
      <div class="sm-claim">${claimHtml}</div>`);

    // لو الكارت ده متسجّل لحد تاني نقول كده بدل زرار التسجيل
    if (!profile) {
      const sid = modal.sid;
      getBackend().then((b) => b.getClaim(sid)).then((claim) => {
        const slot = $('#sm-claim-slot', bodyEl);
        if (claim && slot && modal.sid === sid && modal.view === 'menu') {
          slot.innerHTML = '<p class="sm-taken">🔒 الكارت ده متسجّل بالفعل لصاحبه.</p>';
        }
      }).catch(() => {});
    }
  }

  /* --- اختيار الكارت (بحث بالاسم) --- */
  function showPick() {
    stopWatching();
    setView('pick', `
      ${modal.idx !== null ? '<button type="button" class="sm-back" data-act="menu">‹ رجوع</button>' : ''}
      <h4 class="sm-section-title">اختار كارتك</h4>
      <p class="sm-note">اكتب اسمك ودوس عليه. الكارت ده هيبقى حسابك، واسمك هيظهر بيه في الموقع كله ومش هتقدر تغيره.</p>
      <input id="sm-find" class="sm-input" type="search" autocomplete="off" placeholder="اكتب اسمك..." />
      <div class="sm-list sm-pick-list" id="sm-find-list"><p class="sm-empty">اكتب أول حروف من اسمك</p></div>`);
    const input = $('#sm-find', bodyEl);
    const out = $('#sm-find-list', bodyEl);
    input.addEventListener('input', () => {
      const words = normalize(input.value).split(' ').filter(Boolean);
      if (!words.length) { out.innerHTML = '<p class="sm-empty">اكتب أول حروف من اسمك</p>'; return; }
      const found = students
        .map((s, i) => ({ s, i, n: normalize(s.name) }))
        .filter(({ s, n }) => !s.memorial && words.every((w) => n.includes(w)))
        .slice(0, 8);
      out.innerHTML = found.length
        ? found.map(({ s, i }) => `<button type="button" class="sm-pick-item" data-act="confirm" data-idx="${i}">${esc(s.name)}</button>`).join('')
        : '<p class="sm-empty">مفيش اسم بالشكل ده. جرّب جزء تاني من اسمك.</p>';
    });
    input.focus({ preventScroll: true });
  }

  /* --- تأكيد الكارت --- */
  function showConfirm(idx) {
    const st = students[idx];
    modal.pickIdx = idx;
    setView('confirm', `
      <div class="sm-confirm">
        <img class="sm-confirm-photo" src="${esc(st.photo)}" alt="" onerror="this.onerror=null;this.src='images/students/default-avatar.svg';" />
        <h4>${esc(st.name)}</h4>
        <p>انت صاحب الكارت ده؟ بعد التأكيد اسمك هيتسجّل بيه على الموقع كله، <b>ومش هتقدر تغيره</b>، ومحدش تاني هيقدر يختار الكارت ده.</p>
        <p class="sm-error" id="sm-error" role="alert" hidden></p>
        <div class="sm-actions">
          <button type="button" class="sm-btn sm-btn-primary" data-act="do-claim">أيوه، ده أنا</button>
          <button type="button" class="sm-btn sm-btn-soft" data-act="${modal.idx === null ? 'pick' : 'menu'}">لا، رجوع</button>
        </div>
      </div>`);
  }

  function doClaim(btn) {
    const idx = modal.pickIdx;
    const st = students[idx];
    btn.disabled = true;
    showError('');
    getBackend()
      .then((b) => withTimeout(b.claim(ids[idx], st.name), 15000))
      .then(() => {
        setProfile({ cardId: ids[idx], name: st.name });
        if (!modal.open) return;
        setView('claimed', `
          <div class="sm-sent">
            <div class="sm-sent-ic">✓</div>
            <h4>اتسجّل كارتك</h4>
            <p>اسمك على الموقع دلوقتي: <b>${esc(st.name)}</b></p>
            <div class="sm-actions">
              <button type="button" class="sm-btn sm-btn-primary" data-act="${modal.idx === null ? 'close' : 'menu'}">${modal.idx === null ? 'تمام' : 'كمّل'}</button>
            </div>
          </div>`);
      })
      .catch((err) => {
        console.warn('[تسجيل الكارت]', err);
        if (btn.isConnected) btn.disabled = false;
        showError(err && err.code === 'permission-denied'
          ? 'الكارت ده اتسجّل قبل كده، أو انت مسجّل بكارت تاني. لو ده كارتك فعلاً كلّم أدمن الموقع.'
          : errorMessage(err, 'معرفناش نسجّل الكارت. اتأكد من النت وحاول تاني.'));
      });
  }

  /* --- لازم تسجّل الأول --- */
  function showGate() {
    stopWatching();
    setView('gate', `
      <button type="button" class="sm-back" data-act="menu">‹ رجوع</button>
      <div class="sm-sent">
        <div class="sm-sent-ic sm-sent-ic-warn">!</div>
        <h4>سجّل كارتك الأول</h4>
        <p>علشان تبعت رسالة لازم يكون اسمك معروف. اختار كارتك مرة واحدة وبعدها تبعت براحتك.</p>
        <div class="sm-actions"><button type="button" class="sm-btn sm-btn-primary" data-act="pick">اختار كارتي</button></div>
      </div>`);
  }

  /* --- كتابة رسالة --- */
  function showWrite() {
    if (!profile) { showGate(); return; }
    stopWatching();
    setView('write', `
      <button type="button" class="sm-back" data-act="menu">‹ رجوع</button>
      <form class="sm-form" novalidate>
        <label class="sm-label" for="sm-text">رسالتك لـ ${esc(curName())}</label>
        <textarea id="sm-text" class="sm-input sm-textarea" rows="5" maxlength="${LIMITS.message}" placeholder="اكتب رسالتك هنا..."></textarea>
        <div class="sm-hint"><span id="sm-text-count">0</span> / ${LIMITS.message}</div>
        <div class="sign-slot"></div>
        <p class="sm-error" id="sm-error" role="alert" hidden></p>
        <button type="submit" class="sm-btn sm-btn-primary sm-send">ابعت الرسالة <span>←</span></button>
      </form>`);
    refreshSignLines();
    const text = $('#sm-text', bodyEl);
    const count = $('#sm-text-count', bodyEl);
    text.addEventListener('input', () => { count.textContent = String(text.value.length); });
    text.focus({ preventScroll: true });
    $('.sm-form', bodyEl).addEventListener('submit', (e) => { e.preventDefault(); sendMessage(text); });
  }

  function showError(msg) {
    const el = $('#sm-error', bodyEl);
    if (!el) return;
    el.textContent = msg;
    el.hidden = !msg;
  }

  function sendMessage(textEl) {
    if (!profile) { showGate(); return; }
    const text = textEl.value.trim();
    if (!text) { showError('اكتب رسالتك الأول.'); textEl.focus(); return; }
    const wait = cooldownLeft();
    if (wait) { showError(`استنى ${Math.ceil(wait / 1000)} ثانية قبل ما تبعت رسالة تانية.`); return; }

    const btn = $('.sm-send', bodyEl);
    btn.disabled = true;
    showError('');
    const toId = modal.sid;
    const toName = curName();

    getBackend()
      .then((b) => withTimeout(b.addMessage({ toId, toName, fromName: profile.name, fromId: profile.cardId, text }), 12000))
      .then(() => {
        markPosted();
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
      .catch((err) => {
        console.warn('[إرسال رسالة]', err);
        if (btn.isConnected) btn.disabled = false;
        showError(errorMessage(err, 'معرفناش نبعت الرسالة. اتأكد من النت وحاول تاني.'));
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
    const fail = () => {
      const el = $('#sm-list', bodyEl);
      if (el) el.innerHTML = '<p class="sm-empty">معرفناش نحمّل الرسائل. حاول تاني.</p>';
    };
    getBackend().then((b) => {
      if (!modal.open || modal.view !== 'inbox' || modal.sid !== sid) return;
      modal.stop = b.watchMessages(sid, (list) => {
        if (modal.view !== 'inbox' || modal.sid !== sid) return;
        if (sid === me) markAllSeen();
        renderInbox(list);
      }, fail);
    }).catch(fail);
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
    else if (act === 'pick') showPick();
    else if (act === 'claim-here') showConfirm(modal.idx);
    else if (act === 'confirm') showConfirm(Number(btn.dataset.idx));
    else if (act === 'do-claim') doClaim(btn);
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
    if (hint && !hint.textContent.trim()) {
      hint.textContent = 'اضغط على أي كارت علشان تبعتله رسالة 💌 — وقبل ما تبعت لازم تسجّل كارتك (مرة واحدة بس).';
    }
  }

  /* ---------------- سطر التوقيع (اسم مقفول) ---------------- */
  function refreshSignLines() {
    document.querySelectorAll('.sign-slot').forEach((el) => {
      el.innerHTML = profile
        ? `<span class="sign-name">التوقيع: — ${esc(profile.name)} 🔒</span>`
        : '<span class="sign-warn">لازم تسجّل كارتك الأول علشان تكتب.</span> <button type="button" class="sm-link js-pick">اختار كارتك</button>';
    });
  }
  document.addEventListener('click', (e) => {
    if (e.target.closest('.js-pick')) { e.preventDefault(); openModal(null); }
  });

  /* ---------------- التفاعلات ---------------- */
  function reactBar(colName, id, map) {
    const m = map || {};
    const mine = uid ? m[uid] : '';
    const tally = {};
    Object.keys(m).forEach((k) => { tally[m[k]] = (tally[m[k]] || 0) + 1; });
    return `<div class="react-bar" data-col="${colName}" data-id="${esc(id)}" data-mine="${esc(mine || '')}">` +
      REACTIONS.map((r) => `
        <button type="button" class="react-btn${mine === r.k ? ' is-mine' : ''}" data-type="${r.k}" aria-pressed="${mine === r.k}" title="${r.t}">
          <span class="react-e">${r.e}</span><span class="react-t">${r.t}</span>${tally[r.k] ? `<span class="react-n">${tally[r.k]}</span>` : ''}
        </button>`).join('') + '</div>';
  }

  function onReactClick(btn) {
    const bar = btn.closest('.react-bar');
    if (!bar) return;
    if (!profile || !uid) { openModal(null); return; }
    const type = btn.dataset.type;
    const next = bar.dataset.mine === type ? null : type;
    getBackend()
      .then((b) => b.react(bar.dataset.col, bar.dataset.id, uid, next))
      .catch((err) => console.warn('[تفاعل]', err));
  }

  /* =======================================================================
     حائط الذكريات (صفحة لوحدها)
     ======================================================================= */
  let rerenderMemories = null;
  let startMemories = () => {};
  const section = document.getElementById('memories');
  const form = document.getElementById('memory-form');
  const listEl = document.getElementById('memory-list');
  if (section && form && listEl) {
    section.hidden = false;

    const nav = document.getElementById('site-nav');
    const navToggle = document.getElementById('nav-toggle');
    let memLink = null;
    if (nav) {
      memLink = document.createElement('a');
      memLink.href = '#memories';
      memLink.textContent = 'حائط الذكريات';
      memLink.addEventListener('click', () => {
        nav.classList.remove('open');
        if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
      });
      nav.insertBefore(memLink, nav.querySelector('a[href="#footer"]'));
    }
    const inner = section.querySelector('.section-inner');
    if (inner) {
      const back = document.createElement('a');
      back.href = '#hero';
      back.className = 'mem-back';
      back.textContent = '→ رجوع للموقع';
      inner.insertBefore(back, inner.firstChild);
    }
    let wasMemView = false;
    function applyView() {
      const on = location.hash === '#memories';
      document.body.classList.toggle('view-memories', on);
      if (on) {
        nav && nav.querySelectorAll('a').forEach((a) => a.classList.remove('is-active'));
        if (memLink) memLink.classList.add('is-active');
        window.scrollTo(0, 0);
      } else if (wasMemView) {
        if (memLink) memLink.classList.remove('is-active');
        const target = location.hash.length > 1 ? document.querySelector(location.hash) : null;
        if (target) target.scrollIntoView(); else window.scrollTo(0, 0);
      }
      wasMemView = on;
    }
    window.addEventListener('hashchange', applyView);
    applyView();

    const nameIn = $('#memory-name', form);
    const nameLabel = $('label[for="memory-name"]', form);
    const textIn = $('#memory-text', form);
    const countEl = $('#memory-count', form);
    const errEl = $('#memory-error', form);
    const submit = $('button[type="submit"]', form);

    // الاسم مقفول: بنشيل خانة الاسم ونحط مكانها التوقيع التلقائي
    if (nameIn) nameIn.hidden = true;
    if (nameLabel) nameLabel.hidden = true;
    const slot = document.createElement('div');
    slot.className = 'sign-slot';
    form.insertBefore(slot, errEl);
    refreshSignLines();

    textIn.maxLength = LIMITS.memory;
    textIn.addEventListener('input', () => { countEl.textContent = String(textIn.value.length); });

    const setErr = (m) => { errEl.textContent = m; errEl.hidden = !m; };

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!profile) { openModal(null); return; }
      const text = textIn.value.trim();
      if (!text) { setErr('اكتب ذكراك الأول.'); textIn.focus(); return; }
      const wait = cooldownLeft();
      if (wait) { setErr(`استنى ${Math.ceil(wait / 1000)} ثانية قبل ما تنشر تاني.`); return; }
      setErr('');
      submit.disabled = true;
      getBackend()
        .then((b) => withTimeout(b.addMemory({ name: profile.name, cardId: profile.cardId, text }), 12000))
        .then(() => {
          markPosted();
          textIn.value = '';
          countEl.textContent = '0';
          submit.disabled = false;
          submit.classList.add('is-done');
          setTimeout(() => submit.classList.remove('is-done'), 1600);
        })
        .catch((err) => {
          console.warn('[نشر ذكرى]', err);
          submit.disabled = false;
          setErr(errorMessage(err, 'معرفناش ننشر الذكرى. اتأكد من النت وحاول تاني.'));
        });
    });

    /* قائمة الذكريات: بنحدّث العناصر بدل ما نمسحها، عشان التعليقات المفتوحة متقفلش */
    const nodes = new Map();
    let lastList = [];

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
        <div class="react-slot"></div>
        <button type="button" class="mem-toggle" aria-expanded="false">💬 التعليقات</button>
        <div class="mem-comments" hidden>
          <div class="mem-comment-list"><p class="sm-empty">بنحمّل التعليقات...</p></div>
          <form class="mem-comment-form" novalidate>
            <textarea class="sm-input" name="t" rows="2" maxlength="${LIMITS.comment}" placeholder="اكتب تعليقك..." aria-label="تعليقك"></textarea>
            <div class="sign-slot"></div>
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
      const tIn = cform.elements.t;
      let stop = null;
      let lastComments = null;

      const render = (list) => {
        lastComments = list;
        if (!list.length) { listBox.innerHTML = '<p class="sm-empty">مفيش تعليقات لسه — كن أول واحد 🙂</p>'; return; }
        listBox.innerHTML = [...list].sort((a, b) => a.ts - b.ts).map((c) => `
          <div class="mem-comment">
            <p>${esc(c.text)}</p>
            <span class="mem-comment-sign">— ${esc(c.name)}</span>
            ${reactBar('comments', c.id, c.reactions)}
          </div>`).join('');
      };
      art._rerenderComments = () => { if (lastComments) render(lastComments); };

      toggle.addEventListener('click', () => {
        const open = panel.hidden;
        panel.hidden = !open;
        toggle.setAttribute('aria-expanded', String(open));
        if (open) {
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
        const show = (m) => { err.textContent = m; err.hidden = !m; };
        if (!profile) { openModal(null); return; }
        const text = tIn.value.trim();
        if (!text) { show('اكتب تعليقك الأول.'); tIn.focus(); return; }
        const wait = cooldownLeft();
        if (wait) { show(`استنى ${Math.ceil(wait / 1000)} ثانية قبل ما تعلّق تاني.`); return; }
        show('');
        const btn = $('button[type="submit"]', cform);
        btn.disabled = true;
        getBackend()
          .then((b) => withTimeout(b.addComment({ memoryId, name: profile.name, cardId: profile.cardId, text }), 12000))
          .then(() => { markPosted(); tIn.value = ''; btn.disabled = false; })
          .catch((e2) => { console.warn('[تعليق]', e2); btn.disabled = false; show(errorMessage(e2, 'معرفناش نبعت التعليق. حاول تاني.')); });
      });
    }

    function renderMemories(list) {
      lastList = list;
      const seen = new Set();
      let prev = null;
      list.forEach((m) => {
        seen.add(m.id);
        let node = nodes.get(m.id);
        if (!node) { node = memoryNode(m); nodes.set(m.id, node); refreshSignLines(); }
        const slotEl = $('.react-slot', node);
        slotEl.innerHTML = reactBar('memories', m.id, m.reactions);
        const ref = prev ? prev.nextSibling : listEl.firstChild;
        if (node !== ref) listEl.insertBefore(node, ref);
        prev = node;
      });
      nodes.forEach((node, id) => { if (!seen.has(id)) { node.remove(); nodes.delete(id); } });
      const empty = $('#memory-empty');
      if (empty) empty.hidden = list.length > 0;
    }
    rerenderMemories = () => {
      renderMemories(lastList);
      nodes.forEach((n) => n._rerenderComments && n._rerenderComments());
    };

    listEl.addEventListener('click', (e) => {
      const b = e.target.closest('.react-btn');
      if (b) onReactClick(b);
    });

    startMemories = () => getBackend().then((b) => {
      b.watchMemories(renderMemories, (err) => {
        console.warn('[ذكريات]', err);
        const empty = $('#memory-empty');
        if (empty) { empty.hidden = false; empty.textContent = 'معرفناش نحمّل الذكريات دلوقتي.'; }
      });
    }).catch(() => {});
  }

  /* نبدأ بعد ما الصفحة تخلص تحميل (عشان السرعة) */
  const start = () => { startAuth(); startMemories(); };
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start);
})();
