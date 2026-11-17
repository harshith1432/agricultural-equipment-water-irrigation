/**
 * UI & Telemetry Formatters
 */

export function formatTimeRemaining(timerEndIso) {
  if (!timerEndIso) return null;
  const target = new Date(timerEndIso).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((target - now) / 1000));

  if (diffSec <= 0) return "00:00";
  const mins = Math.floor(diffSec / 60);
  const secs = diffSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function getMoistureColor(vwc) {
  if (vwc < 20.0) {
    return {
      text: 'text-crimsonCoral',
      bg: 'bg-crimsonCoral/15',
      border: 'border-crimsonCoral/40',
      badge: 'Acute Stress / Deficit',
      hex: '#EF4444'
    };
  }
  if (vwc <= 32.0) {
    return {
      text: 'text-emeraldGlow',
      bg: 'bg-emeraldGlow/15',
      border: 'border-emeraldGlow/40',
      badge: 'Optimal Field Capacity',
      hex: '#10B981'
    };
  }
  return {
    text: 'text-amberPulse',
    bg: 'bg-amberPulse/15',
    border: 'border-amberPulse/40',
    badge: 'High Moisture / Saturated',
    hex: '#F59E0B'
  };
}

export function getVitalityColor(score) {
  const isCreamy = typeof document !== 'undefined' && 
    (document.body.classList.contains('theme-creamy-agri') || !document.body.classList.contains('theme-dark-soil'));
  if (score >= 75) return isCreamy ? '#2E7D32' : '#10B981'; // Deep Agricultural Green vs Emerald Glow
  if (score >= 50) return isCreamy ? '#D97706' : '#F59E0B'; // Warm Harvest Amber
  return isCreamy ? '#C53030' : '#EF4444'; // Agricultural Red Alert
}
