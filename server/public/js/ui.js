// UI utilities: theme toggle, reveal animations, skeleton hide, mobile menu
// v1.1.1 - Cleanup debug logs; keep multi-language theme toggle
(function () {
  const STORAGE_KEY = 'elixopay-theme';
  const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;

  // Theme logic removed - preventing auto-switch to light/dark based on time/prefs
  // Default themes are now enforced by CSS per page (index/usecases = dark, about = light)

  // Apply ready state to remove skeleton
  window.addEventListener('load', () => {
    document.body.classList.add('ready');
  });

  // Theme toggle - REMOVED PER USER REQUEST
  // function updateToggleIcon(btn){ ... }

  document.addEventListener('DOMContentLoaded', () => {
    // Theme toggle removed
    /*
    const toggle = document.getElementById('themeToggle');
    if (toggle) {
      // Toggle logic removed
    }
    */

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

    /* ========================================================================= */
    /* DOCS PAGE: Developer Experience (DX) Enhancements                         */
    /* ========================================================================= */
    const isDocsPage = document.querySelector('.docs-sidebar') !== null;
    if (isDocsPage) {

      // 1. Smooth Scrolling for Sidebar Links
      const sidebarLinks = document.querySelectorAll('.docs-sidebar a');
      sidebarLinks.forEach(link => {
        link.addEventListener('click', function (e) {
          e.preventDefault();
          const targetId = this.getAttribute('href').substring(1);
          const targetElement = document.getElementById(targetId);
          if (targetElement) {
            // Offset for fixed navbar
            const y = targetElement.getBoundingClientRect().top + window.scrollY - 100;
            window.scrollTo({ top: y, behavior: 'smooth' });
          }
        });
      });

      // 2. ScrollSpy (Highlight Active Sidebar Link)
      const sections = Array.from(sidebarLinks).map(link => {
        const id = link.getAttribute('href').substring(1);
        return document.getElementById(id);
      }).filter(el => el != null);

      if (sections.length > 0) {
        window.addEventListener('scroll', () => {
          let current = '';
          const scrollY = window.scrollY;

          sections.forEach(section => {
            const sectionTop = section.offsetTop - 150; // Offset for navbar
            const sectionHeight = section.clientHeight;
            if (scrollY >= sectionTop && scrollY < sectionTop + sectionHeight) {
              current = section.getAttribute('id');
            }
          });

          // Edge case: if scrolled to the very bottom
          if ((window.innerHeight + scrollY) >= document.body.offsetHeight) {
            current = sections[sections.length - 1].getAttribute('id');
          }

          sidebarLinks.forEach(link => {
            link.classList.remove('active');
            if (current && link.getAttribute('href').includes(current)) {
              link.classList.add('active');
            }
          });
        });
      }

      // 4. Multi-Language Code Tabs Logic (Global Sync)
      const tabBtns = document.querySelectorAll('.code-tab-btn');
      if (tabBtns.length > 0) {
        tabBtns.forEach(btn => {
          btn.addEventListener('click', (e) => {
            const selectedLang = e.target.getAttribute('data-lang');

            // If it's a tab without a language (like JSON response), just toggle locally
            if (!selectedLang) {
              const container = e.target.closest('.code-tabs-container');
              if (container) {
                container.querySelectorAll('.code-tab-btn').forEach(b => b.classList.remove('active'));
                container.querySelectorAll('.code-tab-content').forEach(c => c.classList.remove('active'));
                e.target.classList.add('active');
              }
              return;
            }

            // Global Sync: find all tab groups on the page and switch them to the selected language
            const allTabBtns = document.querySelectorAll('.code-tab-btn[data-lang]');
            const allTabContents = document.querySelectorAll('.code-tab-content[data-lang]');

            allTabBtns.forEach(b => {
              if (b.getAttribute('data-lang') === selectedLang) {
                b.classList.add('active');
              } else {
                b.classList.remove('active');
              }
            });

            allTabContents.forEach(c => {
              if (c.getAttribute('data-lang') === selectedLang) {
                c.classList.add('active');
              } else {
                c.classList.remove('active');
              }
            });
          });
        });
      }

      // 5. Copy to Clipboard for Code Blocks
      const codeBlocks = document.querySelectorAll('.code-block');
      codeBlocks.forEach(block => {
        // Enforce relative positioning on the code block so the button anchors correctly
        block.style.position = 'relative';

        const copyBtn = document.createElement('button');
        copyBtn.innerHTML = '<i class="far fa-copy"></i> Copy';
        copyBtn.className = 'copy-btn';

        // Inline styles for the copy button to keep CSS centralized
        Object.assign(copyBtn.style, {
          position: 'absolute',
          top: '12px',
          right: '12px',
          background: 'rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          color: '#e2e8f0',
          padding: '4px 10px',
          borderRadius: '6px',
          fontSize: '0.8rem',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          zIndex: '10'
        });

        // Hover effects via JS events instead of CSS for simplicity in injection
        copyBtn.onmouseenter = () => {
          copyBtn.style.background = 'rgba(255, 255, 255, 0.2)';
        };
        copyBtn.onmouseleave = () => {
          if (copyBtn.innerText.includes('Copy')) {
            copyBtn.style.background = 'rgba(255, 255, 255, 0.1)';
          }
        };

        copyBtn.addEventListener('click', () => {
          // Exclude the button's own text from the copied content
          const textToCopy = Array.from(block.childNodes)
            .filter(node => node !== copyBtn)
            .map(node => node.textContent)
            .join('')
            .trim();

          navigator.clipboard.writeText(textToCopy).then(() => {
            copyBtn.innerHTML = '<i class="fas fa-check" style="color:#10b981;"></i> Copied!';
            copyBtn.style.background = 'rgba(16, 185, 129, 0.2)';
            copyBtn.style.borderColor = 'rgba(16, 185, 129, 0.3)';
            copyBtn.style.color = '#10b981';

            setTimeout(() => {
              copyBtn.innerHTML = '<i class="far fa-copy"></i> Copy';
              copyBtn.style.background = 'rgba(255, 255, 255, 0.1)';
              copyBtn.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              copyBtn.style.color = '#e2e8f0';
            }, 2000);
          }).catch(err => {
            console.error('Failed to copy text: ', err);
          });
        });

        block.appendChild(copyBtn);
      });
    }

  });
})();
