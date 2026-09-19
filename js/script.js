/* =========================================================================
   ملف الجافاسكريبت - موقع دفعة 49
   =========================================================================
   الملف مقسم بأقسام واضحة. أهم حاجتين هتحتاج تعدلهم إنت:
     1) GRADUATION_DATE  -> تاريخ التخرج (تحت في القسم رقم 1)
     2) students         -> قائمة صور وأسماء الطلاب (تحت في القسم رقم 4)
   باقي الملف (الأنيميشن، القائمة، إلخ) مش لازم تلمسه أبداً.
   ========================================================================= */

/* -------------------------------------------------------------------------
   1) إعداد تاريخ التخرج (عدّل هنا فقط)
   الصيغة: 'YYYY-MM-DDTHH:MM:SS'
   مثال: لو التخرج هيكون يوم 15 يونيو 2027 الساعة 12 ظهراً، اكتب:
   '2027-06-15T12:00:00'
   ------------------------------------------------------------------------- */
const GRADUATION_DATE = new Date('2027-06-15T12:00:00');

/* -------------------------------------------------------------------------
   2) العداد التنازلي
   ------------------------------------------------------------------------- */
function updateCountdown() {
  const now = new Date();
  const diff = GRADUATION_DATE - now;

  const daysEl = document.getElementById('cd-days');
  const hoursEl = document.getElementById('cd-hours');
  const minutesEl = document.getElementById('cd-minutes');
  const secondsEl = document.getElementById('cd-seconds');
  const widget = document.getElementById('countdown-widget');
  const finishedMsg = document.getElementById('countdown-finished-msg');

  // لو معاد التخرج وصل أو فات، بنوقف العداد ونظهر رسالة تهنئة
  if (diff <= 0) {
    if (widget) widget.style.display = 'none';
    if (finishedMsg) finishedMsg.style.display = 'block';
    clearInterval(countdownInterval);
    return;
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  // نضيف صفر قبل الرقم لو أقل من 10 (مثال: 7 تبقى 07)
  const pad = (n) => String(n).padStart(2, '0');

  if (daysEl) daysEl.textContent = pad(days);
  if (hoursEl) hoursEl.textContent = pad(hours);
  if (minutesEl) minutesEl.textContent = pad(minutes);
  if (secondsEl) secondsEl.textContent = pad(seconds);
}

// نشغل العداد فوراً، وبعدين نحدثه كل ثانية
updateCountdown();
const countdownInterval = setInterval(updateCountdown, 1000);

/* -------------------------------------------------------------------------
   3) أنيميشن شاشة الاحتفال (الكونفيتي) اللي بتظهر أول ما حد يفتح الموقع بس
   وبعدها تختفي لوحدها (أو بزرار "تخطي")، مش ليها علاقة بزرار الاحتفال العائم
   ------------------------------------------------------------------------- */
(function introCelebration() {
  const screen = document.getElementById('celebration-screen');
  const canvas = document.getElementById('confetti-canvas');
  const skipBtn = document.getElementById('skip-celebration');

  if (!screen || !canvas) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // لو الزائر مفعّل عنده "تقليل الحركة" في جهازه، منعملش أنيميشن كونفيتي خالص
  if (prefersReducedMotion) {
    hideCelebration();
    return;
  }

  const ctx = canvas.getContext('2d');
  let width, height;

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  // ألوان الكونفيتي: بورجندي، ذهبي، أبيض (نفس هوية الدفعة)
  const colors = ['#7d1345', '#9c2159', '#c9a227', '#ffffff', '#4a0e29'];

  // بنولّد قطع كونفيتي عشوائية
  const pieces = Array.from({ length: 140 }, () => createPiece());

  function createPiece() {
    return {
      x: Math.random() * width,
      y: -20 - Math.random() * height * 0.5,
      size: 6 + Math.random() * 8,
      speedY: 2 + Math.random() * 3,
      speedX: (Math.random() - 0.5) * 2,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 8,
      color: colors[Math.floor(Math.random() * colors.length)],
      shape: Math.random() > 0.5 ? 'rect' : 'circle',
    };
  }

  let animationFrame;
  const startTime = performance.now();
  const DURATION = 3400; // مدة الأنيميشن بالمللي ثانية (3.4 ثانية) قبل ما تختفي الشاشة

  function draw(time) {
    ctx.clearRect(0, 0, width, height);

    pieces.forEach((p) => {
      p.y += p.speedY;
      p.x += p.speedX;
      p.rotation += p.rotationSpeed;

      // لما القطعة تنزل تحت الشاشة، نرجّعها فوق تاني عشان الاحتفال يفضل مستمر
      if (p.y > height + 20) {
        p.y = -20;
        p.x = Math.random() * width;
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      if (p.shape === 'rect') {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });

    if (time - startTime < DURATION) {
      animationFrame = requestAnimationFrame(draw);
    } else {
      hideCelebration();
    }
  }

  animationFrame = requestAnimationFrame(draw);

  // لو المستخدم دوس على زرار "تخطي"، نوقف الأنيميشن ونخفي الشاشة فوراً
  if (skipBtn) {
    skipBtn.addEventListener('click', () => {
      cancelAnimationFrame(animationFrame);
      hideCelebration();
    });
  }

  function hideCelebration() {
    screen.classList.add('hide');
    // بعد ما تختفي الشاشة تماماً، نشيلها من الصفحة عشان توفر أداء الموقع
    setTimeout(() => {
      screen.style.display = 'none';
    }, 950);
  }
})();

/* -------------------------------------------------------------------------
   3ب) كونفيتي عائم فوق الموقع كله: بيشتغل بزرار الاحتفال العائم في أي وقت
   وفي أي قسم انت واقف فيه (الرئيسية أو الصور أو أي حتة)، من غير ما يقفل
   الموقع أو يجيب شاشة "مبروك التخرج"
   ------------------------------------------------------------------------- */
(function siteConfetti() {
  const canvas = document.getElementById('site-confetti-canvas');
  const celebrationBtn = document.getElementById('celebration-toggle');
  const celebrationIcon = document.getElementById('celebration-icon');

  if (!canvas || !celebrationBtn) return;

  const ctx = canvas.getContext('2d');
  let width, height;
  let animationFrame = null;
  let pieces = [];
  let playing = false;

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  // ألوان الكونفيتي: بورجندي، ذهبي، أبيض (نفس هوية الدفعة)
  const colors = ['#7d1345', '#9c2159', '#c9a227', '#ffffff', '#4a0e29'];

  function createPiece() {
    return {
      x: Math.random() * width,
      y: -20 - Math.random() * height * 0.5,
      size: 6 + Math.random() * 8,
      speedY: 2 + Math.random() * 3,
      speedX: (Math.random() - 0.5) * 2,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 8,
      color: colors[Math.floor(Math.random() * colors.length)],
      shape: Math.random() > 0.5 ? 'rect' : 'circle',
    };
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);

    pieces.forEach((p) => {
      p.y += p.speedY;
      p.x += p.speedX;
      p.rotation += p.rotationSpeed;

      // لما القطعة تنزل تحت الشاشة، نرجّعها فوق تاني عشان الاحتفال يفضل مستمر لحد ما نوقفه
      if (p.y > height + 20) {
        p.y = -20;
        p.x = Math.random() * width;
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      if (p.shape === 'rect') {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });

    animationFrame = requestAnimationFrame(draw);
  }

  function setButtonState(isActive) {
    celebrationBtn.setAttribute('aria-pressed', String(isActive));
    celebrationBtn.classList.toggle('is-active', isActive);
    if (celebrationIcon) celebrationIcon.textContent = isActive ? '🛑' : '🎉';
  }

  function start() {
    if (playing) return;
    playing = true;
    resize();
    pieces = Array.from({ length: 140 }, () => createPiece());
    canvas.style.display = 'block';
    animationFrame = requestAnimationFrame(draw);
    setButtonState(true);
  }

  function stop() {
    if (!playing) return;
    playing = false;
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = null;
    canvas.style.display = 'none';
    ctx.clearRect(0, 0, width, height);
    setButtonState(false);
  }

  // زرار الاحتفال العائم: دوسة تشغل الكونفيتي فوق أي قسم انت فيه، ودوسة تانية تقفله
  celebrationBtn.addEventListener('click', () => {
    if (playing) stop();
    else start();
  });
})();

/* -------------------------------------------------------------------------
   3ب) زرار الأغنية: بتشتغل لوحدها أول ما الموقع يفتح، ودوسة على الزرار توقفها
   عشان تضيف أغنيتك: حط ملف الصوت جوه فولدر audio باسم song.mp3
   (شوف الـ audio tag في index.html لو عايز تغيّر الاسم)
   ------------------------------------------------------------------------- */
(function musicToggle() {
  const music = document.getElementById('bg-music');
  const musicBtn = document.getElementById('music-toggle');
  const musicIcon = document.getElementById('music-icon');

  if (!music || !musicBtn) return;

  function setButtonState(isPlaying) {
    musicBtn.setAttribute('aria-pressed', String(isPlaying));
    musicBtn.classList.toggle('is-active', isPlaying);
    if (musicIcon) musicIcon.textContent = isPlaying ? '🔊' : '🎵';
  }

  function playMusic() {
    const playPromise = music.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => setButtonState(true))
        .catch(() => {
          // المتصفح ممكن يمنع التشغيل التلقائي قبل أي تفاعل من الزائر،
          // فبمجرد ما يدوس في أي مكان في الصفحة أول مرة، هنحاول نشغلها تاني
          setButtonState(false);
          const tryAgain = () => {
            music.play().then(() => setButtonState(true)).catch(() => {});
            document.removeEventListener('click', tryAgain);
            document.removeEventListener('touchstart', tryAgain);
          };
          document.addEventListener('click', tryAgain, { once: true });
          document.addEventListener('touchstart', tryAgain, { once: true });
        });
    }
  }

  // نحاول نشغل الأغنية تلقائياً أول ما الموقع يفتح
  playMusic();

  // دوسة على الزرار: تشغيل لو واقفة، إيقاف لو شغالة
  musicBtn.addEventListener('click', () => {
    if (music.paused) {
      playMusic();
    } else {
      music.pause();
      setButtonState(false);
    }
  });
})();

/* -------------------------------------------------------------------------
   3.1) دالة مساعدة لعمل كارت "في ذكرى" بسرعة (مكتوبة الاسم بس)
   -------------------------------------------------------------------------
   عشان متكتبش كل مرة photo وmemorial وmemorialText وmemorialDua يدوي،
   الدالة دي بتعمل كل ده تلقائياً وانت بس بتكتب الاسم.
   بتفترض إن اسم ملف الصورة هو نفس اسم الطالب + .jpg
   (يعني لو الاسم 'Ahmed Ali' هتدور على images/students/Ahmed Ali.jpg)

   استخدامها جوه مصفوفة students تحت كده:
   memorialCard('اسم الطالب هنا'),

   ولو صورته امتدادها png مش jpg، أو عايز نص/دعاء مختلف، مرر باراميتر تاني:
   memorialCard('اسم الطالب هنا', { photo: 'images/students/اسمه.png' }),
   memorialCard('اسم الطالب هنا', { memorialText: 'في ذكراه الطيبة' }),
   memorialCard('اسم الطالب هنا', { memorialDua: 'اللهم اغفر له وارحمه' }),
   ------------------------------------------------------------------------- */
function memorialCard(name, options = {}) {
  return {
    name,
    photo: options.photo || `images/students/${name}.jpg`,
    memorial: true,
    memorialText: options.memorialText || 'رحمه الله',
    memorialDua: options.memorialDua
      || 'اللهم اغفر له وارحمه، وأسكنه فسيح جناتك، واجعل قبره روضة من رياض الجنة',
  };
}

/* -------------------------------------------------------------------------
   4) معرض الذكريات: قائمة الطلاب (صورة + اسم فقط)
   =========================================================================
   عشان تضيف طالب جديد:
   1) حط صورته جوه فولدر images/students/  (مثلاً: ahmed.jpg)
   2) اعمل نسخ من أي سطر تحت وعدل فيه الاسم ومسار الصورة
   3) مينفعش تنسى الفاصلة (,) في آخر كل سطر ما عدا آخر سطر في القائمة

   مثال جاهز تقدر تنسخه:
   { name: 'اسم الطالب هنا', photo: 'images/students/photo-name.jpg' },
   ========================================================================= */
const students = [
  // -------------------------------------------------------------------------
  // ✨ PREMIUM BADGE لأي كلمة تحبها:
  // اكتب badge: 'الكلمة' تحت الشخص الذي تريد ظهورها أسفل اسمه.
  // مثال: badge: 'VIP' أو badge: 'LEADER' أو badge: 'FOUNDER' أو أي كلمة أخرى.
  //
  // أول شخص هنا مثال: ستظهر تحته كلمة VIP بنفس الستايل الذهبي البريميوم.
  // ولإضافة نفس الفكرة لشخص آخر، أضف badge في بياناته فقط:
  // { name: 'اسم الشخص', photo: 'images/students/photo.jpg', badge: 'LEADER' },
  //
  // لو لا تريد أي كلمة، لا تكتب badge أصلاً.
  // -------------------------------------------------------------------------

  // -------------------------------------------------------------------------
  // 🕊️ كارت "في ذكرى" لطالب متوفى (رحمه الله) — أسهل طريقة (بس الاسم):
  // امسح // من أول السطر تحت واكتب مكانها اسم الطالب فعلاً:
  //
  // memorialCard('اسم الطالب هنا'),
  //
  // كده بس! هيدور تلقائياً على صورته في images/students/اسم الطالب.jpg
  // ويحط عليه ستايل "في ذكرى" (صورة أبيض وأسود + شريط In Loving Memory)
  // ولما حد يدوس على كارته هيتقلب ويظهر الدعاء الافتراضي في ضهره.
  //
  // لو عايز تتحكم في الصورة/النص/الدعاء بنفسك بدل الافتراضي، شوف شرح
  // الدالة memorialCard() فوق (قسم 3.1)، أو اكتب الكارت بشكل كامل يدوي:
   
  // -------------------------------------------------------------------------
  { name: 'Abdelrhman Ehab', photo: 'images/students/Abdelrhman Ehab.png', badge: 'Creator' },
  { name: 'Mohamed khaled', photo: 'images/students/Mohamed Khaled.jpg', badge: '' },
  { name: 'Abo Bakr Mamdouh', photo: 'images/students/Abo Bakr Mamdouh.jpg' },
  { name: 'Mohamed Abotaleb', photo: 'images/students/Mohamed Abotaleb.jpg' },
  { name: 'Mohamed Atef (tefa)', photo: 'images/students/Mohamed Atef.jpg', badge: '' },
  { name: 'Mohamed Waled', photo: 'images/students/Mohamed Waled.jpg', badge: '' },
  { name: 'Basel Mohamed', photo: 'images/students/Basel Mohamed.jpg', badge: '' },
  { name: 'Sayed hassan', photo: 'images/students/Sayed hassan.jpg' },
  { name: 'Mohamed Rashed', photo: 'images/students/Mohamed Rashed.jpg' },
  { name: 'Mahmoud EL-Saidy', photo: 'images/students/Mahmoud EL-Saidy.jpg' },
  { name: 'Mohamed Salah', photo: 'images/students/Mohamed Salah.jpg', badge: '' },
  { name: 'Rana Ahmed', photo: 'images/students/Rana Ahmed.jpg', badge: 'LEADER' },
  { name: 'Amal Mohamed', photo: 'images/students/Amal Mohamed.jpg' },
  { name: 'Malak Mo’men', photo: 'images/students/Malak Momen.jpg' },
  { name: 'Mariam Ehab', photo: 'images/students/Mariam Ehab_.jpg' },
  { name: 'Faten Ahmed', photo: 'images/students/Faten Ahmed.jpg' },
  { name: 'Mayar Adel', photo: 'images/students/Mayar Adel.png' },
  { name: 'Haneen Adel', photo: 'images/students/Haneen Adel.jpg' },
  { name: 'Manar Elhoussiny ', photo: 'images/students/Manar Elhoussiny .png' },
  { name: 'Eman Sarhan', photo: 'images/students/Eman Sarhan.png' },
  { name: 'Nada Ayman ', photo: 'images/students/Nada Ayman .png' },
  { name: 'Khaled rafeeq', photo: 'images/students/Khaled rafeeq.png' },
  { name: 'Omnia Mohammed', photo: 'images/students/Omnia Mohammed.png' },
  { name: 'Abdullah Mostafa', photo: 'images/students/Abdullah Mostafa.png' },
  { name: 'Fatma Alzahraa', photo: 'images/students/Fatma Alzahraa Mohamed_.jpg' },
  { name: 'Ebrahem Mohamed', photo: 'images/students/Ebrahem Mohamed_.png' },
  { name: 'Jana Medhat', photo: 'images/students/Jana Medhat.jpg' },
  { name: 'Noran Mohamed', photo: 'images/students/Noran Mohamed.png' },
  { name: 'Salma Ehab', photo: 'images/students/Salma Ehab_.png' },
  { name: 'Nora Younis', photo: 'images/students/Nora Younis_.png' },
  { name: 'Nourhan Saeed ', photo: 'images/students/Nourhan Saeed .png' },
  { name: 'Hadeer Osman', photo: 'images/students/Hadeer Osman.jpg' },
  { name: 'Rawan Ahmed', photo: 'images/students/Rawan Ahmed.jpg' },
  { name: 'Nourhan khaled', photo: 'images/students/Nourhan khaled.jpg' },
  { name: 'Elsayed Mohamed', photo: 'images/students/Elsayed Mohamed.png' },
  { name: 'Esraa Ashraf', photo: 'images/students/Esraa Ashraf_.png' },
  { name: 'Wafaa nabil', photo: 'images/students/Wafaa nabil.jpg' },
  { name: 'Haneen Fathy', photo: 'images/students/Haneen Fathy.jpg' },
  { name: 'Alaa Adel', photo: 'images/students/Alaa Adel_.png' },
  { name: 'Menna elghamry', photo: 'images/students/Menna elghamry_.jpg' },
  { name: 'Sara Mahmoud', photo: 'images/students/Sara Mahmoud.png' },
  { name: 'Samar Ibrahim', photo: 'images/students/Samar Ibrahim_.jpg' },
  { name: 'Menna Abdelmonsef', photo: 'images/students/Menna Abdelmonsef_.jpg' },
  { name: 'Omnia mohamed', photo: 'images/students/Omnia mohamed.jpg' },
  { name: 'Amany Mamdouh', photo: 'images/students/Amany Mamdouh.png' },
  { name: 'Areej Tamer', photo: 'images/students/Areej Tamer_.jpg' },
  { name: 'Asmaa nagi', photo: 'images/students/Asmaa nagi.png', badge: 'LEADER' },
  { name: 'Eman Ahmed', photo: 'images/students/Eman Ahmed Ads.png' },
  { name: 'Ahd Sayed', photo: 'images/students/Ahd Sayed.jpg' },
  { name: 'Fatma Alzhraa Ahmed', photo: 'images/students/Fatma Alzhraa Ahmed_.png' },
  { name: 'Kholud Khalil', photo: 'images/students/Kholud Khalil.png' },
  { name: 'Maryam Mohamed Bdr-Eldeen', photo: 'images/students/Maryam Mohamed Bdr-Eldeen_.png' },
  // -------------------------------------------------------------------------

  // -------------------------------------------------------------------------
  // ✅ الصور اللي اتضافت تلقائي من فولدر images/students (كل الصور الموجودة)
  // -------------------------------------------------------------------------
  { name: 'Abdelhamed Elnazeh', photo: 'images/students/Abdelhamed Elnazeh.jpg' },
  { name: 'Abdelrahman Elaidy', photo: 'images/students/Abdelrahman Elaidy_.jpg' },
  { name: 'Ahmed AbdElNasser', photo: 'images/students/Ahmed AbdElNasser.png' },
  { name: 'Ahmed Barakat', photo: 'images/students/Ahmed Barakat.png' },
  { name: 'Ahmed El-Shawadfi', photo: 'images/students/Ahmed El-Shawadfi.jpg' },
  { name: 'Ahmed Elhemaly', photo: 'images/students/Ahmed Elhemaly.png' },
  { name: 'Ahmed Mohamed', photo: 'images/students/Ahmed Mohamed.jpg' },
  { name: 'Abdallah Ashraf', photo: 'images/students/Abdallah Ashraf.jpg' },
  { name: 'Ahmed elhady', photo: 'images/students/Ahmed elhady_.png' },
  { name: 'Amany Hany', photo: 'images/students/Amany Hany.jpg' },
  { name: 'Amira Ahmed', photo: 'images/students/Amira Ahmed.png' },
  { name: 'Arwa Essam', photo: 'images/students/Arwa Essam_.png' },
  { name: 'Asmaa Salama', photo: 'images/students/Asmaa Salama.jpg' },
  { name: 'Asmaa ahmed', photo: 'images/students/Asmaa ahmed.jpg' },
  { name: 'Basmala Ahmed', photo: 'images/students/Basmala Ahmed.jpg' },
  { name: 'Clara Wageeh', photo: 'images/students/Clara Wageeh.png' },
  { name: 'Dina Abdelal', photo: 'images/students/Dina Abdelal.png' },
  { name: 'Dina ibrahim', photo: 'images/students/Dina ibrahim.png' },
  { name: 'Mahmoud Nabil', photo: 'images/students/Mahmoud Nabil_.jpg' },
  { name: 'Fatma Ali', photo: 'images/students/Fatma Ali.jpg' },
  { name: 'Fatma Mekky', photo: 'images/students/Fatma Mekky.jpg' },
  { name: 'Hader Wahed', photo: 'images/students/Hader Wahed.jpg' },
  { name: 'Hager Mahmoud', photo: 'images/students/Hager Mahmoud_.png' },
  { name: 'Mohamed Gomaa', photo: 'images/students/Mohamed Gomaa.png' },
  { name: 'Haneen Ahmed', photo: 'images/students/Haneen Ahmed.png' },
  { name: 'Hassan Salama', photo: 'images/students/Hassan Salama.png' },
  { name: 'Heba Reda', photo: 'images/students/Heba Reda .png' },
  { name: 'Kholoud hani', photo: 'images/students/Kholoud hani.jpg' },
  { name: 'Asmaa Hossini', photo: 'images/students/Asmaa Hossini.jpg' },
  { name: 'Laila bahgat', photo: 'images/students/Laila bahgat_.png' },
  { name: 'Mahmoud Ashraf Gaber', photo: 'images/students/Mahmoud Ashraf Gaber.png' },
  { name: 'Mahmoud Salah', photo: 'images/students/Mahmoud Salah.png' },
  { name: 'Mahmoud Zedan', photo: 'images/students/Mahmoud Zedan_.jpg' },
  { name: 'Malak Daood', photo: 'images/students/Malak Daood.jpg' },
  { name: 'Malak Mohamed', photo: 'images/students/Malak Mohamed .jpg' },
  { name: 'Manal Mohammed', photo: 'images/students/Manal Mohammed_.jpg' },
  { name: 'Maram Waleed', photo: 'images/students/Maram Waleed.jpg' },
  { name: 'Mariam Samir', photo: 'images/students/Mariam Samir.jpg' },
  { name: 'Marlien Saleh', photo: 'images/students/Marlien Saleh.png' },
  { name: 'Ali Montaser', photo: 'images/students/Ali Montaser.jpg' },
  { name: 'Ahmed Yassin', photo: 'images/students/Ahmed Yassin.jpg' },
  { name: 'Mohamed Ahmed Al Bukhari', photo: 'images/students/Mohamed Ahmed Al Bukhari.jpg', badge: 'LEADER' },
  { name: 'Basel El-sayed', photo: 'images/students/Basel El-sayed.jpg' },
  { name: 'Marwa Abdelmoneim1', photo: 'images/students/Marwa Abdelmoneim1.jpg' },
  { name: 'Marwa Elsayed', photo: 'images/students/Marwa Elsayed_.jpg' },
  { name: 'Marwa Mohammed', photo: 'images/students/Marwa Mohammed_.jpg' },
  { name: 'Medhat Sebeai', photo: 'images/students/Medhat Sebeai_.jpg' },
  { name: 'Menna Ahmed Hassan', photo: 'images/students/Menna Ahmed Hassan.jpg' },
  { name: 'Menna Arafat', photo: 'images/students/Menna Arafat.jpg' },
  { name: 'Menna Sami', photo: 'images/students/Menna Sami_.png' },
  { name: 'Merna Abdelrhman', photo: 'images/students/Merna Abdelrhman.jpg' },
  { name: 'Mohamed Hamed', photo: 'images/students/Mohamed Hamed.png' },
  { name: 'Mohamed khairy elsayed', photo: 'images/students/Mohamed khairy elsayed_.png' },
  { name: 'Mohamed younis', photo: 'images/students/Mohamed younis.jpg' },
  { name: 'Mohammed Elsafty', photo: 'images/students/Mohammed Elsafty.png' },
  { name: 'Mona Khalil', photo: 'images/students/Mona Khalil_.jpg' },
  { name: 'Nada Radwan', photo: 'images/students/Nada Radwan.jpg' },
  { name: 'Nakaa Mahmoud', photo: 'images/students/Nakaa Mahmoud_.png' },
  { name: 'Omnia Abohashim', photo: 'images/students/Omnia Abohashim.jpg' },
  { name: 'Omnia Mohamed Abdelhalem', photo: 'images/students/Omnia Mohamed Abdelhalem .jpg' },
  { name: 'Othman Salah', photo: 'images/students/Othman Salah_.jpg' },
  { name: 'Raghad Al-Sayed', photo: 'images/students/Raghad Al-Sayed.png' },
  { name: 'Rawan hesham', photo: 'images/students/Rawan hesham.jpg' },
  { name: 'Rokaia Rafaat', photo: 'images/students/Rokaia Rafaat.png' },
  { name: 'Salma khaled', photo: 'images/students/Salma khaled.jpg' },
  { name: 'Samar Abdelrahman', photo: 'images/students/Samar Abdelrahman.jpg' },
  { name: 'Abdelrhman Tarek', photo: 'images/students/Abdelrhman Tarek.jpg' },
  { name: 'Rahma Mohammed ', photo: 'images/students/Rahma Mohammed .png' },
  { name: 'Sgoud Yahya', photo: 'images/students/Sgoud Yahya.png' },
  { name: 'Shady Mohamed', photo: 'images/students/Shady Mohamed.png' },
  { name: 'Shahd Mohamed', photo: 'images/students/Shahd Mohamed.png' },
  { name: 'George Sobhi', photo: 'images/students/George Sobhi.png' },
  { name: 'Shaza Ayman', photo: 'images/students/Shaza Ayman.jpg' },
  { name: 'Shehab Samir', photo: 'images/students/Shehab Samir_.png' },
  { name: 'Shimaa Mahmoud', photo: 'images/students/Shimaa Mahmoud_.png' },
  { name: 'Shorouk Nassar', photo: 'images/students/Shorouk Nassar.png' },
  { name: 'Shrouk el-sayed', photo: 'images/students/Shrouk el-sayed.png' },
  { name: 'Sohila Tarek', photo: 'images/students/Sohila Tarek.jpg' },
  { name: 'Suha othman', photo: 'images/students/Suha othman.jpg' },
  { name: 'Tasneem Elsayed', photo: 'images/students/Tasneem Elsayed.png' },
  { name: 'Yasmine Mahmoud', photo: 'images/students/Yasmine Mahmoud333.png' },
  { name: 'Teslem Abdelwedoud', photo: 'images/students/Teslem Abdelwedoud.png' },
  { name: 'Hajar ahmed', photo: 'images/students/Hajar ahmed.png' },
  { name: 'Yasmeen mohamed', photo: 'images/students/Yasmeen mohamed.jpg' },
  { name: 'menna Abozied', photo: 'images/students/menna Abozied.jpg' },
  { name: 'seif ashraf', photo: 'images/students/seif ashraf .png' },
  { name: 'Menna Ahmed Hassan', photo: 'images/students/Menna Ahmed Hassan.jpg' },
  { name: 'Mona Khalil', photo: 'images/students/Mona Khalil.jpg' },
  { name: 'Shorouk Salah', photo: 'images/students/Shorouk Salah.png' },
  { name: 'Mariam mohamed', photo: 'images/students/Mariam mohamed.png' },
  { name: 'Eslam Mohamed', photo: 'images/students/Eslam Mohamed1.png' },
  { name: 'Ahmed Mohamed', photo: 'images/students/Ahmed Mohamed.png' },
  { name: 'Ahmed Mohamed', photo: 'images/students/Ahmed Mohamed11111111.jpg' },
  { name: 'NouRan Magdy', photo: 'images/students/NouRan Magdy.png' },
  { name: 'Reham Shehata', photo: 'images/students/Reham Shehata.png' },
  { name: 'Ahmed Abdelal', photo: 'images/students/Ahmed Abdelal.jpg' },
  { name: 'Mohamed Ashraf', photo: 'images/students/Mohamed Ashraf.png' },
  { name: 'Mohamed Refaat', photo: 'images/students/Mohamed Refaat.jpg', badge: 'LEADER' },
  { name: 'Ahmed Mohamed Ahmed', photo: 'images/students/Ahmed Mohamed Ahmed.png' },
  { name: 'Marwan Ahmed', photo: 'images/students/Marwan Ahmed.jpg' },
  { name: 'Somaia elsayed', photo: 'images/students/Somaia elsayed.jpg' },
  { name: 'A’laa Ahmed', photo: 'images/students/A’laa Ahmed.jpg' },
  { name: 'Samar Mohammed', photo: 'images/students/Samar Mohammed.jpg' },
  { name: 'Amany Ali', photo: 'images/students/Amany Ali.jpg' },
  { name: 'Asmaa Mohammed Ali', photo: 'images/students/Asmaa Mohammed Ali.jpg' },
  

  
  
  {
     name: 'احمد السيد سلامة',
     photo: 'images/students/photo-name.jpg',
     memorial: true,
     memorialText: 'رحمه الله',
     memorialDua: 'اللهم اغفر له وارحمه وأسكنه فسيح جناتك',
   },
];

/* -------------------------------------------------------------------------
   4.1) ترقيم صفحات الصور (Pagination)
   -------------------------------------------------------------------------
   كل صفحة بتعرض PAGE_SIZE صورة بس. لو دوست على رقم صفحة تانية،
   بيتغير المحتوى ويظهر باقي الصور. عدد الصفحات بيتحسب تلقائياً
   حسب عدد الصور الموجودة في الأرايه "students".
   ------------------------------------------------------------------------- */
const GALLERY_PAGE_SIZE = 30;
let currentGalleryPage = 1;

function studentCardMarkup(student) {
  const isMemorial = Boolean(student.memorial);
  const isVip = !isMemorial && (student.badge || student.vip);

  // كارت الطالب المتوفى بيتقلب لما تدوس عليه، فبنبني له تركيبة مختلفة
  // (وش فيه صورته، وضهر فيه الدعاء) بدل الكارت العادي.
  if (isMemorial) {
    const dua = student.memorialDua || 'اللهم اغفر له وارحمه، وأسكنه فسيح جناتك، واجعل قبره روضة من رياض الجنة';
    return `
      <div class="student-card memorial-card" role="button" tabindex="0" aria-label="اضغط لعرض الدعاء لـ ${student.name}">
        <div class="memorial-flip">
          <div class="memorial-flip-front">
            <div class="student-photo-wrap">
              <span class="memorial-ribbon">In Loving Memory</span>
              <img
                src="${student.photo}"
                alt="${student.name}"
                loading="lazy"
                onerror="this.onerror=null; this.src='images/students/default-avatar.svg';"
              />
            </div>
            <div class="student-info">
              <p class="student-name">${student.name}</p>
              <span class="memorial-label">${student.memorialText || 'رحمه الله'}</span>
            </div>
            <span class="memorial-flip-hint">اضغط لعرض الدعاء 🕊️</span>
          </div>
          <div class="memorial-flip-back">
            <p class="memorial-dua">${dua}</p>
          </div>
        </div>
      </div>`;
  }

  return `
      <div class="student-card${isVip ? ' vip-card' : ''}">
        <div class="student-photo-wrap">
          ${isVip ? `<span class="vip-ribbon">${student.badge || 'VIP'}</span>` : ''}
          <img
            src="${student.photo}"
            alt="${student.name}"
            loading="lazy"
            onerror="this.onerror=null; this.src='images/students/default-avatar.svg';"
          />
        </div>
        <div class="student-info">
          <p class="student-name">${student.name}</p>
          ${isVip ? `<span class="vip-label">${student.badge || 'VIP'}</span>` : ''}
        </div>
      </div>`;
}

function renderPaginationControls(totalPages) {
  const pagination = document.getElementById('gallery-pagination');
  if (!pagination) return;

  // لو صفحة واحدة بس، مفيش داعي نظهر الترقيم خالص
  if (totalPages <= 1) {
    pagination.innerHTML = '';
    return;
  }

  let buttons = '';

  buttons += `<button type="button" class="gallery-page-btn gallery-page-nav" data-page="${currentGalleryPage - 1}" ${currentGalleryPage === 1 ? 'disabled' : ''} aria-label="الصفحة السابقة">‹</button>`;

  for (let page = 1; page <= totalPages; page += 1) {
    buttons += `<button type="button" class="gallery-page-btn${page === currentGalleryPage ? ' active' : ''}" data-page="${page}" aria-label="صفحة ${page}" ${page === currentGalleryPage ? 'aria-current="page"' : ''}>${page}</button>`;
  }

  buttons += `<button type="button" class="gallery-page-btn gallery-page-nav" data-page="${currentGalleryPage + 1}" ${currentGalleryPage === totalPages ? 'disabled' : ''} aria-label="الصفحة التالية">›</button>`;

  pagination.innerHTML = buttons;

  pagination.querySelectorAll('[data-page]').forEach((button) => {
    button.addEventListener('click', () => {
      const targetPage = Number(button.dataset.page);
      goToGalleryPage(targetPage);
    });
  });
}

function goToGalleryPage(page) {
  const totalPages = Math.max(1, Math.ceil(students.length / GALLERY_PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  currentGalleryPage = safePage;
  renderGallery();

  const gallerySection = document.getElementById('gallery');
  if (gallerySection) {
    gallerySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function renderGallery() {
  const grid = document.getElementById('gallery-grid');
  if (!grid) return;

  const totalPages = Math.max(1, Math.ceil(students.length / GALLERY_PAGE_SIZE));
  currentGalleryPage = Math.min(Math.max(currentGalleryPage, 1), totalPages);

  const startIndex = (currentGalleryPage - 1) * GALLERY_PAGE_SIZE;
  const pageStudents = students.slice(startIndex, startIndex + GALLERY_PAGE_SIZE);

  grid.innerHTML = pageStudents.map(studentCardMarkup).join('');

  renderPaginationControls(totalPages);
}

renderGallery();

/* -------------------------------------------------------------------------
   4.1.1) قلب كارت "في ذكرى" عند الضغط عليه
   -------------------------------------------------------------------------
   بما إن الجريد بيتعاد رسمه (renderGallery) كل ما نغير صفحة، بنحط الـ
   event listener مرة واحدة على الحاوية نفسها (gallery-grid) بدل كل كارت،
   عشان يفضل شغال حتى بعد ما المحتوى يتغير.
   ------------------------------------------------------------------------- */
(function memorialCardFlip() {
  const grid = document.getElementById('gallery-grid');
  if (!grid) return;

  const toggleFlip = (card) => card.classList.toggle('is-flipped');

  grid.addEventListener('click', (event) => {
    const card = event.target.closest('.memorial-card');
    if (card) toggleFlip(card);
  });

  // عشان يبقى شغال كمان بلوحة المفاتيح (Enter أو مسطرة المسافة) للوصولية
  grid.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const card = event.target.closest('.memorial-card');
    if (!card) return;
    event.preventDefault();
    toggleFlip(card);
  });
})();

/* -------------------------------------------------------------------------
   4.2) Find Your Name
   -------------------------------------------------------------------------
   البحث سريع حتى لو المستخدم كتب الاسم بطريقة مختلفة شوية في المسافات
   أو الهمزات. النتيجة تظهر كـ Card مميز، وبعدها نقدر نوصله للكارت
   الأصلي داخل شبكة أفراد الدفعة بأنيميشن واضح.
   ------------------------------------------------------------------------- */
(function studentFinder() {
  const form = document.getElementById('find-name-form');
  const input = document.getElementById('student-search');
  const clearBtn = document.getElementById('clear-student-search');
  const status = document.getElementById('student-search-status');
  const result = document.getElementById('student-search-result');
  const grid = document.getElementById('gallery-grid');

  if (!form || !input || !status || !result || !grid) return;

  const normalize = (value) => String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^\u0600-\u06FF\u0621-\u064Aa-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ');

  const escapeHtml = (value) => String(value || '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));

  function findMatches(query) {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) return [];

    const words = normalizedQuery.split(' ').filter(Boolean);
    return students
      .map((student, index) => ({ student, index, name: normalize(student.name) }))
      .filter(({ name }) => words.every((word) => name.includes(word)));
  }

  function cardMarkup(student) {
    const isMemorial = Boolean(student.memorial);
    const isVip = !isMemorial && (student.badge || student.vip);
    return `
      <article class="search-result-card${isVip ? ' vip-card' : ''}${isMemorial ? ' memorial-card' : ''}">
        <div class="search-result-photo">
          ${isVip ? `<span class="vip-ribbon">${escapeHtml(student.badge || 'VIP')}</span>` : ''}
          ${isMemorial ? `<span class="memorial-ribbon">In Loving Memory</span>` : ''}
          <img src="${escapeHtml(student.photo)}" alt="${escapeHtml(student.name)}" onerror="this.onerror=null;this.src='images/students/default-avatar.svg';">
        </div>
        <div class="search-result-info">
          <span class="search-result-label">YOUR CARD</span>
          <h4>${escapeHtml(student.name)}</h4>
          ${isVip ? `<span class="vip-label">${escapeHtml(student.badge || 'VIP')}</span>` : ''}
          ${isMemorial ? `<span class="memorial-label">${escapeHtml(student.memorialText || 'رحمه الله')}</span>` : ''}
        </div>
      </article>`;
  }

  function focusStudent(index) {
    // نحسب الصفحة اللي فيها الطالب ده (لأن الجريد بقى بيعرض 30 صورة بس في كل صفحة)
    const targetPage = Math.floor(index / GALLERY_PAGE_SIZE) + 1;
    const localIndex = index % GALLERY_PAGE_SIZE;

    const highlightCard = () => {
      const cards = grid.querySelectorAll('.student-card');
      const card = cards[localIndex];
      if (!card) return;

      cards.forEach((item) => item.classList.remove('student-card--found'));
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });

      window.setTimeout(() => {
        card.classList.add('student-card--found');
        window.setTimeout(() => card.classList.remove('student-card--found'), 2200);
      }, 500);
    };

    if (currentGalleryPage !== targetPage) {
      goToGalleryPage(targetPage);
      // نستنى شوية عشان الصفحة الجديدة تترندر قبل ما نعمل سكرول وهايلايت
      window.setTimeout(highlightCard, 150);
    } else {
      highlightCard();
    }
  }

  function clearSearch() {
    input.value = '';
    clearBtn.hidden = true;
    status.textContent = '';
    result.innerHTML = '';
    input.focus();
  }

  function search(query, shouldScroll = true) {
    const matches = findMatches(query);
    clearBtn.hidden = !input.value;

    if (!normalize(query)) {
      status.textContent = '';
      result.innerHTML = '';
      return;
    }

    if (!matches.length) {
      status.innerHTML = '<span class="search-empty-dot"></span> مش لاقيين الاسم ده في الدفعة — جرّب تكتب الاسم الأول أو جزء منه.';
      result.innerHTML = '';
      return;
    }

    const first = matches[0];
    status.textContent = matches.length === 1
      ? 'لقيناك! دي بطاقتك في الدفعة ✨'
      : `لقينا ${matches.length} نتائج — اختار الكارت بتاعك:`;

    result.innerHTML = matches.slice(0, 6).map(({ student, index }) => `
      <button class="search-result-item" type="button" data-student-index="${index}" aria-label="عرض ${escapeHtml(student.name)}">
        ${cardMarkup(student)}
        <span class="search-result-arrow">عرض في الدفعة ↙</span>
      </button>
    `).join('');

    result.querySelectorAll('[data-student-index]').forEach((button) => {
      button.addEventListener('click', () => focusStudent(Number(button.dataset.studentIndex)));
    });

    if (shouldScroll && matches.length === 1) {
      result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    search(input.value, true);
  });

  input.addEventListener('input', () => {
    clearBtn.hidden = !input.value;
    if (!input.value.trim()) {
      status.textContent = '';
      result.innerHTML = '';
    } else {
      search(input.value, false);
    }
  });

  clearBtn.addEventListener('click', clearSearch);
})();

/* -------------------------------------------------------------------------
   4.5) دكاترة مميزين
   -------------------------------------------------------------------------
   عشان تضيف دكتور جديد:
   1) انسخ أي سطر من المصفوفة تحت.
   2) غيّر name و title و specialty و photo.
   3) حط الصورة داخل images/students/ أو أي فولدر صور تحبه،
      واكتب مسارها في photo.

   المثال الموجود مجرد نموذج:
   { 
     name: 'د. أحمد محمد',
     title: 'أستاذ دكتور',
     specialty: 'مثال - قسم الصيدلانيات',
     photo: 'images/students/default-avatar.svg'
   },

   وتقدر تغير "مثال" للبيانات الحقيقية للدكتور.
   ------------------------------------------------------------------------- */
const doctors = [
  {
    name: 'Dr. Eslam Mohamed',
    title: 'Assistant Lecturer in Pharmaceuticl Organic Chemistry',
    specialty: 'Organic Chemistry',
    photo: 'images/students/dr/DR. ESLAM.jpg'
  },
 {
    name: 'Dr. Mahinour   Emerah',
    title: 'Demonstrator',
    specialty: 'pharmacognosy',
    photo: 'images/students/dr/DR.Mahinour Emerah.jpg'
  },
  {
    name: 'Dr.Yasmine Mohammed',
    title: 'Demonstrator',
    specialty: 'Organic Chemistry',
    photo: 'images/students/dr/DR.Yasmine Mohammed.jpg'
  },
  {
    name: 'Dr.Asmaa Qutb',
    title: 'Demonstrator',
    specialty: 'microbiology',
    photo: 'images/students/dr/Dr.Asmaa Qutb.jpg'
  },
  {
    name: 'Dr. Nourhan Mohamed',
    title: 'Demonstrator',
    specialty: 'pharmacognosy',
    photo: 'images/students/dr/Dr.Nourhan.jpg'
  },
  
  // انسخ الكارت اللي فوق هنا لإضافة دكتور جديد:
  // {
  //   name: 'د. اسم الدكتور',
  //   title: 'أستاذ دكتور',
  //   specialty: 'القسم / التخصص',
  //   photo: 'images/students/doctor-name.jpg'
  // },
];

function renderDoctors() {
  const grid = document.getElementById('doctors-grid');
  if (!grid) return;

  grid.innerHTML = doctors
    .map(
      (doctor) => `
      <article class="doctor-card">
        <div class="doctor-glow"></div>
        <div class="doctor-photo-wrap">
          <div class="doctor-photo-ring"></div>
          <img
            src="${doctor.photo}"
            alt="${doctor.name}"
            loading="lazy"
            onerror="this.onerror=null; this.src='images/students/default-avatar.svg';"
          />
        </div>
        <div class="doctor-content">
          <span class="doctor-kicker">دكتور مميز</span>
          <h3>${doctor.name}</h3>
          <p class="doctor-title">${doctor.title}</p>
          <div class="doctor-divider"></div>
          <p class="doctor-specialty">${doctor.specialty}</p>
        </div>
        <div class="doctor-corner"></div>
      </article>`
    )
    .join('');
}

renderDoctors();

/* -------------------------------------------------------------------------
   6) قائمة التنقل في الموبايل (فتح/قفل)
   ------------------------------------------------------------------------- */
const navToggle = document.getElementById('nav-toggle');
const siteNav = document.getElementById('site-nav');

if (navToggle && siteNav) {
  navToggle.addEventListener('click', () => {
    const isOpen = siteNav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });

  // نقفل القائمة تلقائياً بعد الضغط على أي رابط (تجربة استخدام أحسن على الموبايل)
  siteNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      siteNav.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

/* -------------------------------------------------------------------------
   7) أنيميشن ظهور الأقسام تدريجياً أثناء التمرير
   ------------------------------------------------------------------------- */
const revealElements = document.querySelectorAll('.reveal');

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15 }
);

revealElements.forEach((el) => revealObserver.observe(el));

/* -------------------------------------------------------------------------
   8) سنة حقوق النشر في الفوتر (تتحدث تلقائي كل سنة)
   ------------------------------------------------------------------------- */
const footerYear = document.getElementById('footer-year');
if (footerYear) {
  footerYear.textContent = new Date().getFullYear();
}

/* -------------------------------------------------------------------------
   9) زرار الوضع الداكن (Dark Mode) في الفوتر
   ------------------------------------------------------------------------- */
(function themeToggle() {
  const root = document.documentElement;
  const themeBtn = document.getElementById('theme-toggle');
  const themeIcon = document.getElementById('theme-toggle-icon');
  const themeText = document.getElementById('theme-toggle-text');

  if (!themeBtn) return;

  function applyTheme(isDark) {
    root.setAttribute('data-theme', isDark ? 'dark' : 'light');
    themeBtn.setAttribute('aria-pressed', String(isDark));
    themeBtn.setAttribute(
      'aria-label',
      isDark ? 'إلغاء الوضع الداكن' : 'تفعيل الوضع الداكن'
    );
    if (themeIcon) themeIcon.textContent = isDark ? '☀️' : '🌙';
    if (themeText) themeText.textContent = isDark ? 'الوضع الفاتح' : 'الوضع الداكن';
    try {
      localStorage.setItem('site-theme', isDark ? 'dark' : 'light');
    } catch (e) {
      // لو المتصفح مانع الوصول لـ localStorage، الموقع يفضل شغال عادي
      // بس الاختيار مش هيتحفظ بين الزيارات
    }
  }

  // نظبط شكل الزرار على حسب الاختيار المحفوظ (اتظبط بدري في <head> عشان مفيش فلاش)
  applyTheme(root.getAttribute('data-theme') === 'dark');

  themeBtn.addEventListener('click', () => {
    const isDark = root.getAttribute('data-theme') === 'dark';
    applyTheme(!isDark);
  });
})();
