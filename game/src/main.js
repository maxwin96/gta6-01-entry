// Sunset Bay — boot, game loop and state machine.
// Title -> playing -> paused / busted / wasted, with a save in
// localStorage. ?shot=cover|onfoot|chase|drive stages a scene for
// screenshots instead of the title screen, then sets window.__shotReady
// once it has settled.

import * as THREE from 'three';
import { CITY, PLAYER, SAVE_KEY, START_MONEY, WANTED, MISSIONS, SPRINT } from './config.js';
import { createRng, clamp, flatDistance, formatClock } from './utils.js';
import { createWorld } from './world.js';
import { createSunsetLighting } from './lighting.js';
import { createEffects } from './effects.js';
import { createPlayer } from './player.js';
import { createCar, spawnParkedCars } from './vehicles.js';
import { createTraffic, createPedestrians } from './traffic.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createInput, ACTION_ENTER_CAR, ACTION_PUNCH, ACTION_PAUSE } from './input.js';
import { createAudio } from './audio.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 1337;
const rng = createRng(seed);

// --- Renderer / scene ------------------------------------------------------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- World and actors -------------------------------------------------------
const world = createWorld(scene, seed);
const sunset = createSunsetLighting(scene);
const fx = createEffects(scene);
const player = createPlayer(scene);
const audio = createAudio();
const input = createInput(canvas);
const hud = createHud();
const police = createPolice(scene, rng);
const missions = createMissions(scene, world.places);
const traffic = createTraffic(scene, rng, 10);
const pedestrians = createPedestrians(scene, rng, 14);

// Parked cars along the roads, plus the red sports car for mission 2.
const parkedSpots = [
  { x: -22.5, z: 84, heading: 0 },
  { x: 33.5, z: -84, heading: Math.PI },
  { x: 89.5, z: 28, heading: Math.PI / 2 },
  { x: -145.5, z: -28, heading: Math.PI / 2 },
  { x: 145.5, z: 140, heading: 0 },
  { x: -78.5, z: -140, heading: Math.PI },
];
const parkedCars = spawnParkedCars(scene, rng, parkedSpots);
const sportsCar = createCar(scene, {
  x: world.places.sportsCar.x,
  z: world.places.sportsCar.z,
  heading: Math.PI / 2,
  color: 0xd91e2e,
  sporty: true,
  parked: true,
  id: 'sports-car',
});
const enterableCars = [...parkedCars, sportsCar];

// --- Game state --------------------------------------------------------------
const game = {
  mode: 'title', // title | playing | paused | over
  money: START_MONEY,
  missionIndex: 0,
  inCar: null, // the car the player is driving, or null
  cameraYaw: Math.PI,
  cameraPitch: 0.34,
  cameraDist: 8, // third-person distance on foot (staged shots pull back)
  clockMinutes: 9 * 60 + 12,
  crimeCooldown: 0,
  ramCooldown: 0,
  overReason: '',
  prevMissionIndex: 0,
  frames: 0,
  shotStaged: false,
  elapsed: 0,
};

function saveGame() {
  try {
    window.localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({ money: game.money, missionIndex: missions.state.index }),
    );
  } catch {}
}

function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.money !== 'number' || typeof data.missionIndex !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

function nearestCar(maxDist) {
  let best = null;
  let bestDist = maxDist;
  for (const car of enterableCars) {
    const d = flatDistance(player.state.pos, car.state);
    if (d < bestDist) {
      best = car;
      bestDist = d;
    }
  }
  return best;
}

function enterCar(car) {
  game.inCar = car;
  car.state.parked = false;
  player.group.visible = false;
  police.addCrime(2); // grand theft auto
  audio.honk();
  hud.setHint('WASD drive · Space brake · E exit');
}

function exitCar() {
  const car = game.inCar;
  if (!car) return;
  game.inCar = null;
  const side = { x: car.state.x + Math.cos(car.state.heading) * 2.4, z: car.state.z - Math.sin(car.state.heading) * 2.4 };
  player.reset(side.x, side.z);
  player.group.visible = true;
  player.state.heading = car.state.heading;
  game.cameraYaw = car.state.heading + Math.PI;
  hud.setHint('');
}

function gameOver(reason) {
  if (game.mode !== 'playing') return;
  game.mode = 'over';
  game.overReason = reason;
  input.releaseLock();
  audio.busted();
  audio.setEngine(0, false);
  saveGame();
  showScreen('over');
}

// Wanted level that belongs to a mission: the heat job is 3 stars, the
// sprint runs hot at 2, everything else starts clean.
function wantedForMission(index) {
  if (index === 2) return 3;
  if (index === 3) return SPRINT.wanted;
  return 0;
}

function startPlaying(fresh) {
  const save = fresh ? null : loadSave();
  game.money = save ? save.money : START_MONEY;
  game.missionIndex = save ? save.missionIndex : 0;
  game.prevMissionIndex = game.missionIndex;
  game.inCar = null;
  game.crimeCooldown = 0;
  game.ramCooldown = 0;
  game.clockMinutes = 9 * 60 + 12;
  police.reset();
  player.reset(world.places.spawn.x, world.places.spawn.z);
  player.group.visible = true;
  missions.startMission(game.missionIndex);
  police.setWanted(wantedForMission(game.missionIndex));
  game.cameraYaw = Math.PI;
  game.cameraPitch = 0.34;
  game.mode = 'playing';
  hideScreens();
  hud.show();
  audio.unlock();
  audio.startEngine();
  input.requestLock();
}

// --- Screens (title / pause / game over) -------------------------------------
const screenEl = document.getElementById('screen');
const screenTitle = document.getElementById('screen-title');
const screenText = document.getElementById('screen-text');
const btnStart = document.getElementById('btn-start');
const btnContinue = document.getElementById('btn-continue');
const btnResume = document.getElementById('btn-resume');
const btnRestart = document.getElementById('btn-restart');
const btnQuit = document.getElementById('btn-quit');

function hideScreens() {
  screenEl.style.display = 'none';
}

function showScreen(kind) {
  screenEl.style.display = 'flex';
  btnStart.style.display = 'none';
  btnContinue.style.display = 'none';
  btnResume.style.display = 'none';
  btnRestart.style.display = 'none';
  btnQuit.style.display = 'none';
  if (kind === 'title') {
    screenTitle.textContent = 'SUNSET BAY';
    screenText.innerHTML =
      'A sun-soaked open-world crime story. Run jobs for Marisol, steal fast cars, outrun the Sunset Bay PD — and beat the clock in the Sunset Sprint.<br><br>' +
      '<b>WASD</b> move / drive &nbsp;·&nbsp; <b>Mouse</b> camera &nbsp;·&nbsp; <b>Shift</b> run &nbsp;·&nbsp; <b>E</b> enter / exit car &nbsp;·&nbsp; <b>F / Click</b> punch &nbsp;·&nbsp; <b>Space</b> brake &nbsp;·&nbsp; <b>Esc</b> pause';
    btnStart.style.display = 'inline-block';
    const save = loadSave();
    if (save && save.missionIndex > 0) {
      btnContinue.style.display = 'inline-block';
      btnContinue.textContent = 'Continue — ' + save.money + ' · Mission ' + (save.missionIndex + 1) + '/' + MISSIONS.length;
    }
  } else if (kind === 'paused') {
    screenTitle.textContent = 'PAUSED';
    screenText.textContent = 'Take a breath. The city waits.';
    btnResume.style.display = 'inline-block';
    btnQuit.style.display = 'inline-block';
  } else if (kind === 'over') {
    screenTitle.textContent = game.overReason === 'busted' ? 'BUSTED!' : 'WASTED';
    screenText.textContent =
      game.overReason === 'busted'
        ? 'The Sunset Bay PD caught you. Your money and mission progress were saved.'
        : 'You got taken out on the streets of Sunset Bay. Your money and mission progress were saved.';
    btnRestart.style.display = 'inline-block';
    btnQuit.style.display = 'inline-block';
  }
}

btnStart.addEventListener('click', () => startPlaying(true));
btnContinue.addEventListener('click', () => startPlaying(false));
btnResume.addEventListener('click', resumeGame);
btnRestart.addEventListener('click', () => startPlaying(false));
btnQuit.addEventListener('click', () => {
  game.mode = 'title';
  saveGame();
  showScreen('title');
});

function resumeGame() {
  game.mode = 'playing';
  hideScreens();
  input.requestLock();
}

document.addEventListener('pointerlockchange', () => {
  if (!input.isLocked() && game.mode === 'playing' && !shot) {
    game.mode = 'paused';
    showScreen('paused');
  }
});

canvas.addEventListener('click', () => {
  if (game.mode === 'playing' && !input.isLocked() && !shot) input.requestLock();
});

// --- Third-person camera ------------------------------------------------------
function updateCamera(dt) {
  const target = game.inCar
    ? new THREE.Vector3(game.inCar.state.x, 1.4, game.inCar.state.z)
    : new THREE.Vector3(player.state.pos.x, 1.6, player.state.pos.z);
  if (game.inCar && !shot) {
    // Ease the camera behind the car while driving (skipped for staged
    // shots, where the camera angle is chosen for the picture).
    const behind = game.inCar.state.heading + Math.PI;
    let diff = behind - game.cameraYaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    game.cameraYaw += diff * Math.min(1, dt * 1.6);
  }
  const dist = game.inCar ? 10.5 : game.cameraDist;
  const height = 2.2 + Math.sin(game.cameraPitch) * dist;
  const flat = Math.cos(game.cameraPitch) * dist;
  camera.position.set(
    target.x + Math.sin(game.cameraYaw) * flat,
    target.y + height,
    target.z + Math.cos(game.cameraYaw) * flat,
  );
  camera.lookAt(target.x, target.y + 0.4, target.z);
}

// --- One simulation step -------------------------------------------------------
function step(dt) {
  game.frames += 1;
  game.elapsed += dt;
  game.clockMinutes = (game.clockMinutes + dt * 6) % 1440; // 6 game-minutes per second
  if (game.crimeCooldown > 0) game.crimeCooldown -= dt;
  if (game.ramCooldown > 0) game.ramCooldown -= dt;

  const actions = input.takeActions();
  const mouse = input.takeMouseDelta();
  game.cameraYaw -= mouse.dx * 0.0028;
  game.cameraPitch = clamp(game.cameraPitch + mouse.dy * 0.0022, 0.05, 1.0);

  // Pause toggle (Esc key, or pointer-lock loss handled above).
  if (actions.has(ACTION_PAUSE) && !shot) {
    game.mode = 'paused';
    input.releaseLock();
    showScreen('paused');
    return;
  }

  // Enter / exit car.
  if (actions.has(ACTION_ENTER_CAR)) {
    if (game.inCar) {
      exitCar();
    } else {
      const car = nearestCar(4);
      if (car) enterCar(car);
    }
  }

  // Punch on foot.
  if (actions.has(ACTION_PUNCH) && !game.inCar) {
    if (player.punch()) {
      audio.punch();
      const reach = {
        x: player.state.pos.x + Math.sin(player.state.heading) * 1.6,
        z: player.state.pos.z + Math.cos(player.state.heading) * 1.6,
      };
      if (pedestrians.hitAt(reach.x, reach.z, 1.6)) police.addCrime(1);
    }
  }

  // Movement.
  if (game.inCar) {
    const car = game.inCar;
    const speedBefore = Math.abs(car.state.speed);
    const hitWall = car.drive(dt, input, world.colliders);
    if (hitWall) {
      fx.sparks(car.state.x, 0.8, car.state.z);
      if (speedBefore > 16) fx.explode(car.state.x, 0.8, car.state.z);
      if (game.crimeCooldown <= 0) {
        audio.crash();
        game.crimeCooldown = 1;
      }
    }
    // Exhaust puffs while rolling, skid marks on hard turns.
    if (Math.abs(car.state.speed) > 4 && game.frames % 5 === 0) {
      fx.exhaust(car.state.x, 0, car.state.z, car.state.heading);
    }
    if (Math.abs(car.state.steer) > 0.42 && Math.abs(car.state.speed) > 12 && game.frames % 4 === 0) {
      const back = -1.4;
      fx.skidMark(
        car.state.x + Math.sin(car.state.heading) * back,
        car.state.z + Math.cos(car.state.heading) * back,
        car.state.heading,
      );
    }
    // Running over pedestrians / ramming traffic while driving is a crime.
    if (pedestrians.hitAt(car.state.x, car.state.z, 2.4)) {
      police.addCrime(1);
      car.state.speed *= 0.6;
      audio.crash();
      fx.sparks(car.state.x, 0.8, car.state.z);
    }
    for (const other of traffic.cars) {
      if (flatDistance(car.state, other.state) < 3.6) {
        if (game.crimeCooldown <= 0) {
          police.addCrime(1);
          audio.crash();
          game.crimeCooldown = 2;
        }
        fx.sparks(car.state.x, 0.8, car.state.z);
        car.state.speed *= 0.5;
        other.state.speed = 0;
      }
    }
    audio.setEngine(Math.abs(car.state.speed) / 40, true);
  } else {
    player.update(dt, input, game.cameraYaw, world.colliders);
    audio.setEngine(0, false);
  }

  // World life.
  world.update(dt);
  sunset.update(dt, game.elapsed);
  fx.update(dt);
  traffic.update(dt, game.inCar);
  pedestrians.update(dt);

  // Police chase. The target is the car when driving, the player on foot.
  // In the cover / on-foot staged shots the cruisers hold still so they
  // stay in frame (and cannot bust the player mid-screenshot).
  const policeDt = shot && (shot === 'cover' || shot === 'onfoot') ? 0 : dt;
  const target = game.inCar
    ? { x: game.inCar.state.x, z: game.inCar.state.z, inCar: true }
    : { x: player.state.pos.x, z: player.state.pos.z, inCar: false };
  police.update(
    policeDt,
    target,
    world.colliders,
    () => gameOver('busted'),
    () => {
      if (game.ramCooldown <= 0) {
        player.setHealth(player.state.health - 9);
        audio.crash();
        game.ramCooldown = 1;
        if (player.state.health <= 0) gameOver('wasted');
      }
    },
  );

  // Slow health regen while clean.
  if (police.wanted === 0 && player.state.health < PLAYER.maxHealth) {
    player.setHealth(player.state.health + 3 * dt);
  }

  // Missions.
  if (missions.state.index !== game.prevMissionIndex) {
    game.prevMissionIndex = missions.state.index;
    police.setWanted(wantedForMission(missions.state.index));
  }
  const here = () =>
    game.inCar ? { x: game.inCar.state.x, z: game.inCar.state.z } : player.state.pos;
  missions.update(dt, {
    playerPos: here,
    inSportsCar: () => game.inCar === sportsCar,
    onPickup: () => audio.pickup(),
    onReward: (reward) => {
      game.money += reward;
      audio.missionComplete();
      saveGame();
    },
    onFireworks: () => {
      const p = here();
      fx.fireworks(p.x, p.z);
    },
    onSprintRestart: () => police.setWanted(SPRINT.wanted),
  });

  // HUD.
  const marker = missions.markerPos ? missions.markerPos() : null;
  const current = missions.currentMission();
  hud.update({
    health: player.state.health,
    money: game.money,
    wanted: police.wanted,
    clock: formatClock(game.clockMinutes),
    objective: missions.objective,
    banner: missions.banner,
    speedKmh: game.inCar ? Math.abs(game.inCar.state.speed) * 3.6 : null,
    marker,
    missionIndex: missions.state.index,
    missionTotal: MISSIONS.length,
    missionTitle: current ? current.title : 'All Done',
    player: { x: player.state.pos.x, z: player.state.pos.z, heading: player.state.heading },
    traffic: traffic.cars.map((c) => ({ x: c.state.x, z: c.state.z })),
    police: police.cruisers.map((c) => ({ x: c.state.x, z: c.state.z })),
  });
  audio.updateSiren(dt, police.wanted > 0);

  updateCamera(dt);
}

// --- Screenshot staging --------------------------------------------------------
function stageShot(name) {
  game.mode = 'playing';
  hideScreens();
  hud.show();
  game.money = 1250;
  game.clockMinutes = 14 * 60 + 32;
  player.reset(world.places.spawn.x, world.places.spawn.z);
  player.group.visible = true;
  missions.startMission(0);
  game.prevMissionIndex = 0;

  if (name === 'cover') {
    // Player beside the red sports car by the plaza, one star, a cruiser near.
    player.reset(18, -6);
    player.state.heading = -0.6;
    sportsCar.place(13, -13, Math.PI / 2);
    game.cameraYaw = 2.4;
    game.cameraPitch = 0.3;
    game.cameraDist = 13;
    police.setWanted(1);
  } else if (name === 'onfoot') {
    // Walking the pier, package marker glowing ahead.
    player.reset(84, 212);
    player.state.heading = 0;
    game.cameraYaw = Math.PI;
    game.cameraPitch = 0.28;
  } else if (name === 'chase') {
    // Driving the sports car down Ocean Drive with a 3-star tail.
    missions.startMission(2);
    game.prevMissionIndex = 2;
    sportsCar.place(24.8, -120, 0); // southbound lane of Ocean Drive
    game.inCar = sportsCar;
    sportsCar.state.parked = false;
    sportsCar.state.speed = 24;
    player.group.visible = false;
    police.setWanted(3);
    // Three-quarter rear view so the tail is in frame behind the car.
    game.cameraYaw = Math.PI - 0.55;
    game.cameraPitch = 0.3;
  } else if (name === 'drive') {
    // Cruising through downtown traffic, clean record.
    const car = parkedCars[0];
    car.place(-31.2, 60, 0); // southbound lane of the avenue
    car.state.speed = 16;
    game.inCar = car;
    car.state.parked = false;
    player.group.visible = false;
    game.cameraYaw = Math.PI;
    game.cameraPitch = 0.3;
    // Two traffic cars ahead on the same road so the street feels alive.
    traffic.stageCar(0, -28, 110, true, 1);
    traffic.stageCar(1, -28, 150, true, -1);
    traffic.stageCar(2, 28, 90, true, 1);
  }
  game.shotStaged = true;
}

// --- Main loop -------------------------------------------------------------------
const clock = new THREE.Clock();
let shotReadyAt = -1;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (game.mode === 'playing') {
    step(dt);
    if (shot && game.shotStaged) {
      // Let traffic settle, then place the police tail for the shot.
      if (game.frames === 25 && (shot === 'chase' || shot === 'cover')) {
        const anchor = game.inCar ? game.inCar.state : player.state.pos;
        police.cruisers.forEach((cruiser, i) => {
          if (shot === 'cover') {
            // Down the road south of the player, in frame, facing the camera.
            cruiser.place(anchor.x - 8 - i * 6, anchor.z + 34 + i * 4, Math.PI);
          } else {
            // Behind-left of the speeding car, closing in.
            cruiser.place(anchor.x - 10 - i * 12, anchor.z - 18 - i * 10, 0);
          }
        });
      }
      if (shot === 'chase' && game.frames >= 25) {
        // Keep the chase alive for the picture: the sports car holds speed
        // and the cruisers stay in the visible south-west quadrant — one
        // cutting in ahead, one alongside, one trailing.
        sportsCar.state.speed = 24;
        const spots = [
          { dx: -7, dz: 16, heading: Math.PI },
          { dx: 7, dz: 10, heading: 0 },
          { dx: -6, dz: -12, heading: 0 },
        ];
        police.cruisers.forEach((cruiser, i) => {
          const spot = spots[i % spots.length];
          cruiser.place(
            sportsCar.state.x + spot.dx,
            sportsCar.state.z + spot.dz,
            spot.heading,
          );
        });
      }
      if (game.frames === 60 && shotReadyAt < 0) {
        shotReadyAt = game.frames;
        window.__shotReady = true;
      }
    }
  } else if (game.mode === 'title') {
    // Slow orbit around the plaza behind the title screen.
    const t = performance.now() / 1000;
    camera.position.set(Math.sin(t * 0.05) * 90, 42, Math.cos(t * 0.05) * 90);
    camera.lookAt(0, 8, 0);
    world.update(dt);
    sunset.update(dt, t);
    traffic.update(dt, null);
    pedestrians.update(dt);
  }

  renderer.render(scene, camera);
  if (game.frames === 5) window.__gameReady = true;
}

if (shot) {
  stageShot(shot);
} else {
  showScreen('title');
  hud.hide();
}
frame();
