/**
 * Floating Glassmorphic Bottom Navigation Dock
 * Faithfully styled after the high-end mobile reference design.
 * Features 4 circular frosted icon buttons with luminous active states.
 */

export function createFloatingBottomNav({
  activeTab = 'crop',
  onTabChange,
  pendingAlertsCount = 1
}) {
  const navContainer = document.createElement('nav');
  navContainer.className = "w-full flex justify-center py-2 pointer-events-auto select-none";
  navContainer.setAttribute('role', 'navigation');
  navContainer.setAttribute('aria-label', 'Main Agricultural Navigation');

  const tabs = [
    {
      id: 'overview',
      label: 'Bento Dashboard',
      badge: 0,
      icon: `
        <svg class="w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      `
    },
    {
      id: 'crop',
      label: 'Crop Overview',
      badge: 0,
      icon: `
        <svg class="w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M7 20h10"/>
          <path d="M10 20c5.5-2.5.8-6.4 3-10"/>
          <path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4-.1 5.5.8z"/>
          <path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/>
        </svg>
      `
    },
    {
      id: 'field',
      label: 'Field Zone Map',
      badge: pendingAlertsCount,
      icon: `
        <svg class="w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M3 7V5a2 2 0 0 1 2-2h2"/>
          <path d="M17 3h2a2 2 0 0 1 2 2v2"/>
          <path d="M21 17v2a2 2 0 0 1-2 2h-2"/>
          <path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
        </svg>
      `
    },
    {
      id: 'valves',
      label: 'Valve Controls',
      badge: 0,
      icon: `
        <svg class="w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect width="7" height="7" x="3" y="3" rx="1"/>
          <rect width="7" height="7" x="14" y="3" rx="1"/>
          <rect width="7" height="7" x="14" y="14" rx="1"/>
          <rect width="7" height="7" x="3" y="14" rx="1"/>
        </svg>
      `
    }
  ];

  navContainer.innerHTML = `
    <div class="aero-nav-dock relative flex items-center justify-between gap-3 px-3 py-2 rounded-full border border-white/15 shadow-2xl backdrop-blur-2xl bg-[#091b10]/90 transition-all duration-300">
      ${tabs.map(tab => {
        const isActive = tab.id === activeTab;
        return `
          <button 
            type="button"
            data-tab-id="${tab.id}" 
            title="${tab.label}"
            class="nav-tab-btn group relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 outline-none ${
              isActive 
                ? 'bg-gradient-to-b from-white/25 to-white/10 text-lime-300 shadow-[0_0_18px_rgba(163,230,53,0.45)] ring-1 ring-lime-400/50 scale-105' 
                : 'text-slate-300 hover:text-white hover:bg-white/10 active:scale-95'
            }"
            aria-label="${tab.label}"
            aria-selected="${isActive ? 'true' : 'false'}"
          >
            ${tab.icon}

            ${tab.badge > 0 ? `
              <span class="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-[#091b10] animate-pulse"></span>
            ` : ''}

            <!-- Subtitle Tooltip on Hover -->
            <span class="pointer-events-none absolute -top-8 px-2 py-0.5 rounded text-[10px] font-medium tracking-tight bg-slate-900/90 text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 border border-white/10 shadow-lg">
              ${tab.label}
            </span>
          </button>
        `;
      }).join('')}
    </div>
  `;

  // Attach tab click events
  navContainer.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tabId = btn.getAttribute('data-tab-id');
      if (tabId && onTabChange) {
        onTabChange(tabId);
      }
    });
  });

  return navContainer;
}
