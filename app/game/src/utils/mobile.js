// Touch-Steuerung für die Forced-Scroll-Mechanik (NACHSCHLAG2, Spec-Vorgabe:
// Swipe/Halten = bewegen, Tap = Sprung).
//
//   • Finger HALTEN → Spieler bewegt sich in Richtung der Berührung relativ zur
//     Bildschirmmitte (frei in 2D: hoch/runter/seitlich), mit Deadzone in der
//     Mitte
//   • Kurzes TIPPEN (Tap) → Sprung
//
// Auf Geräten ohne Touch inert (Maus löst nichts aus).
const TAP_MS = 220;
const TAP_MOVE = 18;
const DEADZONE = 30; // px um die Mitte → keine Bewegung

export class TouchControls {
  constructor(scene) {
    this.scene = scene;
    this.moveX = 0;
    this.moveY = 0;
    this.jumpQueued = false;
    this.held = new Map(); // pointerId → { t, x, y, moved }
    this.activeId = null; // der Pointer, der gerade bewegt

    this.active = scene.sys.game.device.input.touch;
    if (!this.active) return;

    scene.input.addPointer(2);

    this.onDown = this.onDown.bind(this);
    this.onMove = this.onMove.bind(this);
    this.onUp = this.onUp.bind(this);
    scene.input.on('pointerdown', this.onDown);
    scene.input.on('pointermove', this.onMove);
    scene.input.on('pointerup', this.onUp);
    scene.events.once('shutdown', () => this.destroy());
    scene.events.once('destroy', () => this.destroy());
  }

  computeMove(pointer) {
    if (pointer.id !== this.activeId) return;
    const dx = pointer.x - this.scene.scale.width / 2;
    const dy = pointer.y - this.scene.scale.height / 2;
    this.moveX = Math.abs(dx) < DEADZONE ? 0 : Math.sign(dx);
    this.moveY = Math.abs(dy) < DEADZONE ? 0 : Math.sign(dy);
  }

  onDown(pointer) {
    this.held.set(pointer.id, { t: this.scene.time.now, x: pointer.x, y: pointer.y, moved: false });
    if (this.activeId === null) this.activeId = pointer.id;
    this.computeMove(pointer);
  }

  onMove(pointer) {
    const h = this.held.get(pointer.id);
    if (!h) return;
    if (Math.abs(pointer.x - h.x) > TAP_MOVE || Math.abs(pointer.y - h.y) > TAP_MOVE) h.moved = true;
    this.computeMove(pointer);
  }

  onUp(pointer) {
    const h = this.held.get(pointer.id);
    if (h) {
      const dt = this.scene.time.now - h.t;
      if (dt < TAP_MS && !h.moved) this.jumpQueued = true;
      this.held.delete(pointer.id);
    }
    if (pointer.id === this.activeId) {
      this.activeId = null;
      this.moveX = 0;
      this.moveY = 0;
      // Falls noch ein Finger liegt: der übernimmt die Bewegung.
      for (const id of this.held.keys()) {
        this.activeId = id;
        break;
      }
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
