// Touch-Steuerung für die Auto-Climb-Mechanik (Phase B_GAME2_KLETTERN, Spec §6).
//
//   • Bildschirmhälfte gedrückt HALTEN → in diese Richtung lenken (links/rechts),
//     solange gehalten
//   • Kurzes TIPPEN (Tap) irgendwo → Sprung
//
// Der Auto-Climb macht „hoch" überflüssig — Lenken + Springen genügen. Tap vs.
// Halten wird über Dauer + Bewegung unterschieden. Multitouch-fähig; auf Geräten
// ohne Touch inert (Maus löst nichts aus).
const TAP_MS = 220; // kürzer = Tap (Sprung)
const TAP_MOVE = 18; // Bewegung darüber zählt nicht mehr als Tap

export class TouchControls {
  constructor(scene) {
    this.scene = scene;
    this.left = false;
    this.right = false;
    this.jumpQueued = false;
    this.held = new Map(); // pointerId → { side, t, x, moved }

    this.active = scene.sys.game.device.input.touch;
    if (!this.active) return;

    scene.input.addPointer(2); // bis zu 3 gleichzeitige Pointer

    this.onDown = this.onDown.bind(this);
    this.onMove = this.onMove.bind(this);
    this.onUp = this.onUp.bind(this);
    scene.input.on('pointerdown', this.onDown);
    scene.input.on('pointermove', this.onMove);
    scene.input.on('pointerup', this.onUp);
    scene.events.once('shutdown', () => this.destroy());
    scene.events.once('destroy', () => this.destroy());
  }

  sideOf(pointer) {
    return pointer.x < this.scene.scale.width / 2 ? 'left' : 'right';
  }

  onDown(pointer) {
    this.held.set(pointer.id, {
      side: this.sideOf(pointer),
      t: this.scene.time.now,
      x: pointer.x,
      moved: false,
    });
    this.recompute();
  }

  onMove(pointer) {
    const h = this.held.get(pointer.id);
    if (!h) return;
    if (Math.abs(pointer.x - h.x) > TAP_MOVE) h.moved = true;
    h.side = this.sideOf(pointer);
    this.recompute();
  }

  onUp(pointer) {
    const h = this.held.get(pointer.id);
    if (h) {
      const dt = this.scene.time.now - h.t;
      // Kurz + kaum bewegt = Tap → Sprung.
      if (dt < TAP_MS && !h.moved) this.jumpQueued = true;
      this.held.delete(pointer.id);
    }
    this.recompute();
  }

  // Lenk-Richtung aus allen aktuell gehaltenen Pointern ableiten.
  recompute() {
    this.left = false;
    this.right = false;
    for (const h of this.held.values()) {
      if (h.side === 'left') this.left = true;
      else this.right = true;
    }
  }

  consumeJump() {
    const j = this.jumpQueued;
    this.jumpQueued = false;
    return j;
  }

  destroy() {
    if (!this.active) return;
    this.scene.input.off('pointerdown', this.onDown);
    this.scene.input.off('pointermove', this.onMove);
    this.scene.input.off('pointerup', this.onUp);
  }
}
