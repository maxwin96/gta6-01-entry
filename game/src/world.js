// Sunset Bay — the city at golden hour. A road grid of pastel towers
// (taller downtown, windows glowing warm), rooftop clutter, neon signs
// naming the real places of the town, the Ocean Hotel with its pool deck,
// a shack at the end of the pier, beach umbrellas, and a glittering sea.
// All geometry is boxes, cylinders and canvas textures: fully offline
// and the same for a given seed.

import * as THREE from 'three';
import { CITY } from './config.js';
import { createRng, pick } from './utils.js';

const PITCH = CITY.block + CITY.road; // 56 m between block centres
const HALF = (CITY.blocks - 1) / 2; // 3
const EDGE = HALF * PITCH + CITY.block / 2 + CITY.road / 2; // 203

// Road centre lines (the same set on both axes).
export const ROAD_LINES = [-196, -140, -84, -28, 28, 84, 140, 196];

// Warm coastal paint for the towers.
const PAINTS = [0xf2e3c6, 0xe8b4a0, 0xf6d98a, 0x9fc8c0, 0xd98a7a, 0xc9d6a3, 0xe6c9d8, 0xa8c6e8];

// Facade texture (paint + window grid) plus a matching glow map that is
// black except for the lit windows, so only those windows shine at dusk.
function facadePair(base, litRatio, rng) {
  const face = document.createElement('canvas');
  face.width = 128;
  face.height = 256;
  const glow = document.createElement('canvas');
  glow.width = 128;
  glow.height = 256;
  const f = face.getContext('2d');
  const g = glow.getContext('2d');
  f.fillStyle = base;
  f.fillRect(0, 0, 128, 256);
  g.fillStyle = '#000000';
  g.fillRect(0, 0, 128, 256);
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 4; col++) {
      const lit = rng() < litRatio;
      f.fillStyle = lit ? '#ffe9a8' : '#2e4a5a';
      f.fillRect(10 + col * 30, 12 + row * 24, 18, 14);
      if (lit) {
        g.fillStyle = '#ffdf80';
        g.fillRect(10 + col * 30, 12 + row * 24, 18, 14);
      }
    }
  }
  const faceTex = new THREE.CanvasTexture(face);
  faceTex.colorSpace = THREE.SRGBColorSpace;
  const glowTex = new THREE.CanvasTexture(glow);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return { faceTex, glowTex };
}

// A glowing shop sign: bright text on a dark plate, readable at dusk.
function neonSign(text, colour, w = 12, h = 2.4) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = '#140a1e';
  g.fillRect(0, 0, 512, 96);
  g.strokeStyle = colour;
  g.lineWidth = 4;
  g.strokeRect(4, 4, 504, 88);
  g.font = 'bold 52px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = colour;
  g.shadowBlur = 22;
  g.fillStyle = colour;
  g.fillText(text, 256, 52);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex, transparent: false }),
  );
  return mesh;
}

function makePalm(height) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.24, height, 6),
    new THREE.MeshLambertMaterial({ color: 0x8a6b4a }),
  );
  trunk.position.y = height / 2;
  trunk.rotation.z = 0.06;
  group.add(trunk);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f8f4f });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.6, 4), leafMat);
    leaf.position.set(Math.cos(a) * 0.9, height + 0.2, Math.sin(a) * 0.9);
    leaf.rotation.z = Math.cos(a) * 1.15;
    leaf.rotation.x = -Math.sin(a) * 1.15;
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
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0xffdf80, emissiveIntensity: 0.9 }),
  );
  bulb.position.set(1.4, 5.0, 0);
  group.add(bulb);
  return group;
}

// Rooftop clutter: an AC box, a water tower on legs, a blinking antenna.
function rooftopProps(scene, x, topY, w, d, rng) {
  const grey = new THREE.MeshLambertMaterial({ color: 0x6a6f76 });
  const ac = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 1.6), grey);
  ac.position.set(x - w / 4, topY + 0.55, -d / 5);
  scene.add(ac);
  if (rng() < 0.6) {
    const tower = new THREE.Group();
    const tank = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 1.4, 2.4, 10),
      new THREE.MeshLambertMaterial({ color: 0x7a5a3a }),
    );
    tank.position.y = 3.4;
    tower.add(tank);
    const cap = new THREE.Mesh(
      new THREE.ConeGeometry(1.6, 1.1, 10),
      new THREE.MeshLambertMaterial({ color: 0x5a4030 }),
    );
    cap.position.y = 5.1;
    tower.add(cap);
    for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.4, 6), grey);
      leg.position.set(lx, 1.2, lz);
      tower.add(leg);
    }
    tower.position.set(x + w / 4, topY, d / 4);
    scene.add(tower);
  }
  if (rng() < 0.5) {
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.1, 5, 6),
      new THREE.MeshLambertMaterial({ color: 0x3a3f46 }),
    );
    mast.position.set(x + w / 3, topY + 2.5, -d / 3);
    scene.add(mast);
    const tip = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xff4444 }),
    );
    tip.position.set(x + w / 3, topY + 5.1, -d / 3);
    scene.add(tip);
  }
}

export function createWorld(scene, seed) {
  const rng = createRng(seed);
  const colliders = []; // building footprints { minX, maxX, minZ, maxZ }
  const palms = [];
  const glitter = []; // sun sparkles on the water, pulsed in update()

  // --- Ground: grass, beach sand, ocean ----------------------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.MeshLambertMaterial({ color: 0x7fae62 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = -60;
  ground.receiveShadow = true;
  scene.add(ground);

  const beach = new THREE.Mesh(
    new THREE.PlaneGeometry(EDGE * 2 + 60, CITY.beachWidth + 30),
    new THREE.MeshLambertMaterial({ color: 0xe8d29a }),
  );
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(0, 0.02, EDGE + CITY.beachWidth / 2 + 4);
  beach.receiveShadow = true;
  scene.add(beach);

  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(1200, 500),
    new THREE.MeshLambertMaterial({ color: 0x2a6ea8 }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, 0.01, EDGE + CITY.beachWidth + 260);
  scene.add(ocean);

  // Sun glitter: a lane of bright flecks on the water under the low sun.
  const glintMat = new THREE.MeshBasicMaterial({ color: 0xffe9b0, transparent: true, opacity: 0.7 });
  for (let i = 0; i < 46; i++) {
    const fleck = new THREE.Mesh(new THREE.PlaneGeometry(2 + rng() * 5, 0.7 + rng() * 1.2), glintMat.clone());
    fleck.rotation.x = -Math.PI / 2;
    fleck.position.set(-140 + rng() * 180, 0.04, EDGE + CITY.beachWidth + 30 + rng() * 220);
    fleck.rotation.z = rng() * Math.PI;
    scene.add(fleck);
    glitter.push(fleck);
  }

  // --- Roads -----------------------------------------------------------------
  const walkMat = new THREE.MeshLambertMaterial({ color: 0xcfc8b8 });
  const tarMat = new THREE.MeshLambertMaterial({ color: 0x3a3f46 });
  const dashMat = new THREE.MeshLambertMaterial({ color: 0xf5e9c8 });
  const roadLen = EDGE * 2 + CITY.road;
  for (const line of ROAD_LINES) {
    for (const vertical of [true, false]) {
      const bed = new THREE.Mesh(
        new THREE.PlaneGeometry(vertical ? CITY.road + 6 : roadLen, vertical ? roadLen : CITY.road + 6),
        walkMat,
      );
      bed.rotation.x = -Math.PI / 2;
      bed.position.set(vertical ? line : 0, 0.03, vertical ? 0 : line);
      bed.receiveShadow = true;
      scene.add(bed);
      const strip = new THREE.Mesh(
        new THREE.PlaneGeometry(vertical ? CITY.road : roadLen, vertical ? roadLen : CITY.road),
        tarMat,
      );
      strip.rotation.x = -Math.PI / 2;
      strip.position.set(vertical ? line : 0, 0.05, vertical ? 0 : line);
      strip.receiveShadow = true;
      scene.add(strip);
      for (let d = -EDGE; d < EDGE; d += 8) {
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

  // --- Buildings: taller downtown, lit windows, rooftop props ---------------
  const pairs = PAINTS.map((c) =>
    facadePair('#' + c.toString(16).padStart(6, '0'), 0.5, rng),
  );
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x5a5f66 });
  // Signs hung on the town's named spots, in order of the blocks below.
  const signPlan = [
    { text: 'TACO BAY', colour: '#ff9a3d' },
    { text: 'NEON MOTEL', colour: '#ff5ad0' },
    { text: 'BAY CINEMA', colour: '#7ad0ff' },
    { text: "MARISOL'S", colour: '#ffd23a' },
    { text: 'PIER 9', colour: '#7dff8a' },
  ];
  let signIdx = 0;
  let tallest = { h: 0, x: 0, z: 0, w: 0, d: 0 };

  for (let bx = -HALF; bx <= HALF; bx++) {
    for (let bz = -HALF; bz <= HALF; bz++) {
      if (bx === 0 && bz === 0) continue; // plaza
      if (bx === -3 && bz === 3) continue; // garage block
      if (bx === 2 && bz === 3) continue; // Ocean Hotel block
      const cx = bx * PITCH;
      const cz = bz * PITCH;
      const downtown = Math.abs(bx) + Math.abs(bz) <= 2;
      const count = rng() < 0.45 ? 1 : 2;
      for (let n = 0; n < count; n++) {
        const w = 14 + rng() * 14;
        const d = 14 + rng() * 14;
        const h = 9 + rng() * rng() * (downtown ? 52 : 18);
        const offX = count === 1 ? 0 : (n === 0 ? -1 : 1) * (CITY.block / 4 - 1);
        const offZ = count === 1 ? 0 : (n === 0 ? -1 : 1) * (CITY.block / 4 - 1) * -1;
        const x = cx + offX;
        const z = cz + offZ;
        const pair = pick(rng, pairs);
        const tower = new THREE.Mesh(
          boxGeo,
          new THREE.MeshLambertMaterial({
            map: pair.faceTex,
            emissive: 0xffffff,
            emissiveMap: pair.glowTex,
            emissiveIntensity: 0.55,
          }),
        );
        tower.scale.set(w, h, d);
        tower.position.set(x, h / 2, z);
        tower.castShadow = true;
        tower.receiveShadow = true;
        scene.add(tower);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.5, d + 0.6), roofMat);
        roof.position.set(x, h + 0.25, z);
        scene.add(roof);
        rooftopProps(scene, x, h + 0.5, w, d, rng);
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
        if (h > tallest.h) tallest = { h, x, z, w, d };
        // Hang a neon sign on the street-facing side of some towers.
        if (signIdx < signPlan.length && h > 16 && rng() < 0.55) {
          const s = signPlan[signIdx++];
          const sign = neonSign(s.text, s.colour, Math.min(13, w - 2), 2.2);
          sign.position.set(x, Math.min(h - 2, 14), z + d / 2 + 0.15);
          scene.add(sign);
        }
      }
    }
  }

  // The tallest tower carries the town's name in big letters.
  const bigSign = neonSign('SUNSET BAY', '#ffd23a', 20, 3.2);
  bigSign.position.set(tallest.x, tallest.h - 2.5, tallest.z + tallest.d / 2 + 0.2);
  scene.add(bigSign);

  // --- Central plaza: fountain + palms ---------------------------------------
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
    const a = (i / 8) * Math.PI * 2;
    const palm = makePalm(5 + rng() * 2);
    palm.position.set(Math.cos(a) * 15, 0, Math.sin(a) * 15);
    scene.add(palm);
    palms.push(palm);
  }

  // --- Ocean Hotel landmark (mission 1 destination) + pool deck --------------
  const hotel = new THREE.Group();
  const hotelBody = new THREE.Mesh(
    new THREE.BoxGeometry(30, 26, 18),
    new THREE.MeshLambertMaterial({ color: 0xf2e3c6, emissive: 0xffffff, emissiveMap: pairs[0].glowTex, emissiveIntensity: 0.4 }),
  );
  hotelBody.position.y = 13;
  hotelBody.castShadow = true;
  hotel.add(hotelBody);
  const hotelRoof = new THREE.Mesh(
    new THREE.BoxGeometry(31, 0.6, 19),
    new THREE.MeshLambertMaterial({ color: 0x2a6ea8 }),
  );
  hotelRoof.position.y = 26.3;
  hotel.add(hotelRoof);
  const hotelSign = neonSign('OCEAN HOTEL', '#7ad0ff', 16, 2.6);
  hotelSign.position.set(0, 22, 9.2);
  hotel.add(hotelSign);
  // Pool deck behind the hotel, turquoise water and a row of loungers.
  const pool = new THREE.Mesh(
    new THREE.BoxGeometry(12, 0.6, 6),
    new THREE.MeshLambertMaterial({ color: 0x3ec8e8, emissive: 0x1a7a9a, emissiveIntensity: 0.5 }),
  );
  pool.position.set(0, 0.4, -14);
  hotel.add(pool);
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(16, 0.3, 10),
    new THREE.MeshLambertMaterial({ color: 0xe8dcc0 }),
  );
  deck.position.set(0, 0.15, -14);
  hotel.add(deck);
  hotel.position.set(2 * PITCH + 28, 0, 3 * PITCH + 28);
  scene.add(hotel);
  colliders.push({
    minX: 2 * PITCH + 28 - 15, maxX: 2 * PITCH + 28 + 15,
    minZ: 3 * PITCH + 28 - 9, maxZ: 3 * PITCH + 28 + 9,
  });

  // --- Garage (mission 2 destination), south-west block ----------------------
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
  const garageSign = neonSign('SUNSET GARAGE', '#ff9a3d', 13, 2.2);
  garageSign.position.set(0, 7.6, 9.2);
  garage.add(garageSign);
  garage.position.set(-3 * PITCH, 0, 3 * PITCH);
  scene.add(garage);
  colliders.push({
    minX: -3 * PITCH - 13, maxX: -3 * PITCH + 13,
    minZ: 3 * PITCH - 9, maxZ: 3 * PITCH + 9,
  });

  // --- Pier jutting into the ocean, with a shack at the far end --------------
  const pier = new THREE.Group();
  const plankMat = new THREE.MeshLambertMaterial({ color: 0x8a6b4a });
  for (let i = 0; i < 10; i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(8, 0.4, 4.4), plankMat);
    plank.position.set(0, 0.8, i * 4.6);
    plank.castShadow = true;
    pier.add(plank);
  }
  const shack = new THREE.Group();
  const shackBody = new THREE.Mesh(
    new THREE.BoxGeometry(5, 3.2, 4),
    new THREE.MeshLambertMaterial({ color: 0xd98a7a }),
  );
  shackBody.position.y = 1.6;
  shackBody.castShadow = true;
  shack.add(shackBody);
  const shackRoof = new THREE.Mesh(
    new THREE.ConeGeometry(3.8, 1.6, 4),
    new THREE.MeshLambertMaterial({ color: 0x5a4030 }),
  );
  shackRoof.position.y = 4.0;
  shackRoof.rotation.y = Math.PI / 4;
  shack.add(shackRoof);
  const shackSign = neonSign('PIER 9', '#7dff8a', 4.4, 1.1);
  shackSign.position.set(0, 2.6, 2.1);
  shack.add(shackSign);
  shack.position.set(0, 0.8, 44);
  pier.add(shack);
  const pierPost = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 2.4, 8),
    new THREE.MeshLambertMaterial({ color: 0x6b4a2a }),
  );
  pierPost.position.set(3.4, 1.2, 42);
  pier.add(pierPost);
  pier.position.set(84, 0, EDGE + CITY.beachWidth + 2);
  scene.add(pier);

  // --- Beach umbrellas ---------------------------------------------------------
  const umbrellaCols = [0xff5a5a, 0xffd23a, 0x7ad0ff, 0xff5ad0];
  for (let i = 0; i < 8; i++) {
    const ux = -170 + i * 48 + rng() * 10;
    if (Math.abs(ux - 84) < 12) continue;
    const um = new THREE.Group();
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6),
      new THREE.MeshLambertMaterial({ color: 0xe8e4da }),
    );
    pole.position.y = 1.3;
    um.add(pole);
    const top = new THREE.Mesh(
      new THREE.ConeGeometry(2.1, 0.9, 8),
      new THREE.MeshLambertMaterial({ color: umbrellaCols[i % umbrellaCols.length] }),
    );
    top.position.y = 2.9;
    um.add(top);
    um.position.set(ux, 0, EDGE + 12 + rng() * 6);
    scene.add(um);
  }

  // --- Street lamps at every intersection + palm rows on the beach ------------
  for (const lx of ROAD_LINES) {
    for (const lz of ROAD_LINES) {
      const lamp = makeLamp();
      lamp.position.set(lx + CITY.road / 2 + 2.5, 0, lz + CITY.road / 2 + 2.5);
      lamp.rotation.y = rng() * Math.PI * 2;
      scene.add(lamp);
    }
  }
  for (let x = -EDGE; x <= EDGE; x += 18) {
    if (Math.abs(x - 84) < 10) continue; // keep the pier clear
    const palm = makePalm(5.5 + rng() * 2.5);
    palm.position.set(x + rng() * 4, 0, EDGE + 8 + rng() * 6);
    scene.add(palm);
    palms.push(palm);
  }

  // --- Drifting clouds ---------------------------------------------------------
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffd9c0 });
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
    pier: { x: 84, z: EDGE + CITY.beachWidth + 14 },
    hotel: { x: 140, z: 210 }, // hotel forecourt, just south of the Ocean Hotel on Ocean Drive
    plaza: { x: 0, z: 0 },
    garage: { x: -3 * PITCH, z: 3 * PITCH - 14 },
    sportsCar: { x: 14, z: -14 }, // parked by the plaza, north-east side
    spawn: { x: -28, z: 28 },
  };

  return {
    colliders,
    places,
    cityEdge: EDGE,
    update(dt) {
      for (const cloud of clouds) {
        cloud.position.x += dt * 1.5;
        if (cloud.position.x > 300) cloud.position.x = -300;
      }
      const t = performance.now() / 1000;
      for (let i = 0; i < palms.length; i++) {
        palms[i].rotation.z = Math.sin(t * 0.8 + i) * 0.02;
      }
      // Sun glitter shimmers on the water.
      for (let i = 0; i < glitter.length; i++) {
        glitter[i].material.opacity = 0.35 + 0.35 * Math.abs(Math.sin(t * 1.3 + i * 1.7));
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
  const edge = EDGE + CITY.beachWidth - 2;
  return {
    x: Math.max(-EDGE - 4, Math.min(EDGE + 4, x)),
    z: Math.max(-EDGE - 4, Math.min(edge, z)),
  };
}
