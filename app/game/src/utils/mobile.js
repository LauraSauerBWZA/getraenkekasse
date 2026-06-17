// Touch-Steuerung (B_GAME.9). Spec §6 nennt „Swipe links/rechts" oben + „Tap"
// unten zum Springen. Für ein Platformer-Gefühl ist Halten-zum-Steuern
// spielbarer als echtes Wischen, daher:
//
//   • Unteres Drittel des Screens antippen  → Springen
//   • Oberes zwei Drittel berühren/halten   → in Richtung der Berührungsseite
//     laufen (links der Mitte = links, rechts = rechts), solange gehalten
//
// Multitouch-fähig: ein Finger steuert, ein zweiter springt unabhängig. Auf
// Geräten ohne Touch bleibt die Steuerung inert (Maus löst nichts aus), damit
// Desktop-Klicks das Spiel nicht beeinflussen.
export class TouchControls {
  constructor(scene) {
    this.scene = scene;
    this.left = false;
    this.right = false;
    this.jumpQueued = false;
    this.steerPointerId = null;

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

  jumpZoneY() {
    return this.scene.scale.height * (2 / 3);
  }

  onDown(pointer) {
    if (pointer.y >= this.jumpZoneY()) {
      this.jumpQueued = true;
    } else {
      this.steerPointerId = pointer.id;
      this.applySteer(pointer);
    }
  }

  onMove(pointer) {
    if (!pointer.isDown) return;
    if (pointer.id === this.steerPointerId && pointer.y < this.jumpZoneY()) {
      this.applySteer(pointer);
    }
  }

  applySteer(pointer) {
    const cx = this.scene.scale.width / 2;
    this.left = pointer.x < cx;
    this.right = pointer.x >= cx;
  }

  onUp(pointer) {
    // Nur der steuernde Finger stoppt die Bewegung — der Sprung-Finger nicht.
    if (pointer.id === this.steerPointerId) {
      this.left = false;
      this.right = false;
      this.steerPointerId = null;
    }
  }

  // Sprung-Intent einmalig abholen (Reset).
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
