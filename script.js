/* ═══════════════════════════════════════════════════════════════
   KAZI MD IKRAMUL HASSAN (KIH) — CORE INTERACTIVE JAVASCRIPT
   Mobile Drawer • Scroll-Spy • Counter Animation • Particles
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ─── Initialize Lucide Icons ─── */
  function initIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  /* ─── Sticky Glass Navbar on Scroll ─── */
  const navbar = document.getElementById('navbar');
  const handleScrollNav = () => {
    if (!navbar) return;
    navbar.classList.toggle('scrolled', window.scrollY > 30);
  };
  window.addEventListener('scroll', handleScrollNav, { passive: true });
  handleScrollNav();

  /* ─── Mobile Sidebar Navigation Drawer ─── */
  const navToggle = document.getElementById('navToggle');
  const mobileNavDrawer = document.getElementById('mobileNavDrawer');
  const mobileNavBackdrop = document.getElementById('mobileNavBackdrop');
  const mobileNavClose = document.getElementById('mobileNavClose');
  const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');

  function openMobileDrawer() {
    if (!mobileNavDrawer || !mobileNavBackdrop) return;
    mobileNavDrawer.classList.add('active');
    mobileNavBackdrop.classList.add('active');
    if (navToggle) {
      navToggle.classList.add('active');
      navToggle.setAttribute('aria-expanded', 'true');
    }
    document.body.classList.add('drawer-open');
    initIcons();
  }

  function closeMobileDrawer() {
    if (!mobileNavDrawer || !mobileNavBackdrop) return;
    mobileNavDrawer.classList.remove('active');
    mobileNavBackdrop.classList.remove('active');
    if (navToggle) {
      navToggle.classList.remove('active');
      navToggle.setAttribute('aria-expanded', 'false');
    }
    document.body.classList.remove('drawer-open');
  }

  if (navToggle) {
    navToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      if (mobileNavDrawer && mobileNavDrawer.classList.contains('active')) {
        closeMobileDrawer();
      } else {
        openMobileDrawer();
      }
    });
  }

  if (mobileNavClose) {
    mobileNavClose.addEventListener('click', (e) => {
      e.stopPropagation();
      closeMobileDrawer();
    });
  }

  if (mobileNavBackdrop) {
    mobileNavBackdrop.addEventListener('click', (e) => {
      e.stopPropagation();
      closeMobileDrawer();
    });
  }

  // Close drawer when any mobile nav link is clicked
  mobileNavLinks.forEach((link) => {
    link.addEventListener('click', () => {
      closeMobileDrawer();
    });
  });

  // Close on Escape key press
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMobileDrawer();
    }
  });

  /* ─── Active Section Highlight (Scroll-Spy) ─── */
  const sections = document.querySelectorAll('section[id]');
  const desktopLinks = document.querySelectorAll('.desktop-nav .nav-link');

  function updateActiveNav() {
    const atBottom = (window.innerHeight + window.scrollY) >= (document.documentElement.scrollHeight - 60);

    if (atBottom) {
      desktopLinks.forEach((link) => {
        link.classList.toggle('active', link.getAttribute('href') === '#contact');
      });
      mobileNavLinks.forEach((link) => {
        link.classList.toggle('active', link.getAttribute('href') === '#contact');
      });
      return;
    }

    const scrollPos = window.scrollY + 160;
    sections.forEach((section) => {
      const top = section.offsetTop;
      const height = section.offsetHeight;
      const id = section.getAttribute('id');

      if (scrollPos >= top && scrollPos < top + height) {
        // Desktop nav update
        desktopLinks.forEach((link) => {
          const href = link.getAttribute('href');
          link.classList.toggle('active', href === `#${id}`);
        });

        // Mobile nav update
        mobileNavLinks.forEach((link) => {
          const href = link.getAttribute('href');
          link.classList.toggle('active', href === `#${id}`);
        });
      }
    });
  }
  window.addEventListener('scroll', updateActiveNav, { passive: true });

  /* ─── Scroll Reveal Animations ─── */
  const animatedElements = document.querySelectorAll('[data-animate]');
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const delay = parseInt(entry.target.dataset.delay || '0', 10);
        setTimeout(() => {
          entry.target.classList.add('visible');
        }, delay);
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });

  animatedElements.forEach((el) => revealObserver.observe(el));

  /* ─── Stat Counter Increment Animation ─── */
  const counters = document.querySelectorAll('[data-count]');
  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const targetCount = parseInt(el.dataset.count, 10);
      const duration = 1800;
      const startTime = performance.now();

      const runCounter = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 4);
        el.textContent = Math.round(easeOut * targetCount);

        if (progress < 1) {
          requestAnimationFrame(runCounter);
        } else {
          el.textContent = targetCount;
        }
      };

      requestAnimationFrame(runCounter);
      counterObserver.unobserve(el);
    });
  }, { threshold: 0.3 });

  counters.forEach((c) => counterObserver.observe(c));

  /* ─── Animated Skill Bars ─── */
  const skillBars = document.querySelectorAll('.bar-fill');
  const skillObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.style.width = `${entry.target.dataset.width}%`;
        skillObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });

  skillBars.forEach((bar) => skillObserver.observe(bar));

  /* ─── Back to Top Button ─── */
  const backToTopBtn = document.getElementById('backToTop');
  if (backToTopBtn) {
    window.addEventListener('scroll', () => {
      backToTopBtn.classList.toggle('visible', window.scrollY > 400);
    }, { passive: true });

    backToTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ─── Ambient Interactive Particle Canvas ─── */
  const canvas = document.getElementById('particles');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let width, height, particles;

    const initCanvas = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      const count = Math.min(Math.floor((width * height) / 22000), 70);

      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: Math.random() * 1.3 + 0.4,
        alpha: Math.random() * 0.38 + 0.12
      }));
    };

    const drawParticles = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw particle dots
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(6, 182, 212, ${p.alpha})`;
        ctx.fill();
      });

      // Draw connecting filaments
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 105) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(6, 182, 212, ${0.055 * (1 - dist / 105)})`;
            ctx.stroke();
          }
        }
      }

      requestAnimationFrame(drawParticles);
    };

    initCanvas();
    drawParticles();

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(initCanvas, 200);
    });
  }

  // Initial execution
  initIcons();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initIcons);
  }
  window.addEventListener('load', initIcons);
})();
