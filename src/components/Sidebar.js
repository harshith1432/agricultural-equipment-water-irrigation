/**
 * AgriCare Role-Adaptive Sidebar Navigation
 * Dynamically presents navigation relevant to the active user persona:
 *  - Farm Owner (Executive overview, 1-acre parcel, water budget, harvest forecast)
 *  - Agronomist (Spectroscopy studio, 5 decision engines, optical calibration, voice TTS)
 *  - Field Operator (Hydraulic command, 6-zone solenoid actuation, FDR probes, emergency killswitch)
 *  - SuperAdmin (Multi-tenant governance, user management, telemetry chaos injection, audit logs)
 */

export function createSidebar({ activeView = 'dashboard', onNavigate, onLogout, currentRole = 'Farm Owner' }) {
  const sidebar = document.createElement('aside');
  sidebar.id = 'app-sidebar';
  sidebar.className = "w-64 bg-[#08182B] text-slate-300 flex flex-col shrink-0 min-h-screen border-r border-slate-850/80 transition-all duration-300 z-30 select-none";

  const normRole = (currentRole || 'Farm Owner').toLowerCase().replace(/[\s_-]+/g, '');

  let menuItems = [];

  if (normRole.includes('owner')) {
    // Farm Owner Menu
    menuItems = [
      {
        id: 'dashboard',
        label: 'Executive Overview',
        icon: `<svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>`
      },
      {
        id: 'parcel-matrix',
        label: '1-Acre Field Matrix',
        icon: `<svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>`
      },
      {
        id: 'water-budget',
        label: 'Water Budget & Savings',
        icon: `<svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>`
      },
      {
        id: 'synergy-alerts',
        label: 'Closed-Loop Actions',
        icon: `<svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`
      },
      {
        id: 'harvest-forecast',
        label: 'Yield & Ripeness Forecast',
        icon: `<svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/></svg>`
      },
      {
        id: 'audit-reports',
        label: 'Executive Audit (CSV)',
        icon: `<svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>`
      }
    ];
  } else if (normRole.includes('agronomist') || normRole.includes('science')) {
    // Agronomist Menu
    menuItems = [
      {
        id: 'dashboard',
        label: 'Spectroscopy Studio',
        icon: `<svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m9.17 14.83-4.24 4.24"/></svg>`
      },
      {
        id: 'decision-engines',
        label: '5 Decision Engines',
        icon: `<svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 7h10M7 12h10M7 17h10"/></svg>`
      },
      {
        id: 'nitrogen-calculator',
        label: 'Nitrogen & Urea Dosage',
        icon: `<svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`
      },
      {
        id: 'spectral-curve',
        label: '350–1100nm Reflectance',
        icon: `<svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>`
      },
      {
        id: 'calibration',
        label: 'Optical Calibration (PTFE)',
        icon: `<svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`
      },
      {
        id: 'voice-tts',
        label: 'Voice TTS Readout',
        icon: `<svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`
      }
    ];
  } else if (normRole.includes('operator') || normRole.includes('field')) {
    // Field Operator Menu
    menuItems = [
      {
        id: 'dashboard',
        label: 'Hydraulic Command',
        icon: `<svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>`
      },
      {
        id: 'field-topology',
        label: '1-Acre 6-Zone Canvas',
        icon: `<svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>`
      },
      {
        id: 'solenoid-valves',
        label: '±12V Valve Hub (G1–G6)',
        icon: `<svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>`
      },
      {
        id: 'soil-probes',
        label: 'FDR Depth Probes (10/30/50)',
        icon: `<svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" x2="12" y1="2" y2="22"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="6" x2="18" y1="12" y2="12"/><line x1="8" x2="16" y1="18" y2="18"/></svg>`
      },
      {
        id: 'telemetry-sim',
        label: 'Telemetry Simulator',
        icon: `<svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>`
      },
      {
        id: 'actuation-logs',
        label: 'Actuation Event Logs',
        icon: `<svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`
      }
    ];
  } else {
    // SuperAdmin Menu
    menuItems = [
      {
        id: 'dashboard',
        label: 'Platform Governance',
        icon: `<svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>`
      },
      {
        id: 'user-roster',
        label: 'User Roster & Access',
        icon: `<svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`
      },
      {
        id: 'chaos-engine',
        label: 'Telemetry Chaos Engine',
        icon: `<svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>`
      },
      {
        id: 'broadcasts',
        label: 'Emergency Broadcasts',
        icon: `<svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>`
      },
      {
        id: 'organizations',
        label: 'Enterprise Farms (18)',
        icon: `<svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/></svg>`
      },
      {
        id: 'audit-logs',
        label: 'Security & Audit Logs',
        icon: `<svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></svg>`
      }
    ];
  }

  sidebar.innerHTML = `
    <!-- Top Brand Logo Container -->
    <div class="p-3 pt-3">
      <div class="bg-white rounded-xl py-2 px-3 mx-1 shadow-sm flex items-center justify-center gap-2.5 cursor-pointer transition hover:opacity-95" id="sidebar-logo-card">
        <!-- AgriCare Emblem -->
        <div class="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center shrink-0 ring-1 ring-emerald-200/80">
          <svg class="w-5 h-5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10S2 17.523 2 12a10 10 0 0 1 10-10Z"/>
            <path d="m9 12 2 2 4-4"/>
          </svg>
        </div>
        <div class="flex items-center">
          <span class="text-base font-extrabold tracking-tight text-[#0B1E36]">Agri</span>
          <span class="text-base font-extrabold tracking-tight text-[#16A34A]">Care</span>
        </div>
      </div>
    </div>

    <!-- Navigation List -->
    <nav class="px-3 py-2 space-y-1 overflow-y-auto flex-1 text-[13px] font-medium custom-sidebar-scroll" id="sidebar-nav">
      ${menuItems.map(item => {
        const isActive = item.id === activeView;
        return `
          <button
            type="button"
            data-view="${item.id}"
            class="sidebar-nav-item w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition duration-150 text-left cursor-pointer ${
              isActive
                ? 'bg-[#1D68F2] text-white font-semibold shadow-md shadow-blue-900/40'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }"
          >
            ${item.icon}
            <span class="truncate">${item.label}</span>
          </button>
        `;
      }).join('')}
    </nav>

    <!-- Bottom Actions: Role Badge & Logout -->
    <div class="p-3 border-t border-slate-800/80 space-y-2">
      <div class="px-3 py-2 rounded-xl bg-slate-850/80 text-[11px] text-slate-400 font-mono flex items-center justify-between">
        <span>Active Persona:</span>
        <span class="font-bold text-white uppercase text-[10px]">${currentRole}</span>
      </div>

      <button
        type="button"
        id="sidebar-logout-btn"
        class="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition text-[13px] font-medium cursor-pointer"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>
        </svg>
        <span>Sign Out to Portal</span>
      </button>
    </div>
  `;

  // Attach event listeners
  const navButtons = sidebar.querySelectorAll('.sidebar-nav-item');
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const viewId = btn.getAttribute('data-view');
      if (onNavigate) onNavigate(viewId);
    });
  });

  const logoutBtn = sidebar.querySelector('#sidebar-logout-btn');
  if (logoutBtn && onLogout) {
    logoutBtn.addEventListener('click', onLogout);
  }

  const logoCard = sidebar.querySelector('#sidebar-logo-card');
  if (logoCard) {
    logoCard.addEventListener('click', () => {
      if (onNavigate) onNavigate('dashboard');
    });
  }

  return sidebar;
}
