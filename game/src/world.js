// Sunset Bay — the city. A sun-soaked grid town on a beach: asphalt roads,
// pastel towers, palm-lined sidewalks, a pier, a central plaza and the ocean
// to the south. Everything is built from boxes, cylinders and one procedural
// window texture, so the whole city is offline and deterministic per seed.

import * as THREE from 'three';
import { CITY } from './config.js';
import { createRng, pick } from './utils.js';

const PITCH = CITY.block + CITY.road; // 56 m from one block centre to the next
const HALF_BLOCKS = (CITY.blocks - 1) / 2; // 3
const CITY_EDGE = HALF_BLOCKS * PITCH + CITY.block / 2 + CITY.road / 2; // 203

// Road centre lines (both axes share the same coordinates).
export const ROAD_LINES = [-196, -140, -84, -28, 28, 84, 140, 196];

// Warm pastel palette for the buildings — bright, coastal, original.
const PALETTES = [0xf2e3c6, 0xe8b4a0, 0xf6d98a, 0x9fc8c0, 0xd98a7a, 0xc9d6a3, 0xe6c9d8, 0xa8c6e8];

function makeWindowTexture(baseColor, litRatio, rng) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 128, 256);
  // Window grid: 4 columns x 10 rows, some lit warm yellow, some dark glass.
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 4; col++) {
      const lit = rng() < litRatio;
      ctx.fillStyle = lit ? '#ffe9a8' : '#2e4a5a';
      ctx.fillRect(10 + col * 30, 12 + row * 24, 18, 14);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makePalm(height) {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6b4a });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.24, height, 6), trunkMat);
  trunk.position.y = height / 2;
  trunk.rotation.z = 0.06;
  group.add(trunk);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f8f4f });
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.6, 4), leafMat);
    const angle = (i / 6) * Math.PI * 2;
    leaf.position.set(Math.cos(angle) * 0.9, height + 0.2, Math.sin(angle) * 0.9);
    leaf.rotation.z = Math.cos(angle) * 1.15;
    leaf.rotation.x = -Math.sin(angle) * 1.15;
    leaf.scale.set(1, 1, 0.35);
    group.add(leaf);
  }
  const nuts = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 8, 6),
    new THREE.MeshLambertMaterial({ color: 0x6b4a2a }),
  );
  nuts.position.y = height - 0.1;
  group.add(nuts);
  return group;
}

function makeLamp() {
  const group = new THREE.Group();
  const dark = new THREE.MeshLambertMaterial({ color: 0x2b2f36 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 5.2, 6), dark);
  pole.position.y = 2.6;
  group.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.1), dark);
  arm.position.set(0.7, 5.1, 0);
  group.add(arm);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0xffdf80, emissiveIntensity: 0.7 }),
  );
  head.position.set(1.4, 5.0, 0);
  group.add(head);
  return group;
}

export function createWorld(scene, seed) {
  const rng = createRng(seed);
  const colliders = []; // { minX, maxX, minZ, maxZ } building footprints
  const palms = [];

  // --- Sky, sun, fog -------------------------------------------------------
  scene.background = new THREE.Color(0x87c5e8);
  scene.fog = new THREE.Fog(0x9fd0e8, 220, 620);
  const sun = new THREE.DirectionalLight(0xfff2d0, 2.4);
  sun.position.set(120, 180, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -240;
  sun.shadow.camera.right = 240;
  sun.shadow.camera.top = 240;
  sun.shadow.camera.bottom = -240;
  sun.shadow.camera.far = 600;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfe3ff, 0x8a7a5a, 1.1));

  // --- Ground: grass base, beach sand to the south, ocean beyond ------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.MeshLambertMaterial({ color: 0x7fae62 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = -60;
  ground.receiveShadow = true;
  scene.add(ground);

  const beach = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_EDGE * 2 + 60, CITY.beachWidth + 30),
    new THREE.MeshLambertMaterial({ color: 0xe8d29a }),
  );
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(0, 0.02, CITY_EDGE + CITY.beachWidth / 2 + 4);
  beach.receiveShadow = true;
  scene.add(beach);

  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(1200, 500),
    new THREE.MeshLambertMaterial({ color: 0x2f7fb8 }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, 0.01, CITY_EDGE + CITY.beachWidth + 260);
  scene.add(ocean);

  // --- Roads: pale sidewalk bed, asphalt on top, dashed centre line --------
  const sidewalkMat = new THREE.MeshLambertMaterial({ color: 0xcfc8b8 });
  const asphaltMat = new THREE.MeshLambertMaterial({ color: 0x3a3f46 });
  const dashMat = new THREE.MeshLambertMaterial({ color: 0xf5e9c8 });
  const roadLength = CITY_EDGE * 2 + CITY.road;
  // PlaneGeometry(w, h) laid flat with rotation.x = -PI/2 spans w along X
  // and h along Z, so a north-south road is (road wide, roadLength long).
  for (const line of ROAD_LINES) {
    for (const vertical of [true, false]) {
      const bed = new THREE.Mesh(
        new THREE.PlaneGeometry(vertical ? CITY.road + 6 : roadLength, vertical ? roadLength : CITY.road + 6),
        sidewalkMat,
      );
      bed.rotation.x = -Math.PI / 2;
      bed.position.set(vertical ? line : 0, 0.03, vertical ? 0 : line);
      bed.receiveShadow = true;
      scene.add(bed);
      const strip = new THREE.Mesh(
        new THREE.PlaneGeometry(vertical ? CITY.road : roadLength, vertical ? roadLength : CITY.road),
        asphaltMat,
      );
      strip.rotation.x = -Math.PI / 2;
      strip.position.set(vertical ? line : 0, 0.05, vertical ? 0 : line);
      strip.receiveShadow = true;
      scene.add(strip);
      // Centre dashes every 8 m.
      for (let d = -CITY_EDGE; d < CITY_EDGE; d += 8) {
        const dash = new THREE.Mesh(
          new THREE.PlaneGeometry(vertical ? 0.5 : 3, vertical ? 3 : 0.5),
          dashMat,
        );
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(vertical ? line : d, 0.07, vertical ? d : line);
        scene.add(dash);
      }
    }
  }

  // --- Buildings ------------------------------------------------------------
  const textures = PALETTES.map((color) =>
    makeWindowTexture('#' + color.toString(16).padStart(6, '0'), 0.35, rng),
  );
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x5a5f66 });

  // The centre block is the plaza — no buildings there.
  for (let bx = -HALF_BLOCKS; bx <= HALF_BLOCKS; bx++) {
    for (let bz = -HALF_BLOCKS; bz <= HALF_BLOCKS; bz++) {
      if (bx === 0 && bz === 0) continue; // plaza
      // The block at the south-west corner holds the garage instead.
      if (bx === -3 && bz === 3) continue;
      const centreX = bx * PITCH;
      const centreZ = bz * PITCH;
      const distCentre = Math.abs(bx) + Math.abs(bz);
      const count = rng() < 0.45 ? 1 : 2;
      for (let n = 0; n < count; n++) {
        const w = 14 + rng() * 14;
        const d = 14 + rng() * 14;
        const h = 9 + rng() * rng() * (distCentre <= 2 ? 34 : 16);
        const offX = count === 1 ? 0 : (n === 0 ? -1 : 1) * (CITY.block / 4 - 1);
        const offZ = count === 1 ? 0 : (n === 0 ? -1 : 1) * (CITY.block / 4 - 1) * -1;
        const x = centreX + offX;
        const z = centreZ + offZ;
        const mat = new THREE.MeshLambertMaterial({ map: pick(rng, textures) });
        const building = new THREE.Mesh(boxGeo, mat);
        building.scale.set(w, h, d);
        building.position.set(x, h / 2, z);
        building.castShadow = true;
        building.receiveShadow = true;
        scene.add(building);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.5, d + 0.6), roofMat);
        roof.position.set(x, h + 0.25, z);
        scene.add(roof);
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
      }
    }
  }

  // --- Central plaza: fountain + palms --------------------------------------
  const plaza = new THREE.Mesh(
    new THREE.CylinderGeometry(7, 8, 1.2, 24),
    new THREE.MeshLambertMaterial({ color: 0x9fc8e8 }),
  );
  plaza.position.set(0, 0.6, 0);
  plaza.castShadow = true;
  scene.add(plaza);
  const fountainTop = new THREE.Mesh(
    new THREE.CylinderGeometry(5.4, 5.4, 0.4, 24),
    new THREE.MeshLambertMaterial({ color: 0x6fb3dd }),
  );
  fountainTop.position.set(0, 1.3, 0);
  scene.add(fountainTop);
  colliders.push({ minX: -8, maxX: 8, minZ: -8, maxZ: 8 });
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const palm = makePalm(5 + rng() * 2);
    palm.position.set(Math.cos(angle) * 15, 0, Math.sin(angle) * 15);
    scene.add(palm);
    palms.push(palm);
  }

  // --- Garage (mission 2 destination) on the south-west block ---------------
  const garage = new THREE.Group();
  const garageBody = new THREE.Mesh(
    new THREE.BoxGeometry(26, 9, 18),
    new THREE.MeshLambertMaterial({ color: 0xb0483a }),
  );
  garageBody.position.y = 4.5;
  garageBody.castShadow = true;
  garage.add(garageBody);
  const garageDoor = new THREE.Mesh(
    new THREE.BoxGeometry(14, 6.5, 0.4),
    new THREE.MeshLambertMaterial({ color: 0x3a3f46 }),
  );
  garageDoor.position.set(0, 3.25, 9.1);
  garage.add(garageDoor);
  garage.position.set(-3 * PITCH, 0, 3 * PITCH);
  scene.add(garage);
  colliders.push({
    minX: -3 * PITCH - 13,
    maxX: -3 * PITCH + 13,
    minZ: 3 * PITCH - 9,
    maxZ: 3 * PITCH + 9,
  });

  // --- Pier (mission 1 start) jutting into the ocean -------------------------
  const pier = new THREE.Group();
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6b4a });
  for (let i = 0; i < 10; i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(8, 0.4, 4.4), pierMat);
    plank.position.set(0, 0.8, i * 4.6);
    plank.castShadow = true;
    pier.add(plank);
  }
  const pierPost = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 2.4, 8),
    new THREE.MeshLambertMaterial({ color: 0x6b4a2a }),
  );
  pierPost.position.set(3.4, 1.2, 42);
  pier.add(pierPost);
  pier.position.set(84, 0, CITY_EDGE + CITY.beachWidth + 2);
  scene.add(pier);

  // --- Street lamps at every intersection ------------------------------------
  for (const lx of ROAD_LINES) {
    for (const lz of ROAD_LINES) {
      const lamp = makeLamp();
      lamp.position.set(lx + CITY.road / 2 + 2.5, 0, lz + CITY.road / 2 + 2.5);
      lamp.rotation.y = rng() * Math.PI * 2;
      scene.add(lamp);
    }
  }

  // --- Palm rows along the beach ---------------------------------------------
  for (let x = -CITY_EDGE; x <= CITY_EDGE; x += 18) {
    if (Math.abs(x - 84) < 10) continue; // keep the pier clear
    const palm = makePalm(5.5 + rng() * 2.5);
    palm.position.set(x + rng() * 4, 0, CITY_EDGE + 8 + rng() * 6);
    scene.add(palm);
    palms.push(palm);
  }

  // --- Drifting clouds ---------------------------------------------------------
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const clouds = [];
  for (let i = 0; i < 10; i++) {
    const cloud = new THREE.Group();
    for (let j = 0; j < 4; j++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(6 + rng() * 6, 10, 8), cloudMat);
      puff.position.set(j * 8 - 12 + rng() * 4, rng() * 2, rng() * 6 - 3);
      puff.scale.y = 0.45;
      cloud.add(puff);
    }
    cloud.position.set(rng() * 500 - 250, 90 + rng() * 40, rng() * 400 - 260);
    scene.add(cloud);
    clouds.push(cloud);
  }

  // Named places the missions and spawns use.
  const places = {
    pier: { x: 84, z: CITY_EDGE + CITY.beachWidth + 14 },
    hotel: { x: 140, z: 196 }, // south-east corner, on Ocean Drive
    plaza: { x: 0, z: 0 },
    garage: { x: -3 * PITCH, z: 3 * PITCH - 14 },
    sportsCar: { x: 14, z: -14 }, // parked by the plaza, north-east side
    spawn: { x: -28, z: 28 },
  };

  return {
    colliders,
    places,
    cityEdge: CITY_EDGE,
    update(dt) {
      for (const cloud of clouds) {
        cloud.position.x += dt * 1.5;
        if (cloud.position.x > 300) cloud.position.x = -300;
      }
      // Gentle palm sway.
      const t = performance.now() / 1000;
      for (let i = 0; i < palms.length; i++) {
        palms[i].rotation.z = Math.sin(t * 0.8 + i) * 0.02;
      }
    },
  };
}

/** True when (x, z) is on asphalt (within a road strip). */
export function isOnRoad(x, z) {
  const onLine = (v) => ROAD_LINES.some((line) => Math.abs(v - line) <= CITY.road / 2);
  return onLine(x) || onLine(z);
}

/** Clamp a point into the walkable city bounds (streets + beach). */
export function clampToCity(x, z) {
  const edge = CITY_EDGE + CITY.beachWidth - 2;
  return {
    x: Math.max(-CITY_EDGE - 4, Math.min(CITY_EDGE + 4, x)),
    z: Math.max(-CITY_EDGE - 4, Math.min(edge, z)),
  };
}
