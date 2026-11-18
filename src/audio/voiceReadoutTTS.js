/**
 * Regional Multilingual Voice Audio TTS Engine
 * Uses Web Speech API synthesis for hands-free outdoor field readouts.
 */

export const SUPPORTED_LANGUAGES = [
  { code: 'en-US', label: 'English (US/Global)', flag: '' },
  { code: 'kn-IN', label: 'ಕನ್ನಡ (Kannada)', flag: '' },
  { code: 'hi-IN', label: 'हिन्दी (Hindi)', flag: '' },
  { code: 'es-ES', label: 'Español (Spanish)', flag: '' },
  { code: 'sw-KE', label: 'Kiswahili (Swahili)', flag: '' }
];

export class VoiceReadoutEngine {
  constructor() {
    this.currentLanguage = 'en-US';
    this.isSpeaking = false;
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
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

  setLanguage(langCode) {
    this.currentLanguage = langCode;
    this.emit('languageChange', langCode);
  }

  stop() {
    if (this.synth) {
      this.synth.cancel();
      this.isSpeaking = false;
      this.emit('speechEnd');
    }
  }

  /**
   * Speak diagnostic or action card text with regional localization
   */
  speakText(text, { lang = this.currentLanguage, rate = 0.95 } = {}) {
    if (!this.synth) {
      console.warn("Speech synthesis not supported in this browser.");
      return;
    }

    this.stop(); // Stop any active speech

    const UtteranceClass = (typeof SpeechSynthesisUtterance !== 'undefined')
      ? SpeechSynthesisUtterance
      : (typeof window !== 'undefined' && window.SpeechSynthesisUtterance)
        ? window.SpeechSynthesisUtterance
        : class MockUtterance {
            constructor(text) {
              this.text = text;
              this.lang = 'en-US';
              this.rate = 1.0;
              this.pitch = 1.0;
            }
          };

    const utterance = new UtteranceClass(text);
    utterance.lang = lang;
    utterance.rate = rate; // slightly slower for noisy outdoor clarity
    utterance.pitch = 1.0;

    // Try finding matching voice
    const voices = this.synth.getVoices();
    const matchingVoice = voices.find(v => v.lang === lang || v.lang.startsWith(lang.split('-')[0]));
    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

    utterance.onstart = () => {
      this.isSpeaking = true;
      this.emit('speechStart', { text, lang });
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      this.emit('speechEnd');
    };

    utterance.onerror = (e) => {
      console.error("TTS error:", e);
      this.isSpeaking = false;
      this.emit('speechEnd');
    };

    this.synth.speak(utterance);
  }

  /**
   * Synthesize diagnostic decision cards into localized audio scripts
   */
  speakDecision(type, data, lang = this.currentLanguage) {
    let script = "";

    if (lang.startsWith('kn')) {
      // Kannada translations
      if (type === 'VITALITY') {
        script = `ಬೆಳೆಯ ಚೈತನ್ಯ ಅಂಕ ನೂರರಲ್ಲಿ ${data.vitalityScore} ಆಗಿದೆ. ಪತ್ರ ಜಲ ಸೂಚ್ಯಂಕ ಸ್ಥಿರವಾಗಿದೆ.`;
      } else if (type === 'NITROGEN') {
        script = data.nitrogenPrescriptionKg > 0
          ? `ಮುಂದಿನ ನೀರಾವರಿಗೂ ಮುನ್ನ ಪ್ರತಿ ಎಕರೆಗೆ ${data.nitrogenPrescriptionKg} ಕೆಜಿ ಯೂರಿಯಾ ಅಗತ್ಯವಿದೆ.`
          : `ಸಾರಜನಕ ಮಟ್ಟ ಅತ್ಯುತ್ತಮವಾಗಿದೆ. ಹೆಚ್ಚುವರಿ ಗೊಬ್ಬರ ಅಗತ್ಯವಿಲ್ಲ.`;
      } else if (type === 'IRRIGATION') {
        script = `ನೀರಾವರಿ ಎಚ್ಚರಿಕೆ: ${data.irrigationCountdownHours} ಗಂಟೆಗಳ ಒಳಗೆ ನೀರು ಹಾಯಿಸಬೇಕು.`;
      } else if (type === 'DISEASE') {
        script = data.diseaseRisk?.detected
          ? `ರೋಗ ಎಚ್ಚರಿಕೆ: ಶೇಕಡಾ ${data.diseaseRisk.confidence} ನಿಖರತೆಯೊಂದಿಗೆ ರೋಗ ಲಕ್ಷಣ ಕಂಡುಬಂದಿದೆ.`
          : `ಎಲೆಗಳು ಸ್ವಚ್ಛ ಮತ್ತು ಆರೋಗ್ಯಕರವಾಗಿವೆ. ಯಾವುದೇ ರೋಗವಿಲ್ಲ.`;
      } else if (type === 'HARVEST') {
        script = `ಬೆಳೆ ಪರಿಪಕ್ವತೆ ಶೇಕಡಾ ${data.harvest?.maturityPercent} ಆಗಿದೆ. ಕೊಯ್ಲು ${data.harvest?.daysToPeakHarvest} ದಿನಗಳಲ್ಲಿ ಪ್ರಾರಂಭಿಸಬಹುದು.`;
      } else if (type === 'CLOSED_LOOP') {
        script = `ಸ್ಮಾರ್ಟ್ ಕ್ರಮ: ವಲಯ ${data.plotNumber} ಗಂಭೀರ ನೀರಿನ ಕೊರತೆಯಲ್ಲಿದೆ. ವಾಲ್ವ್ ${data.gateId} ತೆರೆಯಬೇಕೆ?`;
      }
    } else if (lang.startsWith('hi')) {
      // Hindi translations
      if (type === 'VITALITY') {
        script = `फसल स्वास्थ्य स्कोर सौ में से ${data.vitalityScore} है। पत्ती जल सूचकांक सामान्य है।`;
      } else if (type === 'NITROGEN') {
        script = data.nitrogenPrescriptionKg > 0 
          ? `चेतावनी: अगली सिंचाई से पहले प्रति एकड़ ${data.nitrogenPrescriptionKg} किलोग्राम यूरिया की आवश्यकता है।`
          : `नाइट्रोजन का स्तर उत्तम है। किसी अतिरिक्त खाद की आवश्यकता नहीं है।`;
      } else if (type === 'IRRIGATION') {
        script = `सिंचाई चेतावनी: पत्ती की नमी कम है। फसल को ${data.irrigationCountdownHours} घंटों के भीतर पानी चाहिए।`;
      } else if (type === 'DISEASE') {
        script = data.diseaseRisk?.detected
          ? `रोग चेतावनी: ${data.diseaseRisk.confidence} प्रतिशत निश्चितता के साथ पाउडरी मिल्ड्यू के लक्षण मिले हैं। तुरंत सुरक्षात्मक स्प्रे करें।`
          : `फसल में कोई रोग नहीं पाया गया है। पौधे पूरी तरह स्वस्थ हैं।`;
      } else if (type === 'HARVEST') {
        script = `फसल की परिपक्वता ${data.harvest?.maturityPercent} प्रतिशत है। कटाई ${data.harvest?.daysToPeakHarvest} दिनों में शुरू करें।`;
      } else if (type === 'CLOSED_LOOP') {
        script = `स्मार्ट एक्शन सूचना: प्लॉट ${data.plotNumber} में पानी का गंभीर तनाव है। गेट ${data.gateId} वाल्व को पच्चीस मिनट के लिए खोलें?`;
      }
    } else if (lang.startsWith('es')) {
      // Spanish translations
      if (type === 'VITALITY') {
        script = `Puntuación de vitalidad del cultivo: ${data.vitalityScore} de 100. El índice de agua foliar es estable.`;
      } else if (type === 'NITROGEN') {
        script = data.nitrogenPrescriptionKg > 0
          ? `Prescripción: Se requieren ${data.nitrogenPrescriptionKg} kilogramos de Urea por acre antes del próximo riego.`
          : `Nivel de nitrógeno óptimo. No se requiere fertilizante suplementario.`;
      } else if (type === 'IRRIGATION') {
        script = `Alerta de riego: Se requiere regar dentro de las próximas ${data.irrigationCountdownHours} horas.`;
      } else if (type === 'DISEASE') {
        script = data.diseaseRisk?.detected
          ? `Alerta de patógeno detectado con ${data.diseaseRisk.confidence}% de confianza. Aplique tratamiento preventivo.`
          : `Tejido foliar sano. Sin detección de patógenos.`;
      } else if (type === 'HARVEST') {
        script = `Madurez al ${data.harvest?.maturityPercent}%. Ventana de cosecha pico en ${data.harvest?.daysToPeakHarvest} días.`;
      } else if (type === 'CLOSED_LOOP') {
        script = `Acción inteligente: Estrés foliar confirmado en el Lote ${data.plotNumber}. ¿Abrir válvula de la compuerta ${data.gateId} durante 25 minutos?`;
      }
    } else if (lang.startsWith('sw')) {
      // Swahili translations
      if (type === 'VITALITY') {
        script = `Alama ya afya ya mmea ni ${data.vitalityScore} kwa mia moja. Majani yana afya nzuri.`;
      } else if (type === 'NITROGEN') {
        script = data.nitrogenPrescriptionKg > 0
          ? `Mbolea inahitajika: Kilo ${data.nitrogenPrescriptionKg} za Urea kwa ekari kabla ya umwagiliaji unaofuata.`
          : `Kiwango cha nitrojeni ni kizuri sana.`;
      } else if (type === 'IRRIGATION') {
        script = `Maji yanahitajika baada ya saa ${data.irrigationCountdownHours}.`;
      } else if (type === 'DISEASE') {
        script = data.diseaseRisk?.detected
          ? `Tahadhari ya ugonjwa: Ukungu umegunduliwa kwa asilimia ${data.diseaseRisk.confidence}.`
          : `Mimea haina ugonjwa wowote.`;
      } else if (type === 'HARVEST') {
        script = `Kiwango cha ukomavu ni asilimia ${data.harvest?.maturityPercent}. Mavuno yataanza baada ya siku ${data.harvest?.daysToPeakHarvest}.`;
      } else if (type === 'CLOSED_LOOP') {
        script = `Uamuzi wa umwagiliaji: Mmea kwenye eneo ${data.plotNumber} unahitaji maji. Je, tufungue vali kwa dakika ishirini na tano?`;
      }
    } else {
      // English (Default)
      if (type === 'VITALITY') {
        script = `Crop vitality score is ${data.vitalityScore} out of 100. Mesophyll reflectance signature indicates strong cellular vigor.`;
      } else if (type === 'NITROGEN') {
        script = data.nitrogenPrescriptionKg > 0
          ? `Fertilizer Prescription: ${data.nitrogenPrescriptionKg} kilograms per acre of Urea needed before the next irrigation cycle.`
          : `Nitrogen levels are optimal. No supplemental fertilizer required at this stage.`;
      } else if (type === 'IRRIGATION') {
        script = `Irrigation need: Turgor water band index indicates plot requires irrigation within ${data.irrigationCountdownHours} hours.`;
      } else if (type === 'DISEASE') {
        script = data.diseaseRisk?.detected
          ? `Pathogen Warning: ${data.diseaseRisk.pathogen} detected with ${data.diseaseRisk.confidence} percent confidence. ${data.diseaseRisk.preventativeAction}`
          : `Leaf tissue is clean and healthy. No pre-symptomatic fungal pathogens detected.`;
      } else if (type === 'HARVEST') {
        script = `Canopy maturity is at ${data.harvest?.maturityPercent} percent. The peak harvest window will open in ${data.harvest?.daysToPeakHarvest} days.`;
      } else if (type === 'CLOSED_LOOP') {
        script = `Smart Action: Plot ${data.plotNumber} leaf water stress confirmed by ${data.soilVwc}% soil moisture. Open Gate ${data.gateId} valve for 25 minutes?`;
      }
    }

    if (script) {
      this.speakText(script, { lang });
    }
  }
}

export const ttsEngine = new VoiceReadoutEngine();
