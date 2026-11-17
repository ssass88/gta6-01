// Neon Vice: Syndicate - Main Game Lifecycle & Input Loop
// Manages world updates, procedural audio, 2.5D rendering, screen state machine,
// and ?shot=city|driving|police-chase|mission screenshot hooks with window.__shotReady.

import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createAudioSystem } from './audio.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_ENTER_VEHICLE, ACTION_RADIO } from './input.js';
import { createWorld, EVENT_SHOOT, EVENT_EXPLODE, EVENT_CRASH, EVENT_MISSION_PASS, EVENT_WASTED, EVENT_STAR_UP, EVENT_CASH } from './world.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');

const random = createRandom(seed);
const world = createWorld(random);
const renderer = createRenderer(canvas);
const audio = createAudioSystem();

function announce(message) {
  if (status) status.textContent = message;
}

// Deterministic Screenshot Scene Runner
function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;

  function paint() {
    renderer.draw(world.state, scene.screen);
    painted++;
    if (painted < 3) {
      requestAnimationFrame(paint);
    } else {
      window.__shotReady = true;
    }
  }

  requestAnimationFrame(paint);
}

// Interactive Game Loop
function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.ensureResume();
    audio.startRadio(0);
    announce('Welcome to Neon Vice: Syndicate. Explore the open world on foot or by vehicle.');
  }

  function handleInputActions() {
    const actions = input.takeActions();

    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) {
        startGame();
      }
      return;
    }

    if (screen === SCREEN_OVER) {
      if (actions & ACTION_CONFIRM) {
        // Respawn at safehouse
        world.reset();
        screen = SCREEN_PLAY;
      }
      return;
    }

    if (actions & ACTION_PAUSE) {
      screen = screen === SCREEN_PLAY ? SCREEN_PAUSED : SCREEN_PLAY;
      announce(screen === SCREEN_PAUSED ? 'Game paused.' : 'Game resumed.');
      return;
    }

    if (actions & ACTION_RADIO && world.state.player.vehicle) {
      const nextSt = audio.nextRadioStation();
      const stName = nextSt >= 0 ? `Radio Station: ${nextSt + 1}` : 'Radio Off';
      announce(stName);
    }

    // Weapon selection
    const wepNum = input.getWeaponNumber();
    if (wepNum !== null) {
      const pl = world.state.player;
      if (typeof wepNum === 'number') {
        if (wepNum - 1 < pl.weapons.length) {
          pl.currentWeaponIndex = wepNum - 1;
        }
      } else if (wepNum === 'next') {
        pl.currentWeaponIndex = (pl.currentWeaponIndex + 1) % pl.weapons.length;
      } else if (wepNum === 'prev') {
        pl.currentWeaponIndex = (pl.currentWeaponIndex - 1 + pl.weapons.length) % pl.weapons.length;
      }
    }
  }

  function stepWorld() {
    if (screen !== SCREEN_PLAY) return;

    const mouseState = input.getMouseState();
    const aimAngle = input.getMouseAimAngle(canvas.width / 2, canvas.height / 2);

    const inputState = {
      moveVector: input.getMovementVector(),
      isSprinting: input.isSprinting(),
      isHandbrake: input.isHandbrake(),
      aimAngle,
      isShooting: mouseState.isDown,
      enterVehicle: input.wasJustPressed('KeyF') || input.wasJustPressed('Enter'),
    };

    const events = world.step(STEP, inputState);

    // Audio SFX Triggers
    if (events & EVENT_SHOOT) {
      const pl = world.state.player;
      const wep = pl.weapons[pl.currentWeaponIndex];
      audio.playSound(wep === 'PISTOL' ? 'pistol' : wep === 'SMG' ? 'smg' : wep === 'SHOTGUN' ? 'shotgun' : wep === 'RIFLE' ? 'rifle' : wep === 'ROCKET' ? 'rocket' : 'punch');
    }
    if (events & EVENT_EXPLODE) {
      audio.playSound('explosion');
      renderer.triggerShake(24);
    }
    if (events & EVENT_CRASH) {
      audio.playSound('car_crash');
      renderer.triggerShake(8);
    }
    if (events & EVENT_MISSION_PASS) {
      audio.playSound('mission_pass');
    }
    if (events & EVENT_STAR_UP) {
      audio.playSound('star_up');
    }
    if (events & EVENT_CASH) {
      audio.playSound('cash');
    }
    if (events & EVENT_WASTED) {
      screen = SCREEN_OVER;
      audio.playSound('explosion');
      announce('WASTED! Press Space to respawn.');
    }

    // Vehicle audio update
    const pl = world.state.player;
    if (pl.vehicle) {
      const v = pl.vehicle;
      const speedRatio = Math.abs(v.speed) / v.maxSpeed;
      const isBraking = input.getMovementVector().y > 0 && v.speed > 0;
      audio.updateVehicleAudio(true, speedRatio, isBraking, v.isDrifting);
    } else {
      audio.updateVehicleAudio(false, 0, false, false);
    }

    // Police siren audio
    audio.updatePoliceSiren(pl.wantedLevel, 1);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;

    handleInputActions();

    while (accumulator >= STEP && screen === SCREEN_PLAY) {
      stepWorld();
      accumulator -= STEP;
    }

    renderer.draw(world.state, screen);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Neon Vice: Syndicate. Press Space or Click to start.');
  requestAnimationFrame(frame);
}

if (shot) {
  runShot(shot);
} else {
  runGame();
}
