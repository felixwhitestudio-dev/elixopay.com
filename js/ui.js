// UI utilities: theme toggle, reveal animations, skeleton hide, mobile menu
// v1.1.0 - Theme toggle with multi-language support
(function(){
  const STORAGE_KEY = 'elixopay-theme';
  const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  const saved = localStorage.getItem(STORAGE_KEY);
  const isLight = saved ? saved === 'light' : false; // default dark
  if (isLight) document.body.classList.add('light');

  // Apply ready state to remove skeleton
  window.addEventListener('load', () => {
    document.body.classList.add('ready');
  });

  // Theme toggle
  function updateToggleIcon(btn){
    console.log('🎨 updateToggleIcon called', { btn, exists: !!btn });
    if(!btn) return;
    const light = document.body.classList.contains('light');
    const lang = localStorage.getItem('elixopay_lang') || 'th';
    console.log('🎨 Theme state:', { light, lang });
    const labels = {
      th: { dark: 'โหมดมืด', light: 'โหมดสว่าง' },
      en: { dark: 'Dark Mode', light: 'Light Mode' },
      zh: { dark: '深色模式', light: '浅色模式' }
    };
    const text = light ? labels[lang].dark : labels[lang].light;
    console.log('🎨 Setting text:', text);
    btn.innerHTML = light ? `<i class="fas fa-moon"></i> ${text}` : `<i class="fas fa-sun"></i> ${text}`;
    console.log('🎨 After set, innerHTML:', btn.innerHTML);
    btn.setAttribute('aria-pressed', String(light));
  }
  document.addEventListener('DOMContentLoaded', () => {
    console.log('🎨 DOMContentLoaded fired');
    const toggle = document.getElementById('themeToggle');
    console.log('🎨 Found toggle button:', toggle);
    if (toggle) {
      updateToggleIcon(toggle);
      toggle.addEventListener('click', () => {
        document.body.classList.toggle('light');
        const nowLight = document.body.classList.contains('light');
        localStorage.setItem(STORAGE_KEY, nowLight ? 'light' : 'dark');
        updateToggleIcon(toggle);
      });

      // Update theme toggle text when language changes
      window.addEventListener('languageChanged', () => {
        updateToggleIcon(toggle);
      });
    }

    // Mobile menu toggle
    const mobileBtn = document.querySelector('.mobile-menu-btn');
    const navLinks = document.querySelector('.nav-links');
    if (mobileBtn && navLinks) {
      mobileBtn.addEventListener('click', () => {
        navLinks.classList.toggle('show');
      });
    }

    // Reveal on scroll
    const revealEls = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window && revealEls.length) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            e.target.classList.add('visible');
            io.unobserve(e.target);
          }
        });
      }, { threshold: 0.15 });
      revealEls.forEach(el => io.observe(el));
    } else {
      // Fallback: show all
      revealEls.forEach(el => el.classList.add('visible'));
    }
  });
})();
