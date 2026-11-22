// input.js — keyboard and mouse, kept in one place so the game loop
// never touches DOM events directly.
//
// Keys: WASD / arrows move, SHIFT sneak, E lockpick (hold), Q smoke bomb,
// F EMP pulse, P or ESC pause, M mute, R restart, ENTER confirm.
// Mouse: click to move (the thief walks to the clicked point), click HUD
// tool chips to use them, click menu buttons to choose.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set(); // keys hit since the last frame was read
    this.moveTarget = null; // {x, y} in canvas pixels, or null
    this.click = null; // {x, y} of the latest click, consumed by the UI
    this.canvas = canvas;

    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
      if (!e.repeat) this.pressed.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
      this.keys.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    });
    canvas.addEventListener('mousedown', (e) => {
      const p = this.toCanvas(e);
      this.click = p;
      this.moveTarget = p;
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.moveTarget = null;
    });
  }

  toCanvas(e) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * this.canvas.width,
      y: ((e.clientY - r.top) / r.height) * this.canvas.height,
    };
  }

  down(...names) {
    return names.some((n) => this.keys.has(n));
  }

  // True once for the frame in which the key was pressed.
  hit(...names) {
    return names.some((n) => this.pressed.has(n));
  }

  axis() {
    let x = 0;
    let y = 0;
    if (this.down('a', 'ArrowLeft')) x -= 1;
    if (this.down('d', 'ArrowRight')) x += 1;
    if (this.down('w', 'ArrowUp')) y -= 1;
    if (this.down('s', 'ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.hypot(x, y);
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }

  endFrame() {
    this.pressed.clear();
    this.click = null;
  }
}
