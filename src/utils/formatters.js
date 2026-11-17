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
  if (score >= 75) return '#10B981'; // Emerald Glow
  if (score >= 50) return '#F59E0B'; // Amber Pulse
  return '#EF4444'; // Crimson Coral
}
