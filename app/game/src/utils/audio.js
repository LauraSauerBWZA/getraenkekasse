// Prozedurales Audio (Phase B_GAME6_AUSBAU, Teil A). Alles per Web Audio API im
// Code synthetisiert — keine Dateien, keine Library, keine neue Dependency.
//
// AUTOPLAY/iframe: Wir bauen NICHT einen zweiten AudioContext, sondern nutzen den
// Context, den Phaser ohnehin hält (`scene.sound.context`, WebAudioSoundManager).
// Phaser erledigt das Autoplay-Unlock selbst auf die erste User-Geste im iframe
// (Tap/Klick/Taste) und ruft `context.resume()`. Wir hängen unsere Gains nur an
// diesen Context → Web-Audio bleibt nach der ersten Geste hörbar (Mobile/iframe).
//
// Struktur: master → { musicGain, sfxGain }. Mute = master auf 0 (betrifft beide).
// Lautstärken bewusst moderat (kurze Töne, nicht nervig bei Wiederholung).

const MUTE_KEY = 'bgame.audioMuted'; // localStorage: Mute hält dauerhaft (Q1)
const MASTER_VOL = 0.5;
const MUSIC_VOL = 0.32;
const SFX_VOL = 0.55;

function loadMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}
function saveMuted(muted) {
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    /* localStorage evtl. blockiert (Privatmodus) — Mute hält dann nur zur Laufzeit */
  }
}

class GameAudio {
  constructor(context) {
    this.ctx = context || null;
    this.muted = loadMuted();
    this.enabled = !!this.ctx;
    if (!this.enabled) return;

    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : MASTER_VOL;
    this.master.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = MUSIC_VOL;
    this.musicGain.connect(this.master);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = SFX_VOL;
    this.sfxGain.connect(this.master);
  }

  // Context kann zum Zeitpunkt der ersten Scene noch 'suspended' sein. Defensiv
  // resume() aufrufen, bevor wir etwas abspielen (Phaser tut das auch, aber so
  // sind wir unabhängig vom genauen Unlock-Zeitpunkt).
  ensureRunning() {
    if (this.enabled && this.ctx.state === 'suspended') this.ctx.resume();
  }

  isMuted() {
    return this.muted;
  }

  setMuted(muted) {
    this.muted = muted;
    saveMuted(muted);
    if (!this.enabled) return;
    const t = this.ctx.currentTime;
    // kurze Rampe statt harter Sprung (kein Knacken).
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(muted ? 0 : MASTER_VOL, t + 0.05);
  }

  toggleMuted() {
    this.setMuted(!this.muted);
    if (!this.muted) this.ensureRunning();
    return this.muted;
  }
}

// Modul-Singleton: an den AudioContext gebunden, lebt über Szenenwechsel hinweg
// (Musik/Mute bleiben konsistent zwischen Menu/Level1/Win/GameOver).
let engine = null;

export function getGameAudio(scene) {
  const sm = scene && scene.sound;
  const ctx = sm && !sm.noAudio ? sm.context : null;
  if (!engine || engine.ctx !== ctx) engine = new GameAudio(ctx);
  return engine;
}

// Kleiner Mute-Schalter (Pflicht, A.3): Text-Button, der den Mute-Zustand
// umschaltet und persistiert. Wird im Menü und im Spiel-HUD platziert.
export function createMuteButton(scene, x, y, { origin = 0, depth = 100 } = {}) {
  const audio = getGameAudio(scene);
  const label = () => (audio.isMuted() ? '🔇' : '🔊');
  const btn = scene.add
    .text(x, y, label(), {
      fontFamily: "'Inter', system-ui, sans-serif",
      fontSize: '18px',
      color: '#f2cb82',
      backgroundColor: '#241a12',
      padding: { x: 7, y: 4 },
    })
    .setOrigin(origin, 0)
    .setScrollFactor(0)
    .setDepth(depth)
    .setInteractive({ useHandCursor: true });
  btn.on('pointerup', () => {
    audio.toggleMuted();
    btn.setText(label());
  });
  return btn;
}
