// Wanted level and police. Crimes raise the star count; police cars spawn
// at the city edge and chase the player, ramming their car or busting them
// on foot. Stay out of sight (or just out of trouble) and stars fade away.

import * as THREE from 'three';
import { WANTED } from './config.js';
import { createCar } from './vehicles.js';
import { angleDelta, clamp, flatDistance } from './utils.js';

function makeLightBar() {
  const group = new THREE.Group();
  const red = new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0xff2222, emissiveIntensity: 0.9 });
  const blue = new THREE.MeshLambertMaterial({ color: 0x2244ff, emissive: 0x2244ff, emissiveIntensity: 0.9 });
  const redLight = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.3), red);
  redLight.position.set(-0.32, 1.45, -0.1);
  const blueLight = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.3), blue);
  blueLight.position.set(0.32, 1.45, -0.1);
  group.add(redLight);
  group.add(blueLight);
  return { group, redLight, blueLight };
}

export function createPolice(scene, rng) {
  const cruisers = []; // { car, lightBar, stuck }
  let wanted = 0;
  let quietTimer = 0; // seconds since the last crime
  let flashTimer = 0;

  function spawnCruiser(nearX, nearZ) {
    // Spawn on a road a little way from the player so it drives in.
    const angle = rng() * Math.PI * 2;
    const x = nearX + Math.cos(angle) * 70;
    const z = nearZ + Math.sin(angle) * 70;
    const car = createCar(scene, {
      x: clamp(x, -195, 195),
      z: clamp(z, -195, 195),
      heading: rng() * Math.PI * 2,
      color: 0xf2f2f2,
      sporty: true,
      parked: false,
      id: 'police-' + cruisers.length + '-' + Date.now(),
      isPolice: true,
    });
    // Black doors + light bar turn a white car into a cruiser.
    const { group, redLight, blueLight } = makeLightBar();
    car.group.add(group);
    const doorMat = new THREE.MeshLambertMaterial({ color: 0x1a1c20 });
    const doorL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 1.6), doorMat);
    doorL.position.set(-0.96, 0.6, 0);
    car.group.add(doorL);
    const doorR = doorL.clone();
    doorR.position.x = 0.96;
    car.group.add(doorR);
    cruisers.push({ car, redLight, blueLight, stuck: 0 });
  }

  function removeCruiser(entry) {
    entry.car.dispose();
    const index = cruisers.indexOf(entry);
    if (index !== -1) cruisers.splice(index, 1);
  }

  return {
    get wanted() {
      return wanted;
    },
    get cruisers() {
      return cruisers.map((c) => c.car);
    },
    setWanted(level) {
      wanted = clamp(level, 0, WANTED.max);
      quietTimer = 0;
    },
    /** A crime happened: raise the wanted level and reset the decay clock. */
    addCrime(stars) {
      wanted = clamp(wanted + stars, 0, WANTED.max);
      quietTimer = 0;
    },
    reset() {
      for (const entry of [...cruisers]) removeCruiser(entry);
      wanted = 0;
      quietTimer = 0;
    },
    update(dt, target, colliders, onBust, onRam) {
      // Stars fade after a quiet spell.
      quietTimer += dt;
      if (wanted > 0 && quietTimer > WANTED.decaySeconds) {
        wanted -= 1;
        quietTimer = 0;
      }

      // Keep the right number of cruisers on the road.
      const want = Math.min(wanted * WANTED.policePerStar, WANTED.maxPolice);
      while (cruisers.length < want) spawnCruiser(target.x, target.z);
      while (cruisers.length > want) removeCruiser(cruisers[cruisers.length - 1]);

      // Flash the light bars.
      flashTimer += dt;
      const redOn = Math.floor(flashTimer * 4) % 2 === 0;
      for (const entry of cruisers) {
        entry.redLight.material.emissiveIntensity = redOn ? 1.2 : 0.15;
        entry.blueLight.material.emissiveIntensity = redOn ? 0.15 : 1.2;
      }

      // Chase: steer toward the player, ram at close range.
      for (const entry of cruisers) {
        const s = entry.car.state;
        const dist = flatDistance(s, target);
        const desired = Math.atan2(target.x - s.x, target.z - s.z);
        const turn = clamp(angleDelta(s.heading, desired), -1, 1);
        const speedTarget = dist > 60 ? 30 : dist > 12 ? 26 : 20;
        s.speed += (speedTarget - s.speed) * Math.min(1, dt * 1.2);
        s.heading += (s.speed / 3.2) * turn * dt * 1.4;
        const nx = s.x + Math.sin(s.heading) * s.speed * dt;
        const nz = s.z + Math.cos(s.heading) * s.speed * dt;
        const blocked = colliders.some(
          (c) => nx + 1.4 > c.minX && nx - 1.4 < c.maxX && nz + 1.4 > c.minZ && nz - 1.4 < c.maxZ,
        );
        if (!blocked && Math.abs(nx) < 210 && Math.abs(nz) < 230) {
          s.x = nx;
          s.z = nz;
          entry.stuck = 0;
        } else {
          // Stuck on a building: reverse out and turn around.
          entry.stuck += dt;
          s.speed = -6;
          s.heading += dt * 1.5;
          if (entry.stuck > 2) {
            entry.car.place(target.x + 60, target.z + 40, 0);
            entry.stuck = 0;
          }
        }
        entry.car.group.position.set(s.x, 0, s.z);
        entry.car.group.rotation.y = s.heading;
        if (dist < WANTED.bustDistance && !target.inCar) {
          onBust();
        } else if (dist < 3.4 && target.inCar) {
          onRam(dist);
        }
      }
    },
  };
}
