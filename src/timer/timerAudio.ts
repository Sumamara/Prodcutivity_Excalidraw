/**
 * Tono de fin del temporizador con Web Audio.
 *
 * - El navegador exige un gesto del usuario para reproducir audio: `unlockAudio()`
 *   se llama SINCRÓNICAMENTE dentro del clic de ▶ (ese clic es el gesto).
 * - El tono se PROGRAMA con la agenda de Web Audio (`start(tiempo)`), que corre en
 *   el hilo de audio y no depende de los `setTimeout`, que el navegador limita en
 *   pestañas ocultas. Al pausar / terminar se cancela.
 * - Un solo tono suave (dos notas sinusoidales, volumen bajo), sin repetición.
 */

type AudioCtor = typeof AudioContext;

let ctx: AudioContext | null = null;
let nodes: OscillatorNode[] = [];
/** Invalida programaciones pendientes de un `resume()` anterior. */
let token = 0;

function getCtor(): AudioCtor | null {
  const w = window as unknown as {
    AudioContext?: AudioCtor;
    webkitAudioContext?: AudioCtor;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** Crea/reanuda el AudioContext. Llamar dentro de un gesto del usuario. */
export function unlockAudio(): void {
  try {
    const Ctor = getCtor();
    if (!Ctor) return;
    if (!ctx) ctx = new Ctor();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    /* noop */
  }
}

const NOTES = [523.25, 659.25]; // Do5 → Mi5
const NOTE_LEN = 0.32;
const GAIN = 0.07;

function play(at: number): void {
  if (!ctx) return;
  const c = ctx;
  NOTES.forEach((freq, i) => {
    const t0 = at + i * (NOTE_LEN * 0.8);
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(GAIN, t0 + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + NOTE_LEN);
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + NOTE_LEN + 0.05);
    nodes.push(osc);
  });
}

/**
 * Programa el tono para el instante `atEpochMs` (epoch ms). Sustituye cualquier
 * tono programado antes. Si el audio aún no está desbloqueado no hace nada (el
 * estado visual de tiempo extra sigue avisando).
 */
export function scheduleChime(atEpochMs: number): void {
  cancelChime();
  const mine = token;
  const arm = () => {
    if (mine !== token || !ctx || ctx.state !== "running") return;
    const delay = Math.max(0, (atEpochMs - Date.now()) / 1000);
    play(ctx.currentTime + delay);
  };
  if (!ctx) return;
  if (ctx.state === "running") arm();
  else void ctx.resume().then(arm, () => undefined);
}

export function cancelChime(): void {
  token++;
  for (const o of nodes) {
    try {
      o.stop();
      o.disconnect();
    } catch {
      /* ya parado */
    }
  }
  nodes = [];
}

/** ¿Está el audio listo para reproducir? */
export function isAudioRunning(): boolean {
  return !!ctx && ctx.state === "running";
}
