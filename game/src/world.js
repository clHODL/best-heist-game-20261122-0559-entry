// world.js — the heist itself: one level's live state.
//
// The thief, the patrol guards and their vision cones, the sweeping
// cameras, the loot, the locked vault, the vents and the alarm meter.
// All geometry is plain rectangles and circles; line of sight is a
// segment-vs-rectangle test, so a crate or a wall really does hide you.

import { LEVELS, TUNE } from './config.js';

export function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// True when the segment (x1,y1)-(x2,y2) touches rectangle r.
export function segmentHitsRect(x1, y1, x2, y2, r) {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  if (maxX < r.x || minX > r.x + r.w || maxY < r.y || minY > r.y + r.h) return false;
  if (x1 >= r.x && x1 <= r.x + r.w && y1 >= r.y && y1 <= r.y + r.h) return true;
  if (x2 >= r.x && x2 <= r.x + r.w && y2 >= r.y && y2 <= r.y + r.h) return true;
  const edges = [
    [r.x, r.y, r.x + r.w, r.y],
    [r.x + r.w, r.y, r.x + r.w, r.y + r.h],
    [r.x + r.w, r.y + r.h, r.x, r.y + r.h],
    [r.x, r.y + r.h, r.x, r.y],
  ];
  for (const [ax, ay, bx, by] of edges) {
    if (segmentsCross(x1, y1, x2, y2, ax, ay, bx, by)) return true;
  }
  return false;
}

function segmentsCross(x1, y1, x2, y2, x3, y3, x4, y4) {
  const d = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3);
  if (d === 0) return false;
  const t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / d;
  const u = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / d;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

// Push a circle (px,py,r) out of every solid rectangle; returns the fixed point.
export function resolveCircle(px, py, r, solids) {
  for (const s of solids) {
    const nx = clamp(px, s.x, s.x + s.w);
    const ny = clamp(py, s.y, s.y + s.h);
    const dx = px - nx;
    const dy = py - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      if (d2 === 0) {
        // Centre inside the rectangle: push out along the shallowest side.
        const l = px - s.x;
        const rr = s.x + s.w - px;
        const t = py - s.y;
        const b = s.y + s.h - py;
        const m = Math.min(l, rr, t, b);
        if (m === l) px = s.x - r;
        else if (m === rr) px = s.x + s.w + r;
        else if (m === t) py = s.y - r;
        else py = s.y + s.h + r;
      } else {
        const d = Math.sqrt(d2);
        px = nx + (dx / d) * r;
        py = ny + (dy / d) * r;
      }
    }
  }
  return { x: px, y: py };
}

export class World {
  constructor(levelIndex) {
    this.levelIndex = levelIndex;
    this.level = LEVELS[levelIndex];
    this.solids = [...this.level.walls, ...this.level.cover];
    this.reset();
  }

  reset() {
    const L = this.level;
    this.player = {
      x: L.start.x, y: L.start.y, r: TUNE.playerRadius,
      facing: 0, sneaking: false, moving: false,
    };
    this.guards = L.guards.map((g) => ({
      path: g.path,
      pause: g.pause,
      wp: 0,
      dir: 1, // patrols pace back and forth, never looping through a wall
      x: g.path[0][0],
      y: g.path[0][1],
      angle: 0,
      wait: 0,
      suspicion: 0,
      state: 'patrol', // patrol | suspicious | chase
      loseSight: 0,
      alertedAt: -1,
    }));
    this.cameras = L.cameras.map((c) => ({
      ...c, angle: c.baseAngle, t: 0, disabledUntil: -1,
    }));
    this.loot = L.loot.map((l) => ({ ...l, taken: false }));
    this.vaultOpen = false;
    this.diamondTaken = false;
    this.lockpick = 0;
    this.alarm = 0;
    this.lootValue = 0;
    this.lootCount = 0;
    this.elapsed = 0;
    this.smokes = []; // {x, y, until}
    this.empUntil = -1;
    this.ventCooldownUntil = -1;
    this.toast = '';
    this.toastUntil = -1;
    this.caughtBy = null; // 'guard' | 'alarm'
    this.now = 0;
  }

  get timeLeft() {
    return Math.max(0, this.level.parSeconds - this.elapsed);
  }

  get diamond() {
    // The diamond sits in the vault once it is picked open.
    return { x: this.level.vault.x + this.level.vault.w / 2, y: this.level.vault.y + this.level.vault.h / 2 };
  }

  say(text, seconds = 3) {
    this.toast = text;
    this.toastUntil = this.now + seconds;
  }

  // --- visibility -------------------------------------------------------

  inSmoke(x, y) {
    return this.smokes.some((s) => dist(x, y, s.x, s.y) < TUNE.smokeRadius);
  }

  blockedBySight(ax, ay, bx, by) {
    for (const s of this.solids) {
      if (segmentHitsRect(ax, ay, bx, by, s)) return true;
    }
    return false;
  }

  // Can observer at (ox,oy) facing `angle` with half-angle `half` and
  // range `range` see the point (tx,ty)? Smoke blocks sight both ways.
  canSee(ox, oy, angle, half, range, tx, ty) {
    const d = dist(ox, oy, tx, ty);
    if (d > range) return false;
    let da = Math.atan2(ty - oy, tx - ox) - angle;
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    if (Math.abs(da) > half) return false;
    if (this.inSmoke(tx, ty) || this.inSmoke(ox, oy)) return false;
    // A smoke cloud between the two also hides the thief.
    for (const s of this.smokes) {
      if (segmentHitsRect(ox, oy, tx, ty, { x: s.x - TUNE.smokeRadius * 0.7, y: s.y - TUNE.smokeRadius * 0.7, w: TUNE.smokeRadius * 1.4, h: TUNE.smokeRadius * 1.4 })) return false;
    }
    return !this.blockedBySight(ox, oy, tx, ty);
  }

  // --- player actions ---------------------------------------------------

  movePlayer(dx, dy, dt) {
    const p = this.player;
    p.moving = dx !== 0 || dy !== 0;
    if (!p.moving) return;
    const speed = p.sneaking ? TUNE.sneakSpeed : TUNE.walkSpeed;
    const nx = p.x + dx * speed * dt;
    const ny = p.y + dy * speed * dt;
    const fixed = resolveCircle(nx, ny, p.r, this.solids);
    p.x = clamp(fixed.x, p.r, 1280 - p.r);
    p.y = clamp(fixed.y, p.r, 720 - p.r);
    p.facing = Math.atan2(dy, dx);
  }

  moveToward(tx, ty, dt) {
    const p = this.player;
    const d = dist(p.x, p.y, tx, ty);
    if (d < 6) return true;
    const dx = (tx - p.x) / d;
    const dy = (ty - p.y) / d;
    this.movePlayer(dx, dy, dt);
    return false;
  }

  useSmoke(sounds) {
    const charges = this.toolCharges('smoke');
    if (charges <= 0) return false;
    this.charges.smoke -= 1;
    this.smokes.push({ x: this.player.x, y: this.player.y, until: this.now + TUNE.smokeSeconds });
    sounds.smoke();
    this.say('Smoke out — their cones cannot see through it.');
    return true;
  }

  useEmp(sounds) {
    if (this.toolCharges('emp') <= 0) return false;
    this.charges.emp -= 1;
    this.empUntil = this.now + TUNE.empSeconds;
    sounds.emp();
    this.say('EMP pulse — every camera is blind for 12 seconds.');
    return true;
  }

  toolCharges(kind) {
    if (!this.charges) this.charges = { smoke: 2, emp: 1 };
    return this.charges[kind];
  }

  // --- per-frame update -------------------------------------------------

  update(dt, input, sounds) {
    this.now += dt;
    this.elapsed += dt;
    if (!this.charges) this.charges = { smoke: 2, emp: 1 };
    const p = this.player;

    p.sneaking = input.down('Shift');
    const axis = input.axis();
    if (axis.x !== 0 || axis.y !== 0) {
      input.moveTarget = null;
      this.movePlayer(axis.x, axis.y, dt);
    } else if (input.moveTarget) {
      const arrived = this.moveToward(input.moveTarget.x, input.moveTarget.y, dt);
      if (arrived) input.moveTarget = null;
    }

    if (input.hit('q')) this.useSmoke(sounds);
    if (input.hit('f')) this.useEmp(sounds);

    this.updateLockpick(dt, input, sounds);
    this.updateVents();
    this.updateLoot(sounds);
    this.updateGuards(dt, sounds);
    this.updateCameras(dt);
    this.updateAlarm(dt);
    this.smokes = this.smokes.filter((s) => s.until > this.now);
    sounds.alarmPulse(this.alarm, dt);
  }

  updateLockpick(dt, input, sounds) {
    const v = this.level.vault;
    const cx = v.x + v.w / 2;
    const cy = v.y + v.h / 2;
    const near = dist(this.player.x, this.player.y, cx, cy) < 110;
    if (this.vaultOpen || !near || !input.down('e')) {
      this.lockpick = Math.max(0, this.lockpick - dt * 2);
      return;
    }
    this.lockpick += dt;
    // Picking is loud: nearby guards grow suspicious even without seeing you.
    for (const g of this.guards) {
      if (dist(g.x, g.y, cx, cy) < 280) g.suspicion = Math.min(100, g.suspicion + dt * 12);
    }
    if (this.lockpick >= TUNE.lockpickSeconds) {
      this.vaultOpen = true;
      this.lockpick = 0;
      sounds.diamond();
      this.say('Vault open — the Aurum Diamond is yours. Now reach the exit!');
    }
  }

  updateVents() {
    if (this.now < this.ventCooldownUntil) return;
    for (const v of this.level.vents) {
      if (dist(this.player.x, this.player.y, v.x + 23, v.y + 23) < 34) {
        this.player.x = v.toX;
        this.player.y = v.toY;
        this.ventCooldownUntil = this.now + 1.5;
        this.say('Through the vent — a second route, no cones crossed.');
        return;
      }
    }
  }

  updateLoot(sounds) {
    const p = this.player;
    for (const l of this.loot) {
      if (!l.taken && dist(p.x, p.y, l.x, l.y) < TUNE.pickupRadius) {
        l.taken = true;
        this.lootValue += l.value;
        this.lootCount += 1;
        sounds.pickup(l.value);
      }
    }
    if (this.vaultOpen && !this.diamondTaken) {
      const d = this.diamond;
      if (dist(p.x, p.y, d.x, d.y) < TUNE.pickupRadius + 6) {
        this.diamondTaken = true;
        this.lootValue += 5000;
        this.lootCount += 1;
        sounds.diamond();
        this.say('The Aurum Diamond — $5,000. Get to the exit!');
      }
    }
  }

  updateGuards(dt, sounds) {
    const p = this.player;
    for (const g of this.guards) {
      const sees = this.canSee(g.x, g.y, g.angle, TUNE.guardSightHalfAngle, TUNE.guardSightRange, p.x, p.y);
      g.seesPlayer = sees;
      if (sees) {
        const d = dist(g.x, g.y, p.x, p.y);
        let rate = TUNE.suspicionRate;
        if (d < 120) rate += TUNE.suspicionCloseBonus;
        if (p.sneaking) rate *= 0.5;
        if (!p.moving) rate *= 0.7;
        const before = g.suspicion;
        g.suspicion = Math.min(100, g.suspicion + rate * dt);
        g.loseSight = 0;
        if (before < 50 && g.suspicion >= 50 && g.state === 'patrol') {
          g.state = 'suspicious';
          sounds.alert();
          this.say('A guard spotted movement — break line of sight!');
        }
        if (g.suspicion >= 100 && g.state !== 'chase') {
          g.state = 'chase';
          sounds.alert();
        }
      } else {
        g.suspicion = Math.max(0, g.suspicion - TUNE.suspicionDecay * dt);
        if (g.state === 'chase') {
          g.loseSight += dt;
          if (g.loseSight > TUNE.chaseLoseSightSec) {
            g.state = 'patrol';
            g.loseSight = 0;
          }
        } else if (g.suspicion < 50) {
          g.state = 'patrol';
        }
      }

      if (g.state === 'chase') {
        // Run the thief down.
        const d = dist(g.x, g.y, p.x, p.y);
        if (d > 1) {
          const nx = g.x + ((p.x - g.x) / d) * TUNE.guardChaseSpeed * dt;
          const ny = g.y + ((p.y - g.y) / d) * TUNE.guardChaseSpeed * dt;
          const fixed = resolveCircle(nx, ny, 14, this.solids);
          g.x = fixed.x;
          g.y = fixed.y;
        }
        g.angle = Math.atan2(p.y - g.y, p.x - g.x);
        if (d < TUNE.catchDistance) {
          this.caughtBy = 'guard';
        }
      } else {
        // Walk the patrol lane, pausing at each waypoint.
        const target = g.path[g.wp];
        const d = dist(g.x, g.y, target[0], target[1]);
        if (g.wait > 0) {
          g.wait -= dt;
          if (g.wait <= 0) {
            g.wp += g.dir;
            if (g.wp >= g.path.length - 1) {
              g.wp = g.path.length - 1;
              g.dir = -1;
            } else if (g.wp <= 0) {
              g.wp = 0;
              g.dir = 1;
            }
          }
        } else if (d < 4) {
          g.wait = g.pause;
        } else {
          const nx = g.x + ((target[0] - g.x) / d) * TUNE.guardWalkSpeed * dt;
          const ny = g.y + ((target[1] - g.y) / d) * TUNE.guardWalkSpeed * dt;
          g.x = nx;
          g.y = ny;
          g.angle = Math.atan2(target[1] - g.y, target[0] - g.x);
        }
      }
    }
  }

  updateCameras(dt) {
    for (const c of this.cameras) {
      c.t += dt;
      // Sweep back and forth around the base angle.
      c.angle = c.baseAngle + Math.sin(c.t * c.speed) * c.sweep;
    }
  }

  updateAlarm(dt) {
    const p = this.player;
    let rise = 0;
    let chasing = false;
    for (const g of this.guards) {
      if (g.state === 'chase') {
        chasing = true;
        // Eyes on you: the alarm screams. Searching blind: it creeps —
        // breaking line of sight must be a real escape, not a delayed loss.
        rise += g.seesPlayer ? TUNE.alarmRiseChase : 10;
      } else if (g.suspicion >= 50) {
        rise += TUNE.alarmRiseGuard * (g.suspicion / 100);
      }
    }
    const empOff = this.now < this.empUntil;
    if (!empOff) {
      for (const c of this.cameras) {
        if (this.canSee(c.x, c.y, c.angle, TUNE.cameraSightHalfAngle, TUNE.cameraSightRange, p.x, p.y)) {
          rise += TUNE.alarmRiseCamera;
        }
      }
    }
    if (rise > 0) this.alarm = Math.min(100, this.alarm + rise * dt);
    else this.alarm = Math.max(0, this.alarm - TUNE.alarmDecay * dt);
    if (this.alarm >= 100 && !this.caughtBy) this.caughtBy = 'alarm';
    return chasing;
  }

  // --- scoring ----------------------------------------------------------

  get atExit() {
    const e = this.level.exit;
    const p = this.player;
    return p.x > e.x - 10 && p.x < e.x + e.w + 10 && p.y > e.y - 10 && p.y < e.y + e.h + 10;
  }

  get nearVault() {
    const v = this.level.vault;
    return dist(this.player.x, this.player.y, v.x + v.w / 2, v.y + v.h / 2) < 110;
  }

  score() {
    const timeBonus = Math.max(0, Math.round((this.level.parSeconds - this.elapsed) * 10));
    const alarmBonus = Math.round((100 - this.alarm) * 15);
    const lootBonus = this.lootValue;
    return { loot: lootBonus, time: timeBonus, stealth: alarmBonus, total: lootBonus + timeBonus + alarmBonus };
  }

  rank() {
    const s = this.score();
    const max = 5000 + this.loot.length * 0 + this.level.parSeconds * 10 + 1500;
    const ratio = s.total / Math.max(1, max);
    if (this.alarm < 25 && ratio > 0.75) return 'S';
    if (ratio > 0.6) return 'A';
    if (ratio > 0.4) return 'B';
    return 'C';
  }
}
