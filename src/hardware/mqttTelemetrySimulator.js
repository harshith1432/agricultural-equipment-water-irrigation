/**
 * Mock MQTT / LoRaWAN Soil Moisture & Hydraulic Telemetry Streamer
 * Simulates high-precision multi-depth FDR capacitive soil probes and ultrasonic flow meters.
 */

export class MqttTelemetrySimulator {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.updateIntervalMs = 4000;
    this.mainlinePressureBar = 2.40; // Normal range: 2.1 - 2.8 Bar
    this.consumedLitersToday = 1845.0;
    this.weatherMode = 'NORMAL'; // NORMAL | HEATWAVE | RAIN
    this.listeners = new Map();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => cb(data));
    }
  }

  start(plotsState, onPlotUpdate) {
    if (this.isRunning) return;
    this.isRunning = true;
    this.emit('statusChange', { running: true });

    this.intervalId = setInterval(() => {
      this.tick(plotsState, onPlotUpdate);
    }, this.updateIntervalMs);
  }

  stop() {
    if (!this.isRunning) return;
    clearInterval(this.intervalId);
    this.isRunning = false;
    this.emit('statusChange', { running: false });
  }

  setWeatherMode(mode) {
    this.weatherMode = mode; // 'NORMAL' | 'HEATWAVE' | 'RAIN'
    this.emit('weatherModeChange', mode);
  }

  tick(plots, onPlotUpdate) {
    if (!plots || !Array.isArray(plots)) return;

    let totalActiveFlowLph = 0;

    const updatedPlots = plots.map(plot => {
      const isValveOpen = plot.valve?.state === 'OPEN';
      const flowRate = isValveOpen ? (plot.valve.flowRate || 420.0) : 0;
      if (isValveOpen) {
        totalActiveFlowLph += flowRate;
      }

      // Evaporation / Irrigation dynamics per probe
      const updatedSensors = (plot.soilSensors || []).map(sensor => {
        let vwc = Number(sensor.vwc);
        let temp = Number(sensor.temperature);

        if (isValveOpen) {
          // Valve is open: moisture rises steadily (+0.4% to +0.8% per tick)
          vwc = Math.min(48.0, vwc + 0.55 + (Math.random() * 0.2));
          // Water cooling effect on soil
          temp = Math.max(18.0, temp - 0.05);
        } else {
          // Evapotranspiration
          let dropRate = 0.08;
          if (this.weatherMode === 'HEATWAVE') dropRate = 0.25;
          if (this.weatherMode === 'RAIN') dropRate = -1.2; // rain soaks soil

          vwc = Math.max(8.0, Math.min(50.0, vwc - dropRate + (Math.random() * 0.04 - 0.02)));
          if (this.weatherMode === 'HEATWAVE') {
            temp = Math.min(36.0, temp + 0.1);
          }
        }

        return {
          ...sensor,
          vwc: Number(vwc.toFixed(1)),
          temperature: Number(temp.toFixed(1)),
          lastUpdated: new Date()
        };
      });

      // Update plot water accumulator if valve is open
      let totalLiters = plot.totalLitersDelivered || 0;
      if (isValveOpen) {
        const litersDeliveredTick = (flowRate / 3600) * (this.updateIntervalMs / 1000);
        totalLiters += litersDeliveredTick;
        this.consumedLitersToday += litersDeliveredTick;
      }

      const updatedPlot = {
        ...plot,
        soilSensors: updatedSensors,
        totalLitersDelivered: Number(totalLiters.toFixed(1))
      };

      if (onPlotUpdate) {
        onPlotUpdate(updatedPlot);
      }

      return updatedPlot;
    });

    // Hydraulic mainline pressure dynamics
    // More open valves slight pressure drop; pump cycles between 2.2 and 2.6
    let basePressure = 2.45;
    if (totalActiveFlowLph > 800) {
      basePressure = 2.15;
    } else if (totalActiveFlowLph === 0) {
      basePressure = 2.52;
    }
    this.mainlinePressureBar = Number((basePressure + (Math.random() * 0.08 - 0.04)).toFixed(2));

    this.emit('telemetryTick', {
      plots: updatedPlots,
      mainlinePressureBar: this.mainlinePressureBar,
      activeFlowLph: totalActiveFlowLph,
      consumedLitersToday: Number(this.consumedLitersToday.toFixed(1)),
      weatherMode: this.weatherMode,
      timestamp: new Date()
    });
  }
}

export const mqttSimulator = new MqttTelemetrySimulator();
