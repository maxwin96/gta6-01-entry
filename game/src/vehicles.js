// Cars: detailed low-poly bodies — stepped hood and trunk, a slanted
// windscreen under a proper roof, grille, glowing headlights, red tail
// lights, mirrors, twin exhausts, a spoiler on sporty cars, hubcapped
// wheels and a plate at the back — plus arcade driving physics and the
// parked cars the player can steal. Police cruisers are built from the
// same factory with a white paint job (see police.js).

import * as THREE from 'three';
import { CAR } from './config.js';
import { angleDelta, clamp } from './utils.js';
import { clampToCity } from './world.js';

const PAINTS = [0xd91e2e, 0x2a6fd9, 0xe8c33a, 0xf2f0ea, 0x1c1e24, 0x3d7bd9, 0xd97a2b, 0x4fae5f];
const TYRE_GEO = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 14);
const TYRE_MAT = new THREE.MeshLambertMaterial({ color: 0x14161a });

function plateTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = '#f2f0ea';
  g.fillRect(0, 0, 128, 32);
  g.fillStyle = '#1a2a6b';
  g.font = 'bold 20px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('SB • 90210', 64, 17);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const PLATE_TEX = plateTexture();

export function buildCarMesh(color, sporty) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const darkTrim = new THREE.MeshLambertMaterial({ color: 0x22252a });
  const glassMat = new THREE.MeshLambertMaterial({
    color: 0x182838,
    emissive: 0x2a4a66,
    emissiveIntensity: 0.35,
  });
  const len = sporty ? 4.6 : 4.2;
  const wid = sporty ? 1.95 : 1.85;
  const half = len / 2;

  // Lower body, then a stepped hood and trunk so the silhouette reads.
  const body = new THREE.Mesh(new THREE.BoxGeometry(wid, 0.55, len), paint);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.92, 0.16, len * 0.22), paint);
  hood.position.set(0, 0.88, half - len * 0.11);
  hood.castShadow = true;
  group.add(hood);
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.92, 0.14, len * 0.18), paint);
  trunk.position.set(0, 0.87, -half + len * 0.09);
  group.add(trunk);

  // Cabin: slanted windscreen, roof, slanted rear glass.
  const roof = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.84, 0.1, len * 0.26), paint);
  roof.position.set(0, 1.32, -0.1);
  roof.castShadow = true;
  group.add(roof);
  const screen = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.8, 0.08, 0.75), glassMat);
  screen.position.set(0, 1.16, half - len * 0.26);
  screen.rotation.x = 0.55;
  group.add(screen);
  const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.8, 0.08, 0.6), glassMat);
  rearGlass.position.set(0, 1.14, -half + len * 0.26);
  rearGlass.rotation.x = -0.5;
  group.add(rearGlass);
  const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.86, 0.34, len * 0.2), glassMat);
  sideGlass.position.set(0, 1.08, -0.1);
  group.add(sideGlass);

  // Grille + bumpers.
  const grille = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.6, 0.16, 0.08), darkTrim);
  grille.position.set(0, 0.6, half + 0.02);
  group.add(grille);
  for (const z of [half, -half]) {
    const bumper = new THREE.Mesh(new THREE.BoxGeometry(wid, 0.18, 0.24), darkTrim);
    bumper.position.set(0, 0.32, z);
    group.add(bumper);
  }

  // Headlights that glow at dusk, red tail lights at the back.
  const beamMat = new THREE.MeshLambertMaterial({
    color: 0xfff2b0,
    emissive: 0xffe9a0,
    emissiveIntensity: 1.1,
  });
  const tailMat = new THREE.MeshLambertMaterial({
    color: 0xcc2222,
    emissive: 0xff2222,
    emissiveIntensity: 0.9,
  });
  for (const side of [-1, 1]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.15, 0.07), beamMat);
    lamp.position.set(side * (wid / 2 - 0.32), 0.64, half + 0.02);
    group.add(lamp);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.13, 0.07), tailMat);
    tail.position.set(side * (wid / 2 - 0.32), 0.64, -half - 0.02);
    group.add(tail);
    // Wing mirrors.
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.22), darkTrim);
    mirror.position.set(side * (wid / 2 + 0.06), 1.05, half - len * 0.3);
    group.add(mirror);
    // Twin exhaust tips.
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.22, 8), darkTrim);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(side * 0.5, 0.3, -half - 0.06);
    group.add(pipe);
  }

  // Spoiler on sporty cars only.
  if (sporty) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.9, 0.07, 0.5), darkTrim);
    wing.position.set(0, 1.12, -half + 0.2);
    wing.castShadow = true;
    group.add(wing);
    for (const side of [-1, 1]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.24, 0.1), darkTrim);
      strut.position.set(side * (wid * 0.36), 0.98, -half + 0.2);
      group.add(strut);
    }
  }

  // Rear plate.
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(0.62, 0.16),
    new THREE.MeshBasicMaterial({ map: PLATE_TEX }),
  );
  plate.position.set(0, 0.52, -half - 0.14);
  plate.rotation.y = Math.PI;
  group.add(plate);

  // Wheels with pale hubcaps.
  const hubMat = new THREE.MeshLambertMaterial({ color: 0xc8ccd2 });
  const wheels = [];
  for (const [wx, wz] of [
    [-wid / 2, half - 0.75],
    [wid / 2, half - 0.75],
    [-wid / 2, -half + 0.75],
    [wid / 2, -half + 0.75],
  ]) {
    const wheel = new THREE.Mesh(TYRE_GEO, TYRE_MAT);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.36, wz);
    wheel.castShadow = true;
    group.add(wheel);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.28, 10), hubMat);
    hub.rotation.z = Math.PI / 2;
    hub.position.set(wx, 0.36, wz);
    group.add(hub);
    wheels.push(wheel);
  }

  return { group, wheels, length: len, width: wid };
}

/** A drivable car: position, heading, speed, steering, simple collisions. */
export function createCar(scene, opts) {
  const { group, wheels, length, width } = buildCarMesh(opts.color, opts.sporty);
  group.position.set(opts.x, 0, opts.z);
  group.rotation.y = opts.heading || 0;
  scene.add(group);

  const state = {
    x: opts.x,
    z: opts.z,
    heading: opts.heading || 0,
    speed: 0,
    steer: 0,
    sporty: !!opts.sporty,
    topSpeed: opts.sporty ? CAR.maxSpeed * 1.25 : CAR.maxSpeed,
    parked: opts.parked !== false,
    id: opts.id || ('car-' + Math.random().toString(36).slice(2, 7)),
    isPolice: !!opts.isPolice,
  };

  return {
    group,
    state,
    get length() {
      return length;
    },
    get width() {
      return width;
    },
    /** Arcade drive step. Returns true if it hit a building (for a thud). */
    drive(dt, input, colliders) {
      const axes = input.moveAxes();
      const wantSteer = axes.strafe * 0.55;
      state.steer += (wantSteer - state.steer) * Math.min(1, dt * 8);
      if (axes.forward > 0) state.speed += CAR.accel * dt * (state.sporty ? 1.25 : 1);
      if (axes.forward < 0) {
        if (state.speed > 0.5) state.speed -= CAR.brake * dt;
        else state.speed -= CAR.reverseAccel * dt;
      }
      if (input.braking()) state.speed -= Math.sign(state.speed) * CAR.brake * dt;
      if (axes.forward === 0 && !input.braking()) {
        state.speed -= Math.sign(state.speed) * CAR.drag * 6 * dt;
        if (Math.abs(state.speed) < 0.3) state.speed = 0;
      }
      state.speed = clamp(state.speed, -CAR.maxReverse, state.topSpeed);
      // Forward is (sin h, cos h); D (positive steer) swings the nose +X.
      state.heading += (state.speed / 2.6) * state.steer * dt;
      const nx = state.x + Math.sin(state.heading) * state.speed * dt;
      const nz = state.z + Math.cos(state.heading) * state.speed * dt;
      const clamped = clampToCity(nx, nz);
      let hit = false;
      const r = 1.4;
      const blocked = colliders.some(
        (c) => clamped.x + r > c.minX && clamped.x - r < c.maxX && clamped.z + r > c.minZ && clamped.z - r < c.maxZ,
      );
      if (!blocked) {
        state.x = clamped.x;
        state.z = clamped.z;
      } else {
        state.speed *= -0.25; // bounce off the wall
        hit = true;
      }
      group.position.set(state.x, 0, state.z);
      group.rotation.y = state.heading;
      // Spin the wheels and lean the body a touch into turns.
      for (const wheel of wheels) wheel.rotation.x += state.speed * dt * 2.4;
      group.rotation.z = -state.steer * state.speed * 0.002;
      return hit;
    },
    /** Teleport / set position directly (used by police spawning and shots). */
    place(x, z, heading) {
      state.x = x;
      state.z = z;
      state.heading = heading;
      state.speed = 0;
      group.position.set(x, 0, z);
      group.rotation.y = heading;
    },
    /** Simple kinematic move for AI cars (no input). */
    moveTo(x, z, heading, speed) {
      state.x = x;
      state.z = z;
      state.heading = heading;
      state.speed = speed;
      group.position.set(x, 0, z);
      group.rotation.y = heading;
      for (const wheel of wheels) wheel.rotation.x += speed * 0.016 * 2.4;
    },
    dispose() {
      scene.remove(group);
    },
  };
}

/** Parked cars scattered near roads for the player to steal. */
export function spawnParkedCars(scene, rng, spots) {
  const cars = [];
  for (let i = 0; i < spots.length; i++) {
    const spot = spots[i];
    const car = createCar(scene, {
      x: spot.x,
      z: spot.z,
      heading: spot.heading,
      color: PAINTS[i % PAINTS.length],
      sporty: false,
      parked: true,
      id: 'parked-' + i,
    });
    cars.push(car);
  }
  return cars;
}
