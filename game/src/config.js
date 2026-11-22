// config.js — the museum, its rooms and every level of the heist.
//
// The Aurum Museum at night, three wings, one diamond. Each level is a
// single room the thief crosses: solid walls, low cover that blocks sight,
// patrol guards, sweeping cameras, scattered loot, a locked vault holding
// the Aurum Diamond, vents for a second route, and a getaway door.
//
// Coordinates are canvas pixels (1280 x 720). Walls and cover are axis
// aligned rectangles; guards walk straight patrol lanes that never cross a
// wall, so their cones sweep clean corridors the player must read.

export const VIEW = { width: 1280, height: 720 };

export const TUNE = {
  playerRadius: 14,
  walkSpeed: 178,
  sneakSpeed: 92,
  guardWalkSpeed: 62,
  guardChaseSpeed: 148,
  guardSightRange: 235,
  guardSightHalfAngle: 0.61, // ~35 degrees each side
  cameraSightRange: 260,
  cameraSightHalfAngle: 0.5,
  alarmRiseGuard: 26, // per second while a guard is suspicious
  alarmRiseChase: 46, // per second while a guard is chasing
  alarmRiseCamera: 34, // per second while a camera sees the thief
  alarmDecay: 7, // per second while nobody sees the thief
  suspicionRate: 55, // per second while the thief is in a cone
  suspicionCloseBonus: 45, // extra per second when very close
  suspicionDecay: 34,
  chaseLoseSightSec: 3,
  lockpickSeconds: 3,
  smokeSeconds: 6,
  smokeRadius: 95,
  empSeconds: 12,
  catchDistance: 26,
  pickupRadius: 26,
};

export const TOOLS = {
  smoke: { name: 'Smoke bomb', key: 'Q', charges: 2, blurb: 'a vision-blocking cloud' },
  emp: { name: 'EMP pulse', key: 'F', charges: 1, blurb: 'blinds every camera' },
};

function wall(x, y, w, h) {
  return { x, y, w, h };
}

function cover(x, y, w, h, kind) {
  return { x, y, w, h, kind };
}

function guard(path, pause = 1.1) {
  return { path, pause };
}

function camera(x, y, baseAngle, sweep, speed) {
  return { x, y, baseAngle, sweep, speed };
}

function loot(x, y, kind, value) {
  return { x, y, kind, value, taken: false };
}

function vent(x, y, toX, toY) {
  return { x, y, w: 46, h: 46, toX, toY };
}

export const LEVELS = [
  {
    name: 'Wing I — The Grand Gallery',
    parSeconds: 150,
    start: { x: 120, y: 600 },
    exit: { x: 1160, y: 96, w: 72, h: 40, label: 'GETAWAY DOOR' },
    vault: { x: 1000, y: 570, w: 130, h: 96 },
    walls: [
      wall(0, 0, 1280, 24), wall(0, 696, 1280, 24),
      wall(0, 0, 24, 720), wall(1256, 0, 24, 720),
      wall(180, 170, 230, 24), wall(870, 170, 230, 24),
      wall(180, 526, 230, 24), wall(870, 526, 230, 24),
      wall(628, 150, 24, 90), wall(628, 500, 24, 100),
    ],
    cover: [
      cover(560, 320, 160, 84, 'case'),
      cover(300, 330, 90, 60, 'crate'),
      cover(890, 330, 90, 60, 'crate'),
      cover(470, 150, 70, 46, 'plant'),
      cover(740, 540, 70, 46, 'plant'),
    ],
    guards: [
      guard([[140, 120], [1140, 120]]),
      guard([[980, 620], [140, 620]]),
    ],
    cameras: [camera(640, 26, Math.PI / 2, 0.9, 0.45)],
    loot: [
      loot(250, 360, 'coin', 100), loot(700, 210, 'coin', 100),
      loot(1030, 360, 'coin', 100), loot(250, 620, 'coin', 100),
      loot(520, 580, 'bar', 300), loot(860, 600, 'bar', 300),
      loot(700, 430, 'painting', 500),
    ],
    vents: [vent(120, 120, 1150, 600)],
    tip: 'Stay out of the amber cones. Hold SHIFT to sneak — slower, but harder to spot.',
  },
  {
    name: 'Wing II — The Vault Hall',
    parSeconds: 180,
    start: { x: 110, y: 110 },
    exit: { x: 1160, y: 620, w: 72, h: 40, label: 'GETAWAY DOOR' },
    vault: { x: 575, y: 300, w: 130, h: 110 },
    walls: [
      wall(0, 0, 1280, 24), wall(0, 696, 1280, 24),
      wall(0, 0, 24, 720), wall(1256, 0, 24, 720),
      wall(300, 96, 24, 190), wall(300, 434, 24, 190),
      wall(956, 96, 24, 190), wall(956, 434, 24, 190),
      wall(430, 330, 120, 24), wall(730, 330, 120, 24),
      wall(560, 96, 160, 24),
    ],
    cover: [
      cover(420, 140, 90, 60, 'case'),
      cover(770, 140, 90, 60, 'case'),
      cover(400, 520, 90, 60, 'crate'),
      cover(790, 520, 90, 60, 'crate'),
      cover(640, 470, 60, 40, 'plant'),
    ],
    guards: [
      // The middle guard walks around the vault, never through it:
      // down its left side, across below it, up its right side.
      guard([[140, 360], [520, 360], [520, 640], [760, 640], [760, 360], [1140, 360]]),
      guard([[640, 130], [640, 260]], 0.8),
      guard([[200, 650], [1080, 650]]),
    ],
    cameras: [
      camera(26, 360, 0, 0.85, 0.5),
      camera(1254, 360, Math.PI, 0.85, 0.5),
    ],
    loot: [
      loot(200, 200, 'coin', 100), loot(1080, 200, 'coin', 100),
      loot(200, 520, 'coin', 100), loot(1080, 520, 'coin', 100),
      loot(640, 200, 'bar', 300), loot(640, 560, 'bar', 300),
      loot(380, 360, 'painting', 500), loot(900, 360, 'painting', 500),
    ],
    vents: [vent(120, 640, 1140, 120), vent(1140, 120, 120, 640)],
    tip: 'The vault needs a lockpick: hold E beside it for 3 seconds. Picking is loud — guards hear it.',
  },
  {
    name: 'Wing III — The Rooftop Getaway',
    parSeconds: 210,
    start: { x: 120, y: 360 },
    exit: { x: 1170, y: 360, w: 60, h: 60, label: 'HELIPAD' },
    vault: { x: 130, y: 120, w: 130, h: 100 },
    walls: [
      wall(0, 0, 1280, 24), wall(0, 696, 1280, 24),
      wall(0, 0, 24, 720), wall(1256, 0, 24, 720),
      wall(330, 96, 24, 200), wall(330, 424, 24, 200),
      wall(640, 96, 24, 140), wall(640, 484, 24, 140),
      wall(950, 96, 24, 200), wall(950, 424, 24, 200),
      wall(480, 348, 130, 24), wall(700, 348, 130, 24),
    ],
    cover: [
      cover(430, 150, 90, 60, 'crate'),
      cover(760, 150, 90, 60, 'crate'),
      cover(430, 510, 90, 60, 'crate'),
      cover(760, 510, 90, 60, 'crate'),
      cover(520, 420, 80, 50, 'case'),
      cover(700, 250, 80, 50, 'case'),
    ],
    guards: [
      guard([[380, 120], [620, 120]]),
      guard([[700, 660], [1140, 660]]),
      guard([[1140, 120], [1140, 600]], 0.7),
      guard([[480, 320], [800, 320]], 0.9),
    ],
    cameras: [
      camera(640, 26, Math.PI / 2, 1.0, 0.6),
      camera(640, 694, -Math.PI / 2, 1.0, 0.6),
    ],
    loot: [
      loot(200, 620, 'coin', 100), loot(1080, 620, 'coin', 100),
      loot(500, 260, 'coin', 100), loot(880, 540, 'coin', 100),
      loot(1080, 200, 'bar', 300), loot(200, 200, 'bar', 300),
      loot(640, 360, 'painting', 500), loot(1080, 430, 'painting', 500),
    ],
    vents: [vent(120, 640, 1100, 120)],
    tip: 'Four guards, two cameras, one way out. The helipad will not wait — but the alarm will.',
  },
];
