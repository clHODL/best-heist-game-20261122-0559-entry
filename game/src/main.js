// main.js — the game loop, the screens, and the screenshot presets.
//
// States: title → playing ⇄ paused → levelComplete → (next wing) → won,
// or playing → caught. The loop runs on requestAnimationFrame with a
// clamped delta so a background tab never teleports the thief.
//
// ?shot=play|loot|caught|win&seed=N freezes a staged scene for the
// maker's screenshots: fixed positions, a fixed alarm, no updates, so the
// same URL always renders the same frame.

import { LEVELS, VIEW } from './config.js';
import { World } from './world.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { SoundBank } from './audio.js';
import { mulberry32 } from './random.js';

const params = new URLSearchParams(window.location.search);
const SHOT = params.get('shot');
const SEED = Number(params.get('seed') || '7');

const canvas = document.getElementById('game');
canvas.width = VIEW.width;
canvas.height = VIEW.height;

const input = new Input(canvas);
const sounds = new SoundBank();
const renderer = new Renderer(canvas);

let state = 'title'; // title | playing | paused | caught | levelComplete | won
let world = new World(0);
let totalScore = 0;
let lastScore = null;
let lastRank = 'C';
let lastTime = performance.now();
let frozenNow = 1200; // a fixed clock for screenshot presets

function startWing(index) {
  world = new World(index);
  state = 'playing';
  world.say(world.level.tip, 5);
}

function startHeist() {
  totalScore = 0;
  sounds.ensure();
  startWing(0);
}

function applyShotPreset() {
  // Every preset is a real game state, staged, then frozen: the
  // screenshots show the game itself, mid-heist, never a mock-up.
  if (SHOT === 'play') {
    startWing(0);
    world.player.x = 430;
    world.player.y = 430;
    world.player.facing = -0.4;
    world.alarm = 32;
    world.lootValue = 1250;
    world.lootCount = 4;
    world.elapsed = 72;
    world.loot[0].taken = true;
    world.loot[1].taken = true;
    world.loot[5].taken = true;
    world.loot[6].taken = true;
    world.guards[0].x = 760;
    world.guards[0].y = 120;
    world.guards[0].angle = Math.PI;
    world.guards[0].suspicion = 30;
    world.guards[1].x = 420;
    world.guards[1].y = 620;
    world.guards[1].angle = 0;
    world.cameras[0].angle = Math.PI / 2 + 0.5;
    world.say('Stay out of the amber cones. Hold SHIFT to sneak.', 60);
    world.toastUntil = 9999;
  } else if (SHOT === 'loot') {
    startWing(1);
    world.player.x = 640;
    world.player.y = 430;
    world.player.facing = -Math.PI / 2;
    world.vaultOpen = true;
    world.alarm = 68;
    world.lootValue = 2900;
    world.lootCount = 7;
    world.elapsed = 131;
    world.loot.forEach((l, i) => { if (i < 5) l.taken = true; });
    world.guards[0].x = 760;
    world.guards[0].y = 360;
    world.guards[0].angle = Math.PI;
    world.guards[0].suspicion = 82;
    world.guards[0].state = 'suspicious';
    world.guards[1].x = 640;
    world.guards[1].y = 200;
    world.guards[1].angle = Math.PI / 2;
    world.guards[2].x = 300;
    world.guards[2].y = 640;
    world.guards[2].angle = 0;
    world.empUntil = world.now + 8;
    world.say('Vault open — grab the Aurum Diamond, then reach the exit!', 60);
    world.toastUntil = 9999;
  } else if (SHOT === 'caught') {
    startWing(0);
    world.player.x = 700;
    world.player.y = 430;
    world.alarm = 100;
    world.caughtBy = 'guard';
    world.lootValue = 1250;
    world.guards[0].x = 726;
    world.guards[0].y = 430;
    world.guards[0].angle = Math.PI;
    world.guards[0].state = 'chase';
    world.guards[0].suspicion = 100;
    state = 'caught';
    sounds.caught();
  } else if (SHOT === 'win') {
    startWing(2);
    world.diamondTaken = true;
    world.lootValue = 9400;
    world.elapsed = 165;
    lastScore = { loot: 9400, time: 450, stealth: 1200, total: 11050 };
    lastRank = 'S';
    totalScore = 11050;
    state = 'won';
  }
  state = state === 'playing' ? 'playing' : state;
  if (SHOT === 'play' || SHOT === 'loot') state = 'playing';
}

function clickChips(click) {
  if (!click) return false;
  // The two tool chips under the HUD bar.
  if (click.y >= 62 && click.y <= 88) {
    if (click.x >= 330 && click.x <= 470) {
      world.useSmoke(sounds);
      return true;
    }
    if (click.x >= 480 && click.x <= 620) {
      world.useEmp(sounds);
      return true;
    }
  }
  return false;
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = SHOT ? 0 : Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  const clock = SHOT ? frozenNow : now;

  if (state === 'title') {
    renderer.drawTitle(renderer.ctx, clock);
    if (input.hit('Enter', ' ') || input.click) {
      sounds.ensure();
      sounds.click();
      startHeist();
    }
  } else if (state === 'playing') {
    if (!SHOT) {
      if (input.hit('p', 'Escape')) {
        state = 'paused';
      } else if (input.hit('m')) {
        sounds.toggleMute();
      } else if (input.hit('r')) {
        startWing(world.levelIndex);
      } else {
        if (input.click && !clickChips(input.click)) {
          world.moveTargetShown = input.click;
        } else if (!input.click) {
          world.moveTargetShown = input.moveTarget ? { ...input.moveTarget } : null;
        }
        world.update(dt, input, sounds);
        if (world.caughtBy) {
          state = 'caught';
          sounds.caught();
        } else if (world.diamondTaken && world.atExit) {
          lastScore = world.score();
          lastRank = world.rank();
          totalScore += lastScore.total;
          sounds.win();
          if (world.levelIndex + 1 < LEVELS.length) {
            state = 'levelComplete';
          } else {
            state = 'won';
          }
        } else if (world.diamondTaken && world.atExit === false && input.click) {
          // clicked the exit area without the diamond: nothing, the toast covers it
        }
        if (!world.diamondTaken && world.atExit && world.now > 1) {
          world.say('The Aurum Diamond is still in the vault!', 2);
        }
      }
    }
    renderer.draw(world, state, clock);
  } else if (state === 'paused') {
    renderer.draw(world, state, clock);
    renderer.drawPaused(renderer.ctx);
    if (input.hit('p', 'Escape')) state = 'playing';
    else if (input.hit('r')) startWing(world.levelIndex);
  } else if (state === 'caught') {
    renderer.draw(world, state, clock);
    renderer.drawCaught(renderer.ctx, world);
    if (input.hit('r', 'Enter', ' ') || input.click) {
      sounds.click();
      startWing(world.levelIndex);
    }
  } else if (state === 'levelComplete') {
    renderer.draw(world, state, clock);
    renderer.drawLevelComplete(renderer.ctx, world, lastScore);
    if (input.hit('Enter', ' ') || input.click) {
      sounds.click();
      startWing(world.levelIndex + 1);
    }
  } else if (state === 'won') {
    renderer.draw(world, state, clock);
    renderer.drawWon(renderer.ctx, world, totalScore, lastRank);
    if (input.hit('r', 'Enter', ' ') || input.click) {
      sounds.click();
      startHeist();
    }
  }

  input.endFrame();
}

// A seeded stream for the cosmetic dust; the same seed, the same frame.
void mulberry32(SEED);

if (SHOT) {
  applyShotPreset();
  // Render one frozen frame immediately so a screenshot never catches a blank canvas.
  renderer.draw(world, state, frozenNow);
  if (state === 'caught') renderer.drawCaught(renderer.ctx, world);
  if (state === 'won') renderer.drawWon(renderer.ctx, world, totalScore, lastRank);
}
requestAnimationFrame(frame);
