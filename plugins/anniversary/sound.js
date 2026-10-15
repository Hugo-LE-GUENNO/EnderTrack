// plugins/anniversary/sound.js
// Écoute plugin:sound via SSE et joue via Web Audio API — zéro dépendance

(function () {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  const ctx = new AudioContext();

  // Notes en Hz
  const NOTE = {
    C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23,
    G4: 392.00, A4: 440.00, B4: 493.88,
    C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46,
    G5: 783.99, A5: 880.00,
  };

  // Happy Birthday to You
  const HAPPY_BIRTHDAY = [
    [NOTE.C4, 0.3], [NOTE.C4, 0.15], [NOTE.D4, 0.45], [NOTE.C4, 0.45],
    [NOTE.F4, 0.45], [NOTE.E4, 0.9],
    [NOTE.C4, 0.3], [NOTE.C4, 0.15], [NOTE.D4, 0.45], [NOTE.C4, 0.45],
    [NOTE.G4, 0.45], [NOTE.F4, 0.9],
    [NOTE.C4, 0.3], [NOTE.C4, 0.15], [NOTE.C5, 0.45], [NOTE.A4, 0.45],
    [NOTE.F4, 0.45], [NOTE.E4, 0.45], [NOTE.D4, 0.9],
    [NOTE.A4, 0.3], [NOTE.A4, 0.15], [NOTE.A4, 0.45], [NOTE.G4, 0.45],  // "Happy birthday dear..."
    [NOTE.F4, 0.45], [NOTE.F4, 0.45], [NOTE.E4, 0.45], [NOTE.D4, 0.45],
    [NOTE.C5, 0.45], [NOTE.C5, 0.45], [NOTE.B4, 0.45], [NOTE.A4, 0.45],
    [NOTE.G4, 0.9],
  ];

  const FANFARE = [
    [NOTE.C4, 0.15], [NOTE.C4, 0.15], [NOTE.C4, 0.15],
    [NOTE.C4, 0.45], [NOTE.E4, 0.45], [NOTE.G4, 0.45], [NOTE.C5, 0.9],
    [NOTE.G4, 0.3], [NOTE.C5, 1.2],
  ];

  function playNote(freq, duration, startTime, volume = 0.3) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration * 0.95);
    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  function playMelody(notes, volume = 0.3) {
    if (ctx.state === 'suspended') ctx.resume();
    let t = ctx.currentTime + 0.05;
    for (const [freq, dur] of notes) {
      playNote(freq, dur, t, volume);
      t += dur * 1.05;
    }
  }

  const MELODIES = {
    happy_birthday: () => playMelody(HAPPY_BIRTHDAY, 0.35),
    fanfare:        () => playMelody(FANFARE, 0.4),
  };

  // Écoute SSE directement
  const base = window.ENDERTRACK_SERVER || 'http://localhost:5000';
  const es = new EventSource(base + '/api/events');
  es.onmessage = (e) => {
    try {
      const evt = JSON.parse(e.data);
      if (evt.type === 'plugin:sound') {
        const fn = MELODIES[evt.data?.melody];
        if (fn) fn();
      }
    } catch {}
  };

  window._EnderSound = { play: (melody) => MELODIES[melody]?.() };
  console.log('[sound.js] ready');
})();
