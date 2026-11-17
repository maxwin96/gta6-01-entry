// Traffic: AI cars that cruise the road grid and pedestrians that stroll
// the sidewalks. Both are deliberately simple — follow a road line, turn at
// intersections, keep a little distance from the car ahead — so the city
// feels alive without a full traffic simulation.

import * as THREE from 'three';
import { ROAD_LINES } from './world.js';
import { createCar } from './vehicles.js';
import { clamp, flatDistance } from './utils.js';

const TRAFFIC_COLORS = [0xd94f3d, 0x3d7bd9, 0xe8c33a, 0x4fae5f, 0xe8e4da, 0x2b2f36];

function randomRoadPoint(rng) {
  const line = ROAD_LINES[Math.floor(rng() * ROAD_LINES.length)];
  const along = (rng() * 2 - 1) * 190;
  const vertical = rng() < 0.5;
  const lane = rng() < 0.5 ? -3.2 : 3.2; // right-hand side of the road
  return {
    x: vertical ? line + lane : along,
    z: vertical ? along : line + lane,
    vertical,
    line,
    lane,
  };
}

export function createTraffic(scene, rng, count) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const start = randomRoadPoint(rng);
    const car = createCar(scene, {
      x: start.x,
      z: start.z,
      heading: start.vertical ? (rng() < 0.5 ? 0 : Math.PI) : rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2,
      color: TRAFFIC_COLORS[i % TRAFFIC_COLORS.length],
      parked: false,
      id: 'traffic-' + i,
    });
    cars.push({
      car,
      vertical: start.vertical,
      // The road centre line this car follows (lane offset added on top).
      line: start.line,
      direction: rng() < 0.5 ? 1 : -1,
      speed: 7 + rng() * 4,
      // Offset from the road centre so cars drive on the right side.
      lane: start.lane,
    });
  }

  function update(dt, playerCar) {
    for (const t of cars) {
      // Slow down if something is right in front (another car or the player).
      let targetSpeed = t.speed;
      const aheadX = t.car.state.x + Math.sin(t.car.state.heading) * 7;
      const aheadZ = t.car.state.z + Math.cos(t.car.state.heading) * 7;
      for (const other of cars) {
        if (other === t) continue;
        if (flatDistance({ x: aheadX, z: aheadZ }, other.car.state) < 5) targetSpeed = 0;
      }
      if (playerCar) {
        if (flatDistance({ x: aheadX, z: aheadZ }, playerCar.state) < 6) targetSpeed = 0;
      }
      const speed = targetSpeed === 0 ? 0 : t.speed;

      // Cruise along the current road; at the city edge, pick a new road.
      const s = t.car.state;
      const next = t.vertical
        ? { x: t.line + t.lane, z: s.z + t.direction * speed * dt }
        : { x: s.x + t.direction * speed * dt, z: t.line + t.lane };
      const heading = t.vertical ? (t.direction > 0 ? 0 : Math.PI) : t.direction > 0 ? Math.PI / 2 : -Math.PI / 2;
      let nx = next.x;
      let nz = next.z;
      if (Math.abs(nx) > 200 || Math.abs(nz) > 200) {
        // Turn onto a crossing road at the next intersection instead of
        // driving off the map: snap to a fresh random road point.
        const fresh = randomRoadPoint(rng);
        nx = fresh.x;
        nz = fresh.z;
        t.vertical = fresh.vertical;
        t.line = fresh.line;
        t.direction = rng() < 0.5 ? 1 : -1;
        t.lane = fresh.lane;
      }
      t.car.moveTo(nx, nz, heading, speed);
    }
  }

  return {
    cars: cars.map((t) => t.car),
    update,
    /** Put one traffic car on a chosen road (used to stage screenshots). */
    stageCar(index, line, along, vertical, direction) {
      const t = cars[index];
      if (!t) return;
      t.line = line;
      t.vertical = vertical;
      t.direction = direction;
      // Right-hand side: southbound cars use the west lane, northbound the east.
      t.lane = vertical ? (direction > 0 ? -3.2 : 3.2) : direction > 0 ? 3.2 : -3.2;
      const x = vertical ? line + t.lane : along;
      const z = vertical ? along : line + t.lane;
      const heading = vertical ? (direction > 0 ? 0 : Math.PI) : direction > 0 ? Math.PI / 2 : -Math.PI / 2;
      t.car.place(x, z, heading);
    },
  };
}

// ---------------------------------------------------------------------------
// Pedestrians: low-poly walkers on the sidewalks, wandering block to block.
// ---------------------------------------------------------------------------

const SHIRT_COLORS = [0xd94f3d, 0x3d7bd9, 0xe8c33a, 0x4fae5f, 0xe8e4da, 0xd97a2b, 0x8a5fc0];

function makePedestrian(color) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color });
  const skin = new THREE.MeshLambertMaterial({ color: 0xe8b98a });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2e3a4a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.8, 0.32), shirt);
  body.position.y = 1.0;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), skin);
  head.position.y = 1.6;
  group.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.24), pants);
  legL.position.set(-0.14, 0.3, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.14;
  group.add(legR);
  return { group, legL, legR };
}

export function createPedestrians(scene, rng, count) {
  const walkers = [];
  for (let i = 0; i < count; i++) {
    const { group, legL, legR } = makePedestrian(SHIRT_COLORS[i % SHIRT_COLORS.length]);
    scene.add(group);
    const start = randomSidewalkPoint(rng);
    walkers.push({
      group,
      legL,
      legR,
      x: start.x,
      z: start.z,
      heading: rng() * Math.PI * 2,
      speed: 1.2 + rng() * 1.1,
      phase: rng() * 10,
      // Peds hit by a car fall over and stay down briefly, then get up.
      down: 0,
    });
  }

  function randomSidewalkPoint(rng2) {
    // Sidewalks run just outside the asphalt: pick a road line, offset 9 m.
    const line = ROAD_LINES[Math.floor(rng2() * ROAD_LINES.length)];
    const along = (rng2() * 2 - 1) * 195;
    const vertical = rng2() < 0.5;
    const side = rng2() < 0.5 ? -1 : 1;
    return {
      x: vertical ? line + side * 9.5 : along,
      z: vertical ? along : line + side * 9.5,
    };
  }

  function update(dt) {
    for (const w of walkers) {
      if (w.down > 0) {
        w.down -= dt;
        w.group.rotation.x = w.down > 0 ? -Math.PI / 2 : 0;
        if (w.down <= 0) w.group.rotation.x = 0;
        continue;
      }
      // Occasionally pick a new direction; mostly keep walking straight.
      if (rng() < dt * 0.05) w.heading = rng() * Math.PI * 2;
      w.x += Math.sin(w.heading) * w.speed * dt;
      w.z += Math.cos(w.heading) * w.speed * dt;
      // Bounce back inside the city instead of walking into the ocean.
      if (Math.abs(w.x) > 205 || Math.abs(w.z) > 205 || w.z > 225) {
        w.heading += Math.PI;
        w.x = clamp(w.x, -205, 205);
        w.z = clamp(w.z, -205, 225);
      }
      w.phase += dt * w.speed * 4;
      w.group.position.set(w.x, 0, w.z);
      w.group.rotation.y = w.heading;
      w.legL.rotation.x = Math.sin(w.phase) * 0.5;
      w.legR.rotation.x = -Math.sin(w.phase) * 0.5;
    }
  }

  return {
    walkers,
    update,
    /** Knock a pedestrian down; returns true if one was hit. */
    hitAt(x, z, radius) {
      for (const w of walkers) {
        if (w.down <= 0 && flatDistance({ x, z }, w) < radius) {
          w.down = 4;
          return true;
        }
      }
      return false;
    },
  };
}
