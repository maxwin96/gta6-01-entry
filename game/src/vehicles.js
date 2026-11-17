// Cars: a box-body + cabin + wheels factory, arcade driving physics,
// and a small pool of parked cars the player can steal. Police cars are
// built by police.js from the same factory with a paint job.

import * as THREE from 'three';
import { CAR } from './config.js';
import { angleDelta, clamp } from './utils.js';
import { clampToCity } from './world.js';

const BODY_COLORS = [0xd94f3d, 0x3d7bd9, 0xe8c33a, 0x4fae5f, 0xe8e4da, 0x8a5fc0, 0x2b2f36, 0xd97a2b];
const WHEEL_GEO = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 12);
const WHEEL_MAT = new THREE.MeshLambertMaterial({ color: 0x1a1c20 });

export function buildCarMesh(color, sporty) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x1e2f3f });
  const length = sporty ? 4.6 : 4.2;
  const width = sporty ? 1.9 : 1.85;

  const body = new THREE.Mesh(new THREE.BoxGeometry(width, 0.62, length), paint);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(width * 0.86, 0.55, length * 0.46), glass);
  cabin.position.set(0, 1.1, sporty ? -0.25 : -0.15);
  cabin.castShadow = true;
  group.add(cabin);

  const bumperMat = new THREE.MeshLambertMaterial({ color: 0x22252a });
  const bumperF = new THREE.Mesh(new THREE.BoxGeometry(width, 0.18, 0.25), bumperMat);
  bumperF.position.set(0, 0.32, length / 2);
  group.add(bumperF);
  const bumperB = bumperF.clone();
  bumperB.position.z = -length / 2;
  group.add(bumperB);

  // Headlights.
  const lightMat = new THREE.MeshLambertMaterial({
    color: 0xfff2b0,
    emissive: 0xffe9a0,
    emissiveIntensity: 0.5,
  });
  for (const side of [-1, 1]) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.06), lightMat);
    light.position.set(side * (width / 2 - 0.3), 0.62, length / 2 + 0.01);
    group.add(light);
  }

  const wheels = [];
  for (const [wx, wz] of [
    [-width / 2, length / 2 - 0.75],
    [width / 2, length / 2 - 0.75],
    [-width / 2, -length / 2 + 0.75],
    [width / 2, -length / 2 + 0.75],
  ]) {
    const wheel = new THREE.Mesh(WHEEL_GEO, WHEEL_MAT);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.36, wz);
    wheel.castShadow = true;
    group.add(wheel);
    wheels.push(wheel);
  }

  return { group, wheels, length, width };
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
      const targetSteer = axes.strafe * 0.55;
      state.steer += (targetSteer - state.steer) * Math.min(1, dt * 8);
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
      // Forward is (sin h, cos h); pressing D (positive steer) must swing
      // the nose toward +X, i.e. increase the heading.
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
      color: BODY_COLORS[i % BODY_COLORS.length],
      sporty: false,
      parked: true,
      id: 'parked-' + i,
    });
    cars.push(car);
  }
  return cars;
}
