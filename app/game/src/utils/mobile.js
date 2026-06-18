// Touch-Steuerung (B_GAME_TOUCH): dynamischer analoger Joystick + Tap-Sprung +
// separater Einklippen-Button. Ersetzt die frühere „Bildhälfte halten = bewegen"-
// Logik, die auf dem Smartphone unangenehm war.
//
//   • JOYSTICK (Bewegung): erscheint dynamisch dort, wo der Daumen den unteren
//     Bildbereich zuerst berührt (runde Basis + Knopf, halbtransparent), folgt
//     dem Finger und verschwindet beim Loslassen. Beliebiger Winkel (volle 2D),
//     Magnitude = Tempo (bis MOVE.speed), kleine Deadzone im Zentrum.
//   • SPRUNG: kurzer Tap irgendwo (runter+hoch ohne nennenswertes Ziehen).
//   • EINKLIPPEN: eigener On-Screen-Button (unten links), löst KEINEN Sprung aus.
//
// Auf Geräten ohne Touch inert. Desktop nutzt weiterhin Tastatur (Player.js).

// Schwellwerte (dokumentiert):
const TAP_MS = 220; // max. Dauer eines „Tap" (darüber kein Sprung)
const TAP_MOVE = 18; // px Ziehdistanz: darüber gilt es als Wisch → KEIN Sprung
const JOY_RADIUS = 64; // px: Vollausschlag (= MOVE.speed); Knopf wird hierauf geclampt
const JOY_DEADZONE = TAP_MOVE; // px: darunter keine Bewegung (deckt sich mit der Tap-Schwelle,
// damit jede Joystick-Bewegung zugleich „gewischt" = kein Sprung bedeutet)
const JOY_KNOB = 26; // px Knopf-Radius (Optik)
const MOVE_ZONE_TOP = 0.3; // nur Berührungen in den unteren 70% starten einen Joystick

export class TouchControls {
  constructor(scene) {
    this.scene = scene;
    this.moveX = 0; // analoger Bewegungsvektor (|v| ≤ 1), Magnitude = Tempo-Anteil
    this.moveY = 0;
    this.moveActive = false; // true, sobald der Joystick über die Deadzone gezogen ist
    this.jumpQueued = false;
    this.clipQueued = false;
    this.clipBounds = null;
    this.held = new Map(); // pointerId → { t, x, y, moved }
    this.joyId = null; // Pointer, der gerade den Joystick führt

    this.active = scene.sys.game.device.input.touch;
    if (!this.active) return;

    scene.input.addPointer(2); // bis zu 3 Finger (Joystick + Tap-Sprung + Klippen)
    this.createClipButton();
    this.joyGfx = scene.add.graphics().setScrollFactor(0).setDepth(105);

    this.onDown = this.onDown.bind(this);
    this.onMove = this.onMove.bind(this);
    this.onUp = this.onUp.bind(this);
    scene.input.on('pointerdown', this.onDown);
    scene.input.on('pointermove', this.onMove);
    scene.input.on('pointerup', this.onUp);
    scene.events.once('shutdown', () => this.destroy());
    scene.events.once('destroy', () => this.destroy());
  }

  // Eigener Einklippen-Button unten links (B_GAME4.2). Pointer, die hier starten,
  // lösen weder Joystick noch Sprung aus (Sonderfall in onDown).
  createClipButton() {
    const w = 92;
    const h = 56;
    const x = 14;
    const y = this.scene.scale.height - h - 20;
    this.clipBounds = { x, y, w, h };
    const bg = this.scene.add
      .rectangle(x + w / 2, y + h / 2, w, h, 0x241a12, 0.82)
      .setStrokeStyle(2, 0xe3a857, 0.9)
      .setScrollFactor(0)
      .setDepth(102);
    const label = this.scene.add
      .text(x + w / 2, y + h / 2, 'Klippen', {
        fontFamily: "'Inter', system-ui, sans-serif",
        fontSize: '15px',
        color: '#f2cb82',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(103);
    this.clipBtnObjs = [bg, label];
  }

  inClipBtn(pointer) {
    const b = this.clipBounds;
    return (
      b && pointer.x >= b.x && pointer.x <= b.x + b.w && pointer.y >= b.y && pointer.y <= b.y + b.h
    );
  }

  consumeClip() {
    const c = this.clipQueued;
    this.clipQueued = false;
    return c;
  }

  consumeJump() {
    const j = this.jumpQueued;
    this.jumpQueued = false;
    return j;
  }

  onDown(pointer) {
    // Auf dem Klipp-Button: nur Einklippen, NICHT als Bewegung/Sprung werten.
    if (this.inClipBtn(pointer)) {
      this.clipQueued = true;
      return;
    }
    this.held.set(pointer.id, { t: this.scene.time.now, x: pointer.x, y: pointer.y, moved: false });
    // Joystick dynamisch erzeugen: nur ein Joystick gleichzeitig, nur im unteren
    // Bildbereich. Bewegung beginnt erst nach Überschreiten der Deadzone (onMove).
    if (this.joyId === null && pointer.y >= this.scene.scale.height * MOVE_ZONE_TOP) {
      this.joyId = pointer.id;
      this.joyBaseX = pointer.x;
      this.joyBaseY = pointer.y;
      this.drawJoystick(pointer.x, pointer.y);
    }
  }

  onMove(pointer) {
    const h = this.held.get(pointer.id);
    if (!h) return;
    if (Math.hypot(pointer.x - h.x, pointer.y - h.y) > TAP_MOVE) h.moved = true; // → kein Sprung
    if (pointer.id !== this.joyId) return;

    const vx = pointer.x - this.joyBaseX;
    const vy = pointer.y - this.joyBaseY;
    const mag = Math.hypot(vx, vy);
    const clamped = Math.min(mag, JOY_RADIUS);
    const kx = this.joyBaseX + (mag ? (vx / mag) * clamped : 0);
    const ky = this.joyBaseY + (mag ? (vy / mag) * clamped : 0);
    this.drawJoystick(this.joyBaseX, this.joyBaseY, kx, ky);

    if (mag <= JOY_DEADZONE) {
      this.moveActive = false;
      this.moveX = 0;
      this.moveY = 0;
      return;
    }
    // Richtung = Zugrichtung (beliebiger Winkel); Magnitude (über die Deadzone
    // hinaus, normiert auf [0,1]) = Tempo-Anteil.
    this.moveActive = true;
    const frac = Math.min((clamped - JOY_DEADZONE) / (JOY_RADIUS - JOY_DEADZONE), 1);
    this.moveX = (vx / mag) * frac;
    this.moveY = (vy / mag) * frac;
  }

  onUp(pointer) {
    const h = this.held.get(pointer.id);
    if (h) {
      const dt = this.scene.time.now - h.t;
      if (dt < TAP_MS && !h.moved) this.jumpQueued = true; // kurzer Tipp ohne Ziehen = Sprung
      this.held.delete(pointer.id);
    }
    if (pointer.id === this.joyId) {
      this.joyId = null;
      this.moveActive = false;
      this.moveX = 0;
      this.moveY = 0;
      this.joyGfx.clear();
    }
  }

  // Halbtransparente Basis + Knopf (amber). Koordinaten in Game-Space (scrollFactor 0
  // → deckt sich mit pointer.x/y).
  drawJoystick(bx, by, kx = bx, ky = by) {
    const g = this.joyGfx;
    g.clear();
    g.fillStyle(0xf4f0e9, 0.1);
    g.fillCircle(bx, by, JOY_RADIUS);
    g.lineStyle(2, 0xf4f0e9, 0.22);
    g.strokeCircle(bx, by, JOY_RADIUS);
    g.fillStyle(0xe3a857, 0.55);
    g.fillCircle(kx, ky, JOY_KNOB);
    g.lineStyle(2, 0xf2cb82, 0.7);
    g.strokeCircle(kx, ky, JOY_KNOB);
  }

  destroy() {
    if (!this.active) return;
    this.scene.input.off('pointerdown', this.onDown);
    this.scene.input.off('pointermove', this.onMove);
    this.scene.input.off('pointerup', this.onUp);
  }
}
