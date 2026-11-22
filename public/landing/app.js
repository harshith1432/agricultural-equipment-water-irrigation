/**
 * AgriSpectra Flow & Field - Landing Page Interactive Controller
 * Follows Unslop principles: calm, precise, interactive without gimmicks.
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Dynamic Copyright Year
  const yearSpan = document.getElementById('yearSpan');
  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }

  // 2. Mobile Navigation Drawer Toggle
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const mobileNavDrawer = document.getElementById('mobileNavDrawer');

  if (hamburgerBtn && mobileNavDrawer) {
    const toggleMenu = () => {
      const isOpen = mobileNavDrawer.classList.toggle('open');
      hamburgerBtn.setAttribute('aria-expanded', String(isOpen));
      hamburgerBtn.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
      document.body.style.overflow = isOpen ? 'hidden' : '';
    };

    hamburgerBtn.addEventListener('click', toggleMenu);

    // Close when clicking mobile links
    mobileNavDrawer.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mobileNavDrawer.classList.remove('open');
        hamburgerBtn.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });
    });

    // Close on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && mobileNavDrawer.classList.contains('open')) {
        toggleMenu();
      }
    });
  }

  // 3. Accessible FAQ Accordions
  const faqItems = document.querySelectorAll('.faq-accordion-item');
  faqItems.forEach((item) => {
    const btn = item.querySelector('.faq-header-btn');
    const content = item.querySelector('.faq-body-content');

    if (btn && content) {
      btn.setAttribute('aria-expanded', 'false');
      btn.addEventListener('click', () => {
        const isExpanded = btn.getAttribute('aria-expanded') === 'true';

        // Close other items for single-open accordion feel
        faqItems.forEach(otherItem => {
          if (otherItem !== item) {
            const otherBtn = otherItem.querySelector('.faq-header-btn');
            const otherContent = otherItem.querySelector('.faq-body-content');
            if (otherBtn && otherContent) {
              otherItem.classList.remove('open');
              otherBtn.setAttribute('aria-expanded', 'false');
              otherContent.style.maxHeight = null;
            }
          }
        });

        // Toggle current item
        if (isExpanded) {
          btn.setAttribute('aria-expanded', 'false');
          item.classList.remove('open');
          content.style.maxHeight = null;
        } else {
          btn.setAttribute('aria-expanded', 'true');
          item.classList.add('open');
          content.style.maxHeight = content.scrollHeight + 'px';
        }
      });
    }
  });

  // 4. Smooth Anchor Scrolling with Header Offset
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#' || !targetId) return;
      const targetEl = document.querySelector(targetId);
      if (targetEl) {
        e.preventDefault();
        const headerHeight = document.querySelector('.site-header')?.offsetHeight || 72;
        const targetPos = targetEl.getBoundingClientRect().top + window.pageYOffset - headerHeight;
        window.scrollTo({
          top: targetPos,
          behavior: 'smooth'
        });
      }
    });
  });

  // 5. Interactive Hero Telemetry Dial Simulation (Moments of Craft)
  const dialBoxes = document.querySelectorAll('.live-dial-box');
  const ndviVal = dialBoxes[0]?.querySelector('.dial-box-val');
  const vitalityVal = dialBoxes[1]?.querySelector('.dial-box-val');
  const actuatorBadges = document.querySelectorAll('.actuator-badge');

  // Interactive Valve Click Toggle
  actuatorBadges.forEach((badge, index) => {
    badge.style.cursor = 'pointer';
    badge.title = 'Click to toggle valve simulation';
    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = badge.classList.contains('active');
      if (isOpen) {
        badge.classList.remove('active');
        badge.classList.add('standby');
        badge.textContent = 'CLOSED';
      } else {
        badge.classList.remove('standby');
        badge.classList.add('active');
        badge.textContent = 'OPEN';
      }
    });
  });

  // 6. Direct APK Download Button Handler
  const downloadApkBtn = document.getElementById('downloadApkBtn');
  if (downloadApkBtn) {
    downloadApkBtn.addEventListener('click', (e) => {
      e.preventDefault();
      // Look for locally built APK or provide direct prompt
      const apkPath = '/android/app/build/outputs/apk/debug/app-debug.apk';
      const anchor = document.createElement('a');
      anchor.href = apkPath;
      anchor.download = 'AgriSpectra-Flow-and-Field.apk';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    });
  }
});
