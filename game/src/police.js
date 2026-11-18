// Wanted level and police. Crimes raise the star count; cruisers spawn
// at the city edge and chase the player, ramming the car or busting them
// on foot. Stay quiet and the stars fade. The cruisers now carry a big
// roof light bar with alternating red/blue halo glow, SBPD door decals
// and a black hood panel.

import * as THREE from 'three';
import { WANTED } from './config.js';
import { createCar } from './vehicles.js';
import { angleDelta, clamp, flatDistance } from './utils.js';

// Soft round glow texture for the light-bar halos.
function haloTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const HALO_TEX = haloTexture();

// Door decal: "SBPD • POLICE" in dark blue on the white door.
function doorDecalTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = '#f2f2f2';
  g.fillRect(0, 0, 256, 96);
  g.fillStyle = '#14264a';
  g.font = 'bold 34px sans-serif';
  g.textAlign = 'center';
  g.fillText('SBPD', 128, 42);
  g.font = 'bold 26px sans-serif';
  g.fillText('• POLICE •', 128, 76);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const DECAL_TEX = doorDecalTexture();

// A wide roof bar: red pod left, blue pod right, each with a halo sprite
// that flares when its side is lit.
function buildLightBar() {
  const group = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.1, 0.5),
    new THREE.MeshLambertMaterial({ color: 0x1a1c20 }),
  );
  base.position.set(0, 1.42, -0.1);
  group.add(base);
  const redMat = new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0xff2222, emissiveIntensity: 1 });
  const blueMat = new THREE.MeshLambertMaterial({ color: 0x2244ff, emissive: 0x2244ff, emissiveIntensity: 1 });
  const redPod = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.3, 0.42), redMat);
  redPod.position.set(-0.38, 1.6, -0.1);
  group.add(redPod);
  const bluePod = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.3, 0.42), blueMat);
  bluePod.position.set(0.38, 1.6, -0.1);
  group.add(bluePod);
  const redHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: HALO_TEX, color: 0xff3333, transparent: true, depthWrite: false, opacity: 0.9 }),
  );
  redHalo.scale.set(2.6, 2.6, 1);
  redHalo.position.set(-0.38, 1.6, -0.1);
  group.add(redHalo);
  const blueHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: HALO_TEX, color: 0x3355ff, transparent: true, depthWrite: false, opacity: 0.2 }),
  );
  blueHalo.scale.set(2.6, 2.6, 1);
  blueHalo.position.set(0.38, 1.6, -0.1);
  group.add(blueHalo);
  return { group, redMat, blueMat, redHalo, blueHalo };
}

export function createPolice(scene, rng) {
  const cruisers = []; // { car, redMat, blueMat, redHalo, blueHalo, stuck }
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
    // Light bar, black hood panel and SBPD door decals make it a cruiser.
    const bar = buildLightBar();
    car.group.add(bar.group);
    const hoodPanel = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.06, 1.0),
      new THREE.MeshLambertMaterial({ color: 0x1a1c20 }),
    );
    hoodPanel.position.set(0, 0.97, 1.75);
    car.group.add(hoodPanel);
    const decalMat = new THREE.MeshBasicMaterial({ map: DECAL_TEX });
    for (const side of [-1, 1]) {
      const decal = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.56), decalMat);
      decal.position.set(side * 0.99, 0.62, 0);
      decal.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
      car.group.add(decal);
    }
    cruisers.push({ car, ...bar, stuck: 0 });
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

      // Flash the bars: red and blue alternate, halos flare with them.
      flashTimer += dt;
      const redOn = Math.floor(flashTimer * 5) % 2 === 0;
      for (const entry of cruisers) {
        entry.redMat.emissiveIntensity = redOn ? 2.2 : 0.12;
        entry.blueMat.emissiveIntensity = redOn ? 0.12 : 2.2;
        entry.redHalo.material.opacity = redOn ? 0.95 : 0.08;
        entry.blueHalo.material.opacity = redOn ? 0.08 : 0.95;
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
