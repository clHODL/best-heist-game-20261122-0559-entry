// render.js — everything the player (and the judge) sees.
//
// One canvas, drawn fresh every frame: the marble floor, gold-trimmed
// walls, display cases and crates, the thief, the guards with their
// vision cones, the sweeping cameras, the loot, the vault, the smoke —
// and the HUD with the alarm meter, the loot tally and the tools.
// Menu and end screens are drawn here too, so a screenshot always shows
// the game itself, never a bare page.

import { TUNE, TOOLS } from './config.js';
import { dist } from './world.js';

const GOLD = '#d4a94e';
const GOLD_BRIGHT = '#f2c96b';
const INK = '#0b1020';
const FLOOR_A = '#1b2138';
const FLOOR_B = '#171c30';
const WALL = '#2c3352';
const WALL_TOP = '#454f7d';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function conePath(ctx, x, y, angle, half, range) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, range, angle - half, angle + half);
  ctx.closePath();
}

function text(ctx, s, x, y, size, color, align = 'left', weight = '600') {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px "Trebuchet MS", Verdana, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}

export class Renderer {
  constructor(canvas) {
    this.ctx = canvas.getContext('2d');
    this.floorCache = new Map(); // levelIndex -> offscreen canvas
  }

  floorFor(levelIndex, level) {
    if (this.floorCache.has(levelIndex)) return this.floorCache.get(levelIndex);
    const c = document.createElement('canvas');
    c.width = 1280;
    c.height = 720;
    const g = c.getContext('2d');
    // Marble checker.
    for (let y = 0; y < 720; y += 60) {
      for (let x = 0; x < 1280; x += 60) {
        g.fillStyle = ((x + y) / 60) % 2 === 0 ? FLOOR_A : FLOOR_B;
        g.fillRect(x, y, 60, 60);
      }
    }
    // Warm light pools under the grand exhibits.
    for (const cov of level.cover) {
      if (cov.kind !== 'case') continue;
      const grad = g.createRadialGradient(
        cov.x + cov.w / 2, cov.y + cov.h / 2, 10,
        cov.x + cov.w / 2, cov.y + cov.h / 2, 150,
      );
      grad.addColorStop(0, 'rgba(212,169,78,0.16)');
      grad.addColorStop(1, 'rgba(212,169,78,0)');
      g.fillStyle = grad;
      g.fillRect(cov.x - 120, cov.y - 120, cov.w + 240, cov.h + 240);
    }
    // Subtle speckle.
    g.fillStyle = 'rgba(255,255,255,0.03)';
    for (let i = 0; i < 400; i++) {
      g.fillRect((i * 97) % 1280, (i * 173) % 720, 2, 2);
    }
    this.floorCache.set(levelIndex, c);
    return c;
  }

  draw(world, state, now) {
    const ctx = this.ctx;
    const L = world.level;
    ctx.clearRect(0, 0, 1280, 720);
    ctx.drawImage(this.floorFor(world.levelIndex, L), 0, 0);

    this.drawExit(ctx, world, now);
    this.drawVault(ctx, world, now);
    for (const v of L.vents) this.drawVent(ctx, v, now);
    for (const cov of L.cover) this.drawCover(ctx, cov);
    for (const w of L.walls) this.drawWall(ctx, w);
    for (const l of world.loot) if (!l.taken) this.drawLoot(ctx, l, now);
    if (world.vaultOpen && !world.diamondTaken) this.drawDiamond(ctx, world.diamond, now);
    for (const c of world.cameras) this.drawCamera(ctx, world, c);
    for (const g of world.guards) this.drawGuard(ctx, world, g, now);
    for (const s of world.smokes) this.drawSmoke(ctx, s, now);
    this.drawPlayer(ctx, world, now);
    this.drawHud(ctx, world, state);
    if (state === 'playing' && world.toast && world.now < world.toastUntil) {
      this.drawToast(ctx, world.toast);
    }
  }

  drawWall(ctx, w) {
    ctx.fillStyle = WALL;
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = WALL_TOP;
    if (w.h <= 24) ctx.fillRect(w.x, w.y, w.w, 4);
    else ctx.fillRect(w.x, w.y, 4, w.h);
    ctx.strokeStyle = 'rgba(212,169,78,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(w.x + 0.5, w.y + 0.5, w.w - 1, w.h - 1);
  }

  drawCover(ctx, cov) {
    if (cov.kind === 'crate') {
      ctx.fillStyle = '#6b4a2b';
      roundRect(ctx, cov.x, cov.y, cov.w, cov.h, 4);
      ctx.fill();
      ctx.strokeStyle = '#8a6238';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cov.x, cov.y);
      ctx.lineTo(cov.x + cov.w, cov.y + cov.h);
      ctx.moveTo(cov.x + cov.w, cov.y);
      ctx.lineTo(cov.x, cov.y + cov.h);
      ctx.stroke();
    } else if (cov.kind === 'case') {
      ctx.fillStyle = 'rgba(120,180,220,0.16)';
      roundRect(ctx, cov.x, cov.y, cov.w, cov.h, 6);
      ctx.fill();
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = GOLD_BRIGHT;
      ctx.beginPath();
      ctx.arc(cov.x + cov.w / 2, cov.y + cov.h / 2, 9, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // plant: a brass pot with green leaves — cheap cover, honest shade.
      ctx.fillStyle = '#8a6a35';
      ctx.beginPath();
      ctx.arc(cov.x + cov.w / 2, cov.y + cov.h / 2 + 8, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2f7d4f';
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * 0.45;
        ctx.beginPath();
        ctx.ellipse(
          cov.x + cov.w / 2 + Math.cos(a) * 14, cov.y + cov.h / 2 + Math.sin(a) * 16,
          8, 16, a, 0, Math.PI * 2,
        );
        ctx.fill();
      }
    }
  }

  drawVent(ctx, v, now) {
    const pulse = 0.5 + 0.5 * Math.sin(now / 500);
    ctx.fillStyle = '#141a2e';
    roundRect(ctx, v.x, v.y, v.w, v.h, 6);
    ctx.fill();
    ctx.strokeStyle = `rgba(180,200,230,${0.5 + pulse * 0.3})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(180,200,230,0.7)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(v.x + 6, v.y + i * 11);
      ctx.lineTo(v.x + v.w - 6, v.y + i * 11);
      ctx.stroke();
    }
    text(ctx, 'VENT', v.x + v.w / 2, v.y + v.h + 12, 10, '#9fb2d8', 'center');
  }

  drawVault(ctx, world, now) {
    const v = world.level.vault;
    ctx.fillStyle = world.vaultOpen ? '#3a2f14' : '#232a44';
    roundRect(ctx, v.x, v.y, v.w, v.h, 8);
    ctx.fill();
    ctx.strokeStyle = world.vaultOpen ? GOLD_BRIGHT : GOLD;
    ctx.lineWidth = 3;
    ctx.stroke();
    if (!world.vaultOpen) {
      // The vault door: concentric steel rings and a dial.
      ctx.strokeStyle = '#5a6488';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(v.x + v.w / 2, v.y + v.h / 2, 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(v.x + v.w / 2, v.y + v.h / 2, 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = GOLD_BRIGHT;
      ctx.beginPath();
      ctx.arc(v.x + v.w / 2, v.y + v.h / 2, 5, 0, Math.PI * 2);
      ctx.fill();
      text(ctx, 'VAULT', v.x + v.w / 2, v.y - 14, 12, GOLD, 'center', '700');
      if (world.nearVault) {
        const pct = world.lockpick / TUNE.lockpickSeconds;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        roundRect(ctx, v.x - 10, v.y + v.h + 8, v.w + 20, 14, 7);
        ctx.fill();
        ctx.fillStyle = GOLD_BRIGHT;
        roundRect(ctx, v.x - 8, v.y + v.h + 10, (v.w + 16) * Math.max(0.04, pct), 10, 5);
        ctx.fill();
        text(ctx, 'HOLD E — PICKING THE LOCK', v.x + v.w / 2, v.y + v.h + 34, 11, '#ffe9b0', 'center');
      }
    } else {
      text(ctx, 'VAULT OPEN', v.x + v.w / 2, v.y - 14, 12, GOLD_BRIGHT, 'center', '700');
    }
  }

  drawExit(ctx, world, now) {
    const e = world.level.exit;
    const glow = 0.5 + 0.5 * Math.sin(now / 400);
    ctx.fillStyle = `rgba(46,160,90,${0.25 + glow * 0.15})`;
    roundRect(ctx, e.x, e.y, e.w, e.h, 6);
    ctx.fill();
    ctx.strokeStyle = '#35c463';
    ctx.lineWidth = 2;
    ctx.stroke();
    text(ctx, 'EXIT', e.x + e.w / 2, e.y + e.h / 2, 13, '#7dff9e', 'center', '800');
    text(ctx, e.label, e.x + e.w / 2, e.y - 12, 10, '#7dff9e', 'center');
  }

  drawLoot(ctx, l, now) {
    const bob = Math.sin(now / 350 + l.x) * 2;
    if (l.kind === 'coin') {
      ctx.fillStyle = GOLD_BRIGHT;
      ctx.beginPath();
      ctx.arc(l.x, l.y + bob, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#8a6a25';
      ctx.lineWidth = 2;
      ctx.stroke();
      text(ctx, '$', l.x, l.y + bob + 0.5, 11, '#8a6a25', 'center', '800');
    } else if (l.kind === 'bar') {
      ctx.fillStyle = GOLD;
      ctx.save();
      ctx.translate(l.x, l.y + bob);
      ctx.rotate(-0.2);
      ctx.fillRect(-14, -6, 28, 12);
      ctx.restore();
      ctx.strokeStyle = '#8a6a25';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(l.x - 14, l.y + bob - 6, 28, 12);
    } else {
      // painting on a little stand
      ctx.fillStyle = '#3d2b1a';
      ctx.fillRect(l.x - 16, l.y - 12 + bob, 32, 24);
      ctx.fillStyle = '#7a4a8f';
      ctx.fillRect(l.x - 13, l.y - 9 + bob, 26, 18);
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 2;
      ctx.strokeRect(l.x - 16, l.y - 12 + bob, 32, 24);
      ctx.fillStyle = GOLD_BRIGHT;
      ctx.beginPath();
      ctx.arc(l.x, l.y + bob, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawDiamond(ctx, d, now) {
    const pulse = 1 + 0.12 * Math.sin(now / 250);
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = 'rgba(160,230,255,0.25)';
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#aee6ff';
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.lineTo(13, -4);
    ctx.lineTo(0, 16);
    ctx.lineTo(-13, -4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.lineTo(7, -4);
    ctx.lineTo(0, 2);
    ctx.lineTo(-7, -4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    text(ctx, 'AURUM DIAMOND  $5,000', d.x, d.y - 30, 12, '#cfeeff', 'center', '700');
  }

  drawCamera(ctx, world, c) {
    const disabled = world.now < world.empUntil;
    const p = world.player;
    const sees = !disabled && world.canSee(c.x, c.y, c.angle, TUNE.cameraSightHalfAngle, TUNE.cameraSightRange, p.x, p.y);
    const col = disabled ? 'rgba(120,130,150,0.10)' : sees ? 'rgba(255,60,60,0.30)' : 'rgba(255,90,90,0.16)';
    ctx.fillStyle = col;
    conePath(ctx, c.x, c.y, c.angle, TUNE.cameraSightHalfAngle, TUNE.cameraSightRange);
    ctx.fill();
    ctx.fillStyle = disabled ? '#5a6478' : sees ? '#ff3c3c' : '#c23b3b';
    ctx.beginPath();
    ctx.arc(c.x, c.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0b1020';
    ctx.lineWidth = 2;
    ctx.stroke();
    // lens direction tick
    ctx.strokeStyle = '#0b1020';
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(c.x + Math.cos(c.angle) * 13, c.y + Math.sin(c.angle) * 13);
    ctx.stroke();
    if (disabled) text(ctx, 'OFF', c.x, c.y - 18, 10, '#8a94a8', 'center', '700');
    else if (sees) text(ctx, '!', c.x, c.y - 18, 14, '#ff5a5a', 'center', '800');
  }

  drawGuard(ctx, world, g, now) {
    const p = world.player;
    const sees = world.canSee(g.x, g.y, g.angle, TUNE.guardSightHalfAngle, TUNE.guardSightRange, p.x, p.y);
    const alert = g.state === 'chase' || g.suspicion >= 50;
    const col = g.state === 'chase'
      ? 'rgba(255,50,50,0.34)'
      : alert
        ? 'rgba(255,120,40,0.28)'
        : 'rgba(255,190,80,0.20)';
    ctx.fillStyle = col;
    conePath(ctx, g.x, g.y, g.angle, TUNE.guardSightHalfAngle, TUNE.guardSightRange);
    ctx.fill();
    // cone edge lines, so the boundary reads at a glance
    ctx.strokeStyle = g.state === 'chase' ? 'rgba(255,80,80,0.6)' : 'rgba(255,190,80,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(g.x, g.y);
    ctx.lineTo(g.x + Math.cos(g.angle - TUNE.guardSightHalfAngle) * TUNE.guardSightRange, g.y + Math.sin(g.angle - TUNE.guardSightHalfAngle) * TUNE.guardSightRange);
    ctx.moveTo(g.x, g.y);
    ctx.lineTo(g.x + Math.cos(g.angle + TUNE.guardSightHalfAngle) * TUNE.guardSightRange, g.y + Math.sin(g.angle + TUNE.guardSightHalfAngle) * TUNE.guardSightRange);
    ctx.stroke();

    // body: navy uniform, brass badge, facing tick
    ctx.fillStyle = '#1d2f5e';
    ctx.beginPath();
    ctx.arc(g.x, g.y, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = alert ? '#ff5a5a' : GOLD;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = GOLD_BRIGHT;
    ctx.beginPath();
    ctx.arc(g.x + Math.cos(g.angle) * 8, g.y + Math.sin(g.angle) * 8, 3, 0, Math.PI * 2);
    ctx.fill();
    // suspicion arc above the head
    if (g.suspicion > 5) {
      ctx.strokeStyle = g.suspicion >= 50 ? '#ff5a5a' : '#ffbe50';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(g.x, g.y, 21, -Math.PI / 2, -Math.PI / 2 + (g.suspicion / 100) * Math.PI * 2);
      ctx.stroke();
    }
    if (g.state === 'chase') text(ctx, '!', g.x, g.y - 30, 18, '#ff5a5a', 'center', '800');
    else if (g.suspicion >= 50) text(ctx, '?', g.x, g.y - 30, 16, '#ffbe50', 'center', '800');
    text(ctx, 'GUARD', g.x, g.y + 28, 9, '#9fb2d8', 'center');
  }

  drawSmoke(ctx, s, now) {
    const alpha = Math.min(1, (s.until - now / 1000) / 1.5) * 0.85;
    ctx.fillStyle = `rgba(190,200,215,${Math.max(0.15, alpha)})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, TUNE.smokeRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(220,230,240,0.5)';
    ctx.beginPath();
    ctx.arc(s.x - 30, s.y - 15, 34, 0, Math.PI * 2);
    ctx.arc(s.x + 28, s.y + 18, 30, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, 'SMOKE', s.x, s.y, 11, '#3a4358', 'center', '700');
  }

  drawPlayer(ctx, world, now) {
    const p = world.player;
    // soft shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 10, 14, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // body: dark teal coat, gold trim
    ctx.fillStyle = '#0f766e';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = GOLD_BRIGHT;
    ctx.lineWidth = 2;
    ctx.stroke();
    // mask band + facing tick
    ctx.strokeStyle = '#0b1020';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(p.x - 9, p.y - 3);
    ctx.lineTo(p.x + 9, p.y - 3);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(p.facing) * 9, p.y + Math.sin(p.facing) * 9, 2.5, 0, Math.PI * 2);
    ctx.fill();
    // click-to-move target ring
    if (world.moveTargetShown) {
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(world.moveTargetShown.x, world.moveTargetShown.y, 8 + 2 * Math.sin(now / 200), 0, Math.PI * 2);
      ctx.stroke();
    }
    text(ctx, 'ROOK', p.x, p.y + 28, 9, '#7de8dc', 'center');
    if (p.sneaking) text(ctx, 'sneaking…', p.x, p.y - 24, 10, '#9fb2d8', 'center');
  }

  drawHud(ctx, world, state) {
    // top bar
    ctx.fillStyle = 'rgba(5,8,18,0.82)';
    ctx.fillRect(0, 0, 1280, 56);
    ctx.fillStyle = GOLD;
    ctx.fillRect(0, 56, 1280, 2);
    text(ctx, 'MIDNIGHT HEIST', 18, 20, 17, GOLD_BRIGHT, 'left', '800');
    text(ctx, world.level.name, 18, 42, 12, '#9fb2d8');
    // alarm meter
    const ax = 330;
    const aw = 340;
    text(ctx, 'ALARM', ax, 20, 12, world.alarm > 70 ? '#ff5a5a' : '#e8ecf5', 'left', '700');
    ctx.fillStyle = '#232a44';
    roundRect(ctx, ax, 30, aw, 14, 7);
    ctx.fill();
    const frac = world.alarm / 100;
    const grad = ctx.createLinearGradient(ax, 0, ax + aw, 0);
    grad.addColorStop(0, '#35c463');
    grad.addColorStop(0.55, '#ffb020');
    grad.addColorStop(1, '#ff3c3c');
    ctx.fillStyle = grad;
    if (frac > 0.01) {
      roundRect(ctx, ax, 30, Math.max(10, aw * frac), 14, 7);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(ax + 0.5, 30.5, aw - 1, 13);
    text(ctx, `${Math.round(world.alarm)}%`, ax + aw + 10, 37, 13, world.alarm > 70 ? '#ff5a5a' : '#e8ecf5', 'left', '700');
    // loot + timer
    text(ctx, `LOOT  $${world.lootValue.toLocaleString('en-US')}`, 780, 20, 15, GOLD_BRIGHT, 'left', '700');
    text(ctx, `DIAMOND ${world.diamondTaken ? 'STOLEN ✓' : 'IN VAULT'}`, 780, 42, 11, world.diamondTaken ? '#7dff9e' : '#9fb2d8');
    const t = world.timeLeft;
    const mm = String(Math.floor(t / 60)).padStart(2, '0');
    const ss = String(Math.floor(t % 60)).padStart(2, '0');
    text(ctx, `${mm}:${ss}`, 1080, 20, 15, '#e8ecf5', 'left', '700');
    text(ctx, state === 'playing' ? 'P pause · M mute' : '', 1080, 42, 11, '#9fb2d8');
    // tool chips (clickable)
    const chips = [
      { key: 'smoke', label: `Q  SMOKE ×${world.toolCharges('smoke')}`, x: 330, hot: world.toolCharges('smoke') > 0 },
      { key: 'emp', label: `F  EMP ×${world.toolCharges('emp')}`, x: 480, hot: world.toolCharges('emp') > 0 },
    ];
    for (const chip of chips) {
      ctx.fillStyle = chip.hot ? 'rgba(212,169,78,0.18)' : 'rgba(60,66,90,0.5)';
      roundRect(ctx, chip.x, 62, 140, 26, 6);
      ctx.fill();
      ctx.strokeStyle = chip.hot ? GOLD : '#4a5170';
      ctx.lineWidth = 1;
      ctx.stroke();
      text(ctx, chip.label, chip.x + 70, 75, 11, chip.hot ? '#ffe9b0' : '#7a829e', 'center', '700');
    }
    // objective line
    const objective = world.diamondTaken
      ? 'Diamond stolen — reach the green EXIT and vanish.'
      : world.vaultOpen
        ? 'Vault open — grab the Aurum Diamond, then reach the exit.'
        : 'Steal the Aurum Diamond from the vault, then reach the exit.';
    text(ctx, objective, 640, 104, 13, '#e8ecf5', 'center');
  }

  drawToast(ctx, msg) {
    ctx.fillStyle = 'rgba(5,8,18,0.85)';
    const w = ctx.measureText(msg).width + 36;
    roundRect(ctx, 640 - w / 2, 640, w, 34, 8);
    ctx.fill();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 1;
    ctx.stroke();
    text(ctx, msg, 640, 658, 13, '#ffe9b0', 'center');
  }

  overlay(ctx, title, titleColor, lines, footer) {
    ctx.fillStyle = 'rgba(5,8,18,0.78)';
    ctx.fillRect(0, 0, 1280, 720);
    text(ctx, title, 640, 190, 54, titleColor, 'center', '800');
    let y = 280;
    for (const line of lines) {
      text(ctx, line.text, 640, y, line.size || 17, line.color || '#e8ecf5', 'center', line.weight || '400');
      y += line.gap || 34;
    }
    if (footer) text(ctx, footer, 640, 620, 15, GOLD_BRIGHT, 'center', '600');
  }

  drawTitle(ctx, now) {
    const glow = 0.6 + 0.4 * Math.sin(now / 600);
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, 1280, 720);
    // a faint museum silhouette: arches and a vault door
    ctx.strokeStyle = 'rgba(212,169,78,0.25)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(640, 720, 180 + i * 70, Math.PI, 0);
      ctx.stroke();
    }
    ctx.fillStyle = `rgba(212,169,78,${0.5 + glow * 0.3})`;
    ctx.beginPath();
    ctx.arc(640, 330, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#aee6ff';
    ctx.beginPath();
    ctx.moveTo(640, 306);
    ctx.lineTo(662, 324);
    ctx.lineTo(640, 352);
    ctx.lineTo(618, 324);
    ctx.closePath();
    ctx.fill();
    text(ctx, 'MIDNIGHT HEIST', 640, 150, 58, GOLD_BRIGHT, 'center', '800');
    text(ctx, '— The Aurum Vault —', 640, 205, 20, '#9fb2d8', 'center');
    this.overlayLines(ctx, [
      { text: 'You are Rook, a thief in the Aurum Museum after midnight.', size: 18 },
      { text: 'Cross the room, dodge the guards’ vision cones and the cameras,', size: 18 },
      { text: 'pick the vault, steal the Aurum Diamond, and reach the exit.', size: 18 },
      { text: '', size: 10, gap: 18 },
      { text: 'MOVE  WASD / arrows / click to walk      SNEAK  hold SHIFT      PICK LOCK  hold E at the vault', size: 15, color: '#ffe9b0' },
      { text: 'SMOKE BOMB  Q (×2)      EMP PULSE  F (×1, blinds cameras)      PAUSE  P      MUTE  M', size: 15, color: '#ffe9b0' },
      { text: 'If the ALARM meter hits 100% — or a guard touches you — the heist is over.', size: 15, color: '#ff9a9a' },
    ], 420);
    text(ctx, 'CLICK OR PRESS ENTER TO START', 640, 620, 17, `rgba(242,201,107,${0.55 + glow * 0.45})`, 'center', '700');
    text(ctx, 'Three wings. One diamond. No second chances.', 640, 660, 13, '#9fb2d8', 'center');
  }

  overlayLines(ctx, lines, startY) {
    let y = startY;
    for (const line of lines) {
      text(ctx, line.text, 640, y, line.size || 17, line.color || '#e8ecf5', 'center', line.weight || '400');
      y += line.gap || 34;
    }
  }

  drawPaused(ctx) {
    this.overlay(ctx, 'PAUSED', GOLD_BRIGHT, [
      { text: 'The guards keep their rounds. The alarm does not wait — but it does pause.', size: 17 },
      { text: 'P or ESC to resume · R to restart the wing', size: 15, color: '#ffe9b0' },
    ], '');
  }

  drawCaught(ctx, world) {
    const reason = world.caughtBy === 'alarm'
      ? 'The alarm hit 100% — the museum sealed itself and the guards closed in.'
      : 'A guard laid a hand on your shoulder. The heist ends here.';
    this.overlay(ctx, 'CAUGHT!', '#ff5a5a', [
      { text: reason, size: 18 },
      { text: `Loot kept: $${world.lootValue.toLocaleString('en-US')}  ·  Wing: ${world.level.name}`, size: 16, color: '#ffe9b0' },
      { text: 'The cones were there to be read. Next time, watch them sweep — then move.', size: 15, color: '#9fb2d8' },
    ], 'PRESS R OR CLICK TO TRY THE WING AGAIN');
  }

  drawLevelComplete(ctx, world, score) {
    this.overlay(ctx, 'WING CLEARED', '#7dff9e', [
      { text: `${world.level.name} — the diamond is yours and the door is behind you.`, size: 18 },
      { text: `Loot $${score.loot.toLocaleString('en-US')}  ·  Time bonus $${score.time.toLocaleString('en-US')}  ·  Stealth bonus $${score.stealth.toLocaleString('en-US')}`, size: 16, color: '#ffe9b0' },
      { text: `Wing score: $${score.total.toLocaleString('en-US')}`, size: 20, color: GOLD_BRIGHT, weight: '700' },
    ], 'PRESS ENTER OR CLICK FOR THE NEXT WING');
  }

  drawWon(ctx, world, total, rank) {
    this.overlay(ctx, 'THE PERFECT HEIST', GOLD_BRIGHT, [
      { text: 'Three wings. One diamond. The Aurum Vault is empty and you are gone.', size: 18 },
      { text: `Total take: $${total.toLocaleString('en-US')}   ·   Rank: ${rank}`, size: 22, color: '#7dff9e', weight: '700' },
      { text: 'The museum will not notice until morning. You already spent it by then.', size: 15, color: '#9fb2d8' },
    ], 'PRESS R OR CLICK TO RUN IT AGAIN');
  }
}
