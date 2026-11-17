// Neon Vice: Syndicate - Procedural Web Audio API Sound System
// Pure procedural synthesis: zero external audio files, zero network requests.
// Supports engine revs, tire screeches, sirens, weapon blasts, explosions, and 3 synthwave radio stations.

export function createAudioSystem() {
  let ctx = null;
  let masterGain = null;
  let sfxGain = null;
  let musicGain = null;
  let engineOsc1 = null;
  let engineOsc2 = null;
  let engineFilter = null;
  let engineGain = null;
  let tireNoiseNode = null;
  let tireFilter = null;
  let tireGain = null;
  let sirenOsc = null;
  let sirenLfo = null;
  let sirenGain = null;
  let isMuted = false;

  // Radio Sequencer State
  let currentStationIndex = 0;
  let radioInterval = null;
  let radioStep = 0;
  let isRadioPlaying = false;

  function initContext() {
    if (ctx) return true;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return false;
      ctx = new AudioCtx();

      masterGain = ctx.createGain();
      masterGain.gain.value = 0.8;
      masterGain.connect(ctx.destination);

      sfxGain = ctx.createGain();
      sfxGain.gain.value = 0.85;
      sfxGain.connect(masterGain);

      musicGain = ctx.createGain();
      musicGain.gain.value = 0.45;
      musicGain.connect(masterGain);

      setupEngineNodes();
      setupTireNodes();
      setupSirenNodes();
      return true;
    } catch {
      return false;
    }
  }

  function ensureResume() {
    if (!ctx) initContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  }

  // Engine sound synthesis (dual-oscillator FM-modulated synth)
  function setupEngineNodes() {
    if (!ctx) return;
    try {
      engineOsc1 = ctx.createOscillator();
      engineOsc2 = ctx.createOscillator();
      engineFilter = ctx.createBiquadFilter();
      engineGain = ctx.createGain();

      engineOsc1.type = 'sawtooth';
      engineOsc2.type = 'triangle';
      engineOsc1.frequency.value = 45;
      engineOsc2.frequency.value = 90;

      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 260;
      engineFilter.Q.value = 2.5;

      engineGain.gain.value = 0.0001; // Off by default

      engineOsc1.connect(engineFilter);
      engineOsc2.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(sfxGain);

      engineOsc1.start();
      engineOsc2.start();
    } catch {}
  }

  // Tire screech (resonant bandpass noise generator)
  function setupTireNodes() {
    if (!ctx) return;
    try {
      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      tireNoiseNode = ctx.createBufferSource();
      tireNoiseNode.buffer = noiseBuffer;
      tireNoiseNode.loop = true;

      tireFilter = ctx.createBiquadFilter();
      tireFilter.type = 'bandpass';
      tireFilter.frequency.value = 1100;
      tireFilter.Q.value = 3.5;

      tireGain = ctx.createGain();
      tireGain.gain.value = 0.0001;

      tireNoiseNode.connect(tireFilter);
      tireFilter.connect(tireGain);
      tireGain.connect(sfxGain);

      tireNoiseNode.start();
    } catch {}
  }

  // Police siren (pitch-swept dual LFO siren)
  function setupSirenNodes() {
    if (!ctx) return;
    try {
      sirenOsc = ctx.createOscillator();
      sirenLfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      sirenGain = ctx.createGain();

      sirenOsc.type = 'sawtooth';
      sirenOsc.frequency.value = 750;

      sirenLfo.type = 'triangle';
      sirenLfo.frequency.value = 0.7; // Siren cycle rate (wail)
      lfoGain.gain.value = 280; // Pitch sweep depth

      sirenLfo.connect(lfoGain);
      lfoGain.connect(sirenOsc.frequency);

      sirenGain.gain.value = 0.0001;

      sirenOsc.connect(sirenGain);
      sirenGain.connect(sfxGain);

      sirenOsc.start();
      sirenLfo.start();
    } catch {}
  }

  // Update dynamic vehicle engine audio in real time
  function updateVehicleAudio(inVehicle, speedRatio, isBraking, isDrifting) {
    if (!ctx || isMuted) return;
    const now = ctx.currentTime;

    if (inVehicle && engineGain) {
      const targetGain = Math.min(0.24, 0.06 + speedRatio * 0.18);
      engineGain.gain.setTargetAtTime(targetGain, now, 0.05);

      const baseFreq = 42 + speedRatio * 180 + (isBraking ? -15 : 0);
      engineOsc1.frequency.setTargetAtTime(Math.max(35, baseFreq), now, 0.06);
      engineOsc2.frequency.setTargetAtTime(Math.max(70, baseFreq * 2), now, 0.06);
      engineFilter.frequency.setTargetAtTime(240 + speedRatio * 900, now, 0.05);
    } else if (engineGain) {
      engineGain.gain.setTargetAtTime(0.0001, now, 0.1);
    }

    if (tireGain) {
      if (inVehicle && isDrifting && speedRatio > 0.15) {
        tireGain.gain.setTargetAtTime(0.18, now, 0.03);
      } else {
        tireGain.gain.setTargetAtTime(0.0001, now, 0.08);
      }
    }
  }

  // Update police siren state based on wanted stars & active police pursuit
  function updatePoliceSiren(wantedStars, nearbyPoliceCount) {
    if (!ctx || !sirenGain || isMuted) return;
    const now = ctx.currentTime;
    if (wantedStars > 0 && nearbyPoliceCount > 0) {
      const volume = Math.min(0.22, 0.08 + wantedStars * 0.03);
      sirenGain.gain.setTargetAtTime(volume, now, 0.1);
      // Speed up siren on higher stars
      sirenLfo.frequency.setTargetAtTime(wantedStars >= 3 ? 1.4 : 0.75, now, 0.2);
    } else {
      sirenGain.gain.setTargetAtTime(0.0001, now, 0.2);
    }
  }

  // One-shot sound effects
  function playSound(type, volume = 1.0) {
    if (isMuted) return;
    ensureResume();
    if (!ctx) return;
    const t = ctx.currentTime;

    try {
      if (type === 'punch') {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(140, t);
        osc.frequency.exponentialRampToValueAtTime(35, t + 0.14);
        g.gain.setValueAtTime(0.4 * volume, t);
        g.gain.linearRampToValueAtTime(0.001, t + 0.15);
        osc.connect(g);
        g.connect(sfxGain);
        osc.start(t);
        osc.stop(t + 0.16);
      } else if (type === 'pistol') {
        // Sharp pop + transient drop
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(620, t);
        osc.frequency.exponentialRampToValueAtTime(60, t + 0.12);
        g.gain.setValueAtTime(0.55 * volume, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
        osc.connect(g);
        g.connect(sfxGain);
        osc.start(t);
        osc.stop(t + 0.15);
      } else if (type === 'smg') {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(780, t);
        osc.frequency.exponentialRampToValueAtTime(90, t + 0.08);
        g.gain.setValueAtTime(0.38 * volume, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
        osc.connect(g);
        g.connect(sfxGain);
        osc.start(t);
        osc.stop(t + 0.1);
      } else if (type === 'shotgun') {
        // Heavy multi-stage blast
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, t);
        osc.frequency.exponentialRampToValueAtTime(30, t + 0.32);
        g.gain.setValueAtTime(0.75 * volume, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.connect(g);
        g.connect(sfxGain);
        osc.start(t);
        osc.stop(t + 0.36);
      } else if (type === 'rifle') {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(840, t);
        osc.frequency.exponentialRampToValueAtTime(75, t + 0.16);
        g.gain.setValueAtTime(0.58 * volume, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        osc.connect(g);
        g.connect(sfxGain);
        osc.start(t);
        osc.stop(t + 0.19);
      } else if (type === 'rocket' || type === 'explosion') {
        // Massive low bass punch + swept filtered noise
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(160, t);
        osc.frequency.exponentialRampToValueAtTime(25, t + 0.6);
        g.gain.setValueAtTime(0.9 * volume, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
        osc.connect(g);
        g.connect(sfxGain);
        osc.start(t);
        osc.stop(t + 0.7);
      } else if (type === 'car_crash') {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.22);
        g.gain.setValueAtTime(0.5 * volume, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        osc.connect(g);
        g.connect(sfxGain);
        osc.start(t);
        osc.stop(t + 0.26);
      } else if (type === 'car_horn') {
        const o1 = ctx.createOscillator();
        const o2 = ctx.createOscillator();
        const g = ctx.createGain();
        o1.type = 'sawtooth';
        o2.type = 'sawtooth';
        o1.frequency.value = 440; // A4
        o2.frequency.value = 554.37; // C#5 (harmonious minor/major horn)
        g.gain.setValueAtTime(0.28 * volume, t);
        g.gain.linearRampToValueAtTime(0.001, t + 0.35);
        o1.connect(g);
        o2.connect(g);
        g.connect(sfxGain);
        o1.start(t);
        o2.start(t);
        o1.stop(t + 0.36);
        o2.stop(t + 0.36);
      } else if (type === 'cash') {
        // High sparkling twin chime
        const o1 = ctx.createOscillator();
        const o2 = ctx.createOscillator();
        const g = ctx.createGain();
        o1.type = 'sine';
        o2.type = 'sine';
        o1.frequency.setValueAtTime(987.77, t); // B5
        o2.frequency.setValueAtTime(1318.51, t + 0.08); // E6
        g.gain.setValueAtTime(0.3 * volume, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        o1.connect(g);
        o2.connect(g);
        g.connect(sfxGain);
        o1.start(t);
        o1.stop(t + 0.18);
        o2.start(t + 0.08);
        o2.stop(t + 0.32);
      } else if (type === 'mission_pass') {
        // Synthwave victory fanfare
        const notes = [440, 554.37, 659.25, 880];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.value = freq;
          const noteTime = t + idx * 0.12;
          g.gain.setValueAtTime(0.35 * volume, noteTime);
          g.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.35);
          osc.connect(g);
          g.connect(sfxGain);
          osc.start(noteTime);
          osc.stop(noteTime + 0.38);
        });
      } else if (type === 'star_up') {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(330, t);
        osc.frequency.exponentialRampToValueAtTime(880, t + 0.28);
        g.gain.setValueAtTime(0.4 * volume, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.connect(g);
        g.connect(sfxGain);
        osc.start(t);
        osc.stop(t + 0.32);
      }
    } catch {}
  }

  // Procedural Synthwave Radio Music Tracker
  // 3 distinct musical styles synthesized in real-time
  const radioStationsData = [
    {
      // Station 0: Vice Wave 80s (Dreamy retro synthwave, Fm -> Db -> Eb -> Cm)
      bpm: 112,
      scale: [174.61, 207.65, 233.08, 261.63, 311.13, 349.23, 415.30, 466.16], // F minor pentatonic/diatonic
      bassPattern: [1, 0, 1, 0, 1, 1, 0, 1, 2, 0, 2, 0, 3, 0, 0, 1],
      arpPattern: [0, 2, 4, 7, 5, 4, 2, 0, 3, 5, 7, 9, 7, 5, 3, 2],
    },
    {
      // Station 1: Nightcore FM (Driving electro 128 BPM, upbeat neon synth)
      bpm: 128,
      scale: [220.0, 246.94, 261.63, 293.66, 329.63, 349.23, 392.0, 440.0], // A minor
      bassPattern: [1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 4, 4],
      arpPattern: [0, 4, 7, 11, 7, 4, 0, 4, 2, 5, 9, 12, 9, 5, 2, 5],
    },
    {
      // Station 2: Syndicate Darkwave (Heavy dark synth, 98 BPM)
      bpm: 98,
      scale: [130.81, 146.83, 155.56, 174.61, 196.0, 207.65, 233.08, 261.63], // C minor
      bassPattern: [1, 0, 0, 1, 0, 0, 1, 0, 2, 0, 0, 2, 0, 1, 0, 0],
      arpPattern: [0, 1, 3, 4, 3, 1, 0, 1, 2, 3, 5, 6, 5, 3, 2, 1],
    },
  ];

  function playRadioBeat() {
    if (!ctx || isMuted || !isRadioPlaying) return;
    const st = radioStationsData[currentStationIndex];
    if (!st) return;

    const t = ctx.currentTime;
    const step = radioStep % 16;
    radioStep++;

    try {
      // 808 Kick on beats 0, 4, 8, 12
      if (step % 4 === 0) {
        const kOsc = ctx.createOscillator();
        const kGain = ctx.createGain();
        kOsc.type = 'sine';
        kOsc.frequency.setValueAtTime(140, t);
        kOsc.frequency.exponentialRampToValueAtTime(32, t + 0.14);
        kGain.gain.setValueAtTime(0.5, t);
        kGain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
        kOsc.connect(kGain);
        kGain.connect(musicGain);
        kOsc.start(t);
        kOsc.stop(t + 0.18);
      }

      // Snare on beats 4, 12
      if (step % 8 === 4) {
        const sOsc = ctx.createOscillator();
        const sGain = ctx.createGain();
        sOsc.type = 'triangle';
        sOsc.frequency.setValueAtTime(190, t);
        sOsc.frequency.exponentialRampToValueAtTime(50, t + 0.11);
        sGain.gain.setValueAtTime(0.35, t);
        sGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        sOsc.connect(sGain);
        sGain.connect(musicGain);
        sOsc.start(t);
        sOsc.stop(t + 0.14);
      }

      // Synthwave Bass
      const bassNote = st.bassPattern[step];
      if (bassNote > 0) {
        const bFreq = (st.scale[bassNote % st.scale.length] || 110) * 0.5;
        const bOsc = ctx.createOscillator();
        const bFilter = ctx.createBiquadFilter();
        const bGain = ctx.createGain();
        bOsc.type = 'sawtooth';
        bOsc.frequency.value = bFreq;
        bFilter.type = 'lowpass';
        bFilter.frequency.setValueAtTime(450, t);
        bFilter.frequency.exponentialRampToValueAtTime(120, t + 0.15);
        bGain.gain.setValueAtTime(0.28, t);
        bGain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
        bOsc.connect(bFilter);
        bFilter.connect(bGain);
        bGain.connect(musicGain);
        bOsc.start(t);
        bOsc.stop(t + 0.18);
      }

      // Synth Arpeggio
      const arpNote = st.arpPattern[step];
      if (arpNote !== undefined) {
        const aFreq = st.scale[arpNote % st.scale.length] || 220;
        const aOsc = ctx.createOscillator();
        const aGain = ctx.createGain();
        aOsc.type = 'square';
        aOsc.frequency.value = aFreq;
        aGain.gain.setValueAtTime(0.12, t);
        aGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        aOsc.connect(aGain);
        aGain.connect(musicGain);
        aOsc.start(t);
        aOsc.stop(t + 0.14);
      }
    } catch {}
  }

  function startRadio(stationIdx = 0) {
    ensureResume();
    if (radioInterval) clearInterval(radioInterval);
    currentStationIndex = stationIdx;
    isRadioPlaying = true;
    radioStep = 0;

    const bpm = radioStationsData[currentStationIndex]?.bpm || 112;
    const intervalMs = (60 / bpm / 4) * 1000; // 16th notes
    radioInterval = setInterval(playRadioBeat, intervalMs);
  }

  function stopRadio() {
    isRadioPlaying = false;
    if (radioInterval) {
      clearInterval(radioInterval);
      radioInterval = null;
    }
  }

  function nextRadioStation() {
    if (currentStationIndex < radioStationsData.length - 1) {
      startRadio(currentStationIndex + 1);
      return currentStationIndex;
    } else {
      stopRadio();
      currentStationIndex = -1; // Off
      return -1;
    }
  }

  function setMuted(muted) {
    isMuted = muted;
    if (masterGain && ctx) {
      masterGain.gain.setTargetAtTime(isMuted ? 0.0001 : 0.8, ctx.currentTime, 0.05);
    }
  }

  return {
    ensureResume,
    updateVehicleAudio,
    updatePoliceSiren,
    playSound,
    startRadio,
    stopRadio,
    nextRadioStation,
    setMuted,
    isMuted: () => isMuted,
    currentStation: () => currentStationIndex,
  };
}
