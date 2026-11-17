/**
 * CLI Mock Telemetry Generator
 * Simulates physical LoRaWAN / MQTT gateway broadcasting FDR soil moisture & line pressure.
 * Run with: npm run telemetry:mock
 */

const FARM_ID = "farm-valley-1";
const INTERVAL_SECONDS = 3;

const PLOTS = [
  { id: "plot-1", gate: "G1", crop: "Bell Peppers", baseVwc: 26.5 },
  { id: "plot-2", gate: "G2", crop: "Heirloom Drip Tomatoes", baseVwc: 13.8 }, // Deficit
  { id: "plot-3", gate: "G3", crop: "Sweet Corn", baseVwc: 31.0 },
  { id: "plot-4", gate: "G4", crop: "High-Density Strawberries", baseVwc: 21.5 },
  { id: "plot-5", gate: "G5", crop: "Organic Leafy Greens", baseVwc: 28.2 },
  { id: "plot-6", gate: "G6", crop: "Citrus Saplings Nursery", baseVwc: 25.0 }
];

console.log("=========================================================");
console.log(" AgriSpectra LoRaWAN / MQTT Gateway Telemetry Generator");
console.log(` Target Farm: ${FARM_ID} (1-Acre 6-Zone Precision Block)`);
console.log(` Broadcast Interval: Every ${INTERVAL_SECONDS} seconds`);
console.log("=========================================================\n");

let tickCount = 0;

function runTick() {
  tickCount++;
  const timestamp = new Date().toISOString();
  const mainlinePressureBar = (2.38 + (Math.random() * 0.1 - 0.05)).toFixed(2);

  console.log(`[TICK #${tickCount} - ${timestamp}] Mainline Hydraulic Pressure: ${mainlinePressureBar} Bar`);

  PLOTS.forEach(plot => {
    // Topsoil FDR (10cm), Middle (30cm), Deep (50cm)
    const drift = (Math.random() * 0.4 - 0.2);
    const topVwc = Math.max(8.0, Math.min(48.0, plot.baseVwc + drift)).toFixed(1);
    const midVwc = (Number(topVwc) + 2.8).toFixed(1);
    const deepVwc = (Number(topVwc) + 4.9).toFixed(1);
    const temp = (23.5 + (Math.random() * 0.8 - 0.4)).toFixed(1);
    const ec = (1.2 + (Math.random() * 0.1 - 0.05)).toFixed(2);

    const payload = {
      farmId: FARM_ID,
      plotId: plot.id,
      gateId: plot.gate,
      crop: plot.crop,
      readings: [
        { depth: "10cm", vwcPercent: Number(topVwc), tempCelsius: Number(temp), ecDsM: Number(ec) },
        { depth: "30cm", vwcPercent: Number(midVwc), tempCelsius: (Number(temp) - 1.2).toFixed(1) },
        { depth: "50cm", vwcPercent: Number(deepVwc), tempCelsius: (Number(temp) - 2.5).toFixed(1) }
      ],
      mainlinePressureBar: Number(mainlinePressureBar),
      timestamp
    };

    const statusBadge = Number(topVwc) < 18 ? "🔴 DEFICIT" : (Number(topVwc) > 32 ? "🟡 SATURATED" : "🟢 OPTIMAL");
    console.log(`  -> ${plot.gate} (${plot.crop.padEnd(25)}): 10cm VWC=${topVwc}% [${statusBadge}] | Temp=${temp}°C | EC=${ec} dS/m`);
  });

  console.log("---------------------------------------------------------");
}

runTick();
setInterval(runTick, INTERVAL_SECONDS * 1000);
