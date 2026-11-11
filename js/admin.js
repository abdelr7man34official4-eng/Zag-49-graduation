/* لوحة التحكم: تسجيل دخول بجوجل + عرض ومسح الرسائل والذكريات والتعليقات.
   المسح مسموح بس للإيميل المكتوب في قواعد Firebase (firestore.rules)،
   فأي حد تاني يفتح الصفحة دي مش هيقدر يمسح حاجة. */
(function admin() {
  'use strict';
  const V = '10.12.2';
  const cfg = window.FIREBASE_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  const fmt = (ts) => { try { return new Date(ts).toLocaleString('ar-EG'); } catch (e) { return ''; } };

  if (!cfg.apiKey || !cfg.projectId) { $('adm-config-note').hidden = false; $('adm-signin').disabled = true; return; }

  const data = { messages: [], memories: [], comments: [] };
  let tab = 'messages';
  let fs, auth, db, authMod, stops = [];

  const showErr = (id, m) => { const el = $(id); el.textContent = m; el.hidden = !m; };

  function render() {
    ['messages', 'memories', 'comments'].forEach((k) => { $('n-' + k).textContent = String(data[k].length); });
    const list = $('adm-list');
    const items = data[tab];
    if (!items.length) { list.innerHTML = '<p class="sm-empty">مفيش حاجة هنا.</p>'; return; }
    list.innerHTML = items.map((d) => {
      let meta = '';
      if (tab === 'messages') meta = `<span>إلى: <b>${esc(d.toName)}</b></span><span>من: <b>${esc(d.fromName)}</b></span>`;
      else meta = `<span>بقلم: <b>${esc(d.name)}</b></span>`;
      return `<article class="adm-item">
        <div class="adm-meta">${meta}<span>${esc(fmt(d.ts))}</span></div>
        <div class="adm-text">${esc(d.text)}</div>
        <button type="button" class="adm-del" data-id="${esc(d.id)}">مسح</button>
      </article>`;
    }).join('');
  }

  function watch(col) {
    return fs.onSnapshot(fs.query(fs.collection(db, col), fs.orderBy('createdAt', 'desc'), fs.limit(300)), (snap) => {
      data[col] = snap.docs.map((d) => {
        const x = d.data({ serverTimestamps: 'estimate' });
        return { ...x, id: d.id, ts: x.createdAt && x.createdAt.toMillis ? x.createdAt.toMillis() : Date.now() };
      });
      render();
    }, (e) => showErr('adm-error', 'مشكلة في تحميل البيانات: ' + e.code));
  }

  async function del(id) {
    if (!confirm('متأكدة إنك عايزة تمسحي ده؟ مش هتقدري ترجعيه.')) return;
    try {
      if (tab === 'memories') {
        // نمسح تعليقات الذكرى معاها
        const snap = await fs.getDocs(fs.query(fs.collection(db, 'comments'), fs.where('memoryId', '==', id)));
        await Promise.all(snap.docs.map((d) => fs.deleteDoc(d.ref)));
      }
      await fs.deleteDoc(fs.doc(db, tab, id));
      showErr('adm-error', '');
    } catch (e) {
      showErr('adm-error', e.code === 'permission-denied'
        ? 'الحساب ده مش مصرّح له يمسح. اتأكدي إن الإيميل مكتوب صح في Rules.'
        : 'حصلت مشكلة: ' + (e.code || e.message));
    }
  }

  function enter(user) {
    $('adm-login').hidden = true;
    $('adm-panel').hidden = false;
    $('adm-user').textContent = user.email;
    stops = ['messages', 'memories', 'comments'].map(watch);
  }
  function leave() {
    stops.forEach((s) => s()); stops = [];
    $('adm-login').hidden = false;
    $('adm-panel').hidden = true;
  }

  Promise.all([
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`)
  ]).then(([appMod, a, f]) => {
    authMod = a; fs = f;
    const app = appMod.initializeApp(cfg);
    auth = a.getAuth(app);
    db = f.getFirestore(app);
    a.onAuthStateChanged(auth, (u) => (u ? enter(u) : leave()));
  }).catch(() => showErr('adm-login-error', 'معرفناش نتصل بـ Firebase. اتأكدي من النت.'));

  $('adm-signin').addEventListener('click', () => {
    if (!auth) return;
    showErr('adm-login-error', '');
    authMod.signInWithPopup(auth, new authMod.GoogleAuthProvider()).catch((e) => {
      showErr('adm-login-error', e.code === 'auth/unauthorized-domain'
        ? 'الدومين ده مش مضاف في Firebase ← Authentication ← Settings ← Authorized domains.'
        : e.code === 'auth/operation-not-allowed'
          ? 'لازم تفعّلي Google في Firebase ← Authentication ← Sign-in method.'
          : 'تسجيل الدخول فشل: ' + (e.code || e.message));
    });
  });
  $('adm-signout').addEventListener('click', () => authMod.signOut(auth));
  document.querySelector('.adm-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]'); if (!b) return;
    tab = b.dataset.tab;
    document.querySelectorAll('.adm-tabs [data-tab]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    render();
  });
  $('adm-list').addEventListener('click', (e) => {
    const b = e.target.closest('.adm-del'); if (!b) return;
    b.disabled = true; del(b.dataset.id).finally(() => { b.disabled = false; });
  });
})();
