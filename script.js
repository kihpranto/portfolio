/* ═══════════════════════════════════════════
   KIH Portfolio — Core Script
   Glassmorphism 2.0 + Premium Icons
   ═══════════════════════════════════════════ */

(function () {
  'use strict';

  /* ─── Scroll Navbar Glass ─── */
  const navbar = document.getElementById('navbar');
  const onScroll = () => {
    if (!navbar) return;
    navbar.classList.toggle('scrolled', window.scrollY > 50);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ─── Mobile Menu ─── */
  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      toggle.classList.toggle('active');
      links.classList.toggle('active');
      document.body.style.overflow = links.classList.contains('active') ? 'hidden' : '';
    });
    links.querySelectorAll('.nav-link').forEach(l => l.addEventListener('click', () => {
      toggle.classList.remove('active');
      links.classList.remove('active');
      document.body.style.overflow = '';
    }));
  }

  /* ─── Active Link on Scroll ─── */
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-link');
  const updateActive = () => {
    const y = window.scrollY + 160;
    sections.forEach(s => {
      const t = s.offsetTop, h = s.offsetHeight, id = s.getAttribute('id');
      if (y >= t && y < t + h) {
        navLinks.forEach(l => {
          l.classList.toggle('active', l.getAttribute('href') === '#' + id);
        });
      }
    });
  };
  window.addEventListener('scroll', updateActive, { passive: true });

  /* ─── Scroll Reveal Animations ─── */
  const animEls = document.querySelectorAll('[data-animate]');
  const revealObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const delay = parseInt(e.target.dataset.delay || '0');
        setTimeout(() => e.target.classList.add('visible'), delay);
        revealObs.unobserve(e.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  animEls.forEach(el => revealObs.observe(el));

  /* ─── Stat Counter ─── */
  const counters = document.querySelectorAll('[data-count]');
  const counterObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;
      const end = parseInt(el.dataset.count);
      const dur = 1800;
      const start = performance.now();
      const run = (now) => {
        const p = Math.min((now - start) / dur, 1);
        const ease = 1 - Math.pow(1 - p, 4);
        el.textContent = Math.round(ease * end);
        if (p < 1) requestAnimationFrame(run);
      };
      requestAnimationFrame(run);
      counterObs.unobserve(el);
    });
  }, { threshold: 0.5 });
  counters.forEach(c => counterObs.observe(c));

  /* ─── Skill Bars ─── */
  const bars = document.querySelectorAll('.bar-fill');
  const barObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.style.width = e.target.dataset.width + '%';
        barObs.unobserve(e.target);
      }
    });
  }, { threshold: 0.3 });
  bars.forEach(b => barObs.observe(b));

  /* ─── Back to Top ─── */
  const btt = document.getElementById('backToTop');
  if (btt) {
    window.addEventListener('scroll', () => {
      btt.classList.toggle('visible', window.scrollY > 500);
    }, { passive: true });
    btt.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  /* ─── Particle Canvas ─── */
  const canvas = document.getElementById('particles');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let w, h, pts;
    const init = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      const count = Math.min(Math.floor((w * h) / 18000), 80);
      pts = Array.from({ length: count }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - .5) * .25, vy: (Math.random() - .5) * .25,
        r: Math.random() * 1.3 + .3,
        a: Math.random() * .4 + .1
      }));
    };
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(6,182,212,${p.a})`;
        ctx.fill();
      });
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.strokeStyle = `rgba(6,182,212,${.07 * (1 - dist / 120)})`;
            ctx.stroke();
          }
        }
      }
      requestAnimationFrame(draw);
    };
    init();
    draw();
    let rT;
    window.addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(init, 200); });
  }
})();
