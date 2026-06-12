/* ============================================================
   NAVIGATION — scroll behaviour + mobile hamburger
   ============================================================ */
const nav         = document.getElementById('nav');
const hamburger   = document.getElementById('hamburger');
const navLinks    = document.getElementById('navLinks');

window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 20);
}, { passive: true });

hamburger.addEventListener('click', () => {
  const open = hamburger.classList.toggle('open');
  navLinks.classList.toggle('open', open);
  hamburger.setAttribute('aria-expanded', String(open));
});

navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    hamburger.classList.remove('open');
    navLinks.classList.remove('open');
  });
});

/* ============================================================
   TYPEWRITER
   ============================================================ */
const phrases   = ['Full-Stack Developer', 'UI/UX Enthusiast', 'Open-Source Contributor', 'Problem Solver'];
const typeEl    = document.getElementById('typewriter');
let phraseIdx   = 0;
let charIdx     = 0;
let deleting    = false;
let pauseTimer  = null;

function type() {
  const current = phrases[phraseIdx];
  if (deleting) {
    typeEl.textContent = current.slice(0, --charIdx);
  } else {
    typeEl.textContent = current.slice(0, ++charIdx);
  }

  let delay = deleting ? 55 : 90;

  if (!deleting && charIdx === current.length) {
    delay = 1800;
    deleting = true;
  } else if (deleting && charIdx === 0) {
    deleting = false;
    phraseIdx = (phraseIdx + 1) % phrases.length;
    delay = 400;
  }

  clearTimeout(pauseTimer);
  pauseTimer = setTimeout(type, delay);
}

type();

/* ============================================================
   SCROLL REVEAL
   ============================================================ */
function addRevealClass() {
  document.querySelectorAll(
    '.skill-card, .project-card, .about__grid, .contact__grid, .stat, .about__photo'
  ).forEach(el => el.classList.add('reveal'));
}

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      setTimeout(() => entry.target.classList.add('visible'), i * 80);
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

addRevealClass();
document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

/* ============================================================
   SKILL BARS — animate when visible
   ============================================================ */
const barObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.querySelectorAll('.bar__fill').forEach(bar => {
        bar.style.width = (bar.dataset.width || 0) + '%';
      });
      barObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.3 });

document.querySelectorAll('.skill-card').forEach(card => barObserver.observe(card));

/* ============================================================
   PROJECT FILTER
   ============================================================ */
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const filter = btn.dataset.filter;
    document.querySelectorAll('.project-card').forEach(card => {
      const match = filter === 'all' || card.dataset.category === filter;
      card.classList.toggle('hidden', !match);
    });
  });
});

/* ============================================================
   CONTACT FORM — client-side validation + mock submit
   ============================================================ */
const form       = document.getElementById('contactForm');
const submitBtn  = document.getElementById('submitBtn');
const formSuccess = document.getElementById('formSuccess');

const fields = {
  name:    { el: document.getElementById('name'),    err: document.getElementById('nameError'),    min: 2 },
  email:   { el: document.getElementById('email'),   err: document.getElementById('emailError'),   email: true },
  subject: { el: document.getElementById('subject'), err: document.getElementById('subjectError'), min: 3 },
  message: { el: document.getElementById('message'), err: document.getElementById('messageError'), min: 10 },
};

function validateField(key) {
  const { el, err, min, email } = fields[key];
  const val = el.value.trim();
  let msg = '';

  if (!val) {
    msg = 'This field is required.';
  } else if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
    msg = 'Please enter a valid email address.';
  } else if (min && val.length < min) {
    msg = `Must be at least ${min} characters.`;
  }

  el.classList.toggle('error', !!msg);
  err.textContent = msg;
  return !msg;
}

Object.keys(fields).forEach(key => {
  fields[key].el.addEventListener('blur', () => validateField(key));
  fields[key].el.addEventListener('input', () => {
    if (fields[key].el.classList.contains('error')) validateField(key);
  });
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const valid = Object.keys(fields).map(validateField).every(Boolean);
  if (!valid) return;

  const btnText   = submitBtn.querySelector('.btn__text');
  const btnLoader = submitBtn.querySelector('.btn__loader');

  submitBtn.disabled = true;
  btnText.hidden = true;
  btnLoader.hidden = false;

  await new Promise(r => setTimeout(r, 1500));

  submitBtn.disabled = false;
  btnText.hidden = false;
  btnLoader.hidden = true;

  form.reset();
  Object.keys(fields).forEach(k => {
    fields[k].el.classList.remove('error');
    fields[k].err.textContent = '';
  });

  formSuccess.hidden = false;
  setTimeout(() => { formSuccess.hidden = true; }, 6000);
});

/* ============================================================
   FOOTER — current year
   ============================================================ */
document.getElementById('year').textContent = new Date().getFullYear();

/* ============================================================
   ACTIVE NAV LINK — highlight on scroll
   ============================================================ */
const sections  = document.querySelectorAll('section[id]');
const navAnchors = document.querySelectorAll('.nav__links a');

const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      navAnchors.forEach(a => a.removeAttribute('style'));
      const active = document.querySelector(`.nav__links a[href="#${entry.target.id}"]`);
      if (active) active.style.color = 'var(--text)';
    }
  });
}, { threshold: 0.4 });

sections.forEach(s => sectionObserver.observe(s));
