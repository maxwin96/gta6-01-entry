// Sunset Bay — particle effects on fixed pools. Exhaust puffs, tyre
// skid marks, crash sparks, a small fireball for hard hits and gold
// fireworks when a job is done. Everything is pre-allocated: dead
// particles are recycled, nothing new is created per frame, no network.

import * as THREE from 'three';

// Soft round blob so puffs fade at the edges instead of showing squares.
function softTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

const SOFT_TEX = softTexture();

// One puff: a billboard square that grows, fades and drifts.
function makePuffPool(scene, count, color, size, opacity) {
  const mat = new THREE.SpriteMaterial({
    color,
    map: SOFT_TEX,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  const items = [];
  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Sprite(mat.clone());
    mesh.visible = false;
    scene.add(mesh);
    items.push({
      mesh,
      life: 0,
      maxLife: 1,
      vx: 0,
      vy: 0,
      vz: 0,
      grow: 1,
      spin: 0,
    });
  }
  return { items, cursor: 0 };
}

function launch(pool, x, y, z, vx, vy, vz, life, startSize, grow, spin) {
  const p = pool.items[pool.cursor];
  pool.cursor = (pool.cursor + 1) % pool.items.length;
  p.mesh.visible = true;
  p.mesh.position.set(x, y, z);
  p.mesh.scale.setScalar(startSize);
  p.mesh.material.rotation = Math.random() * Math.PI * 2;
  p.vx = vx;
  p.vy = vy;
  p.vz = vz;
  p.life = life;
  p.maxLife = life;
  p.grow = grow;
  p.spin = spin;
}

// Skid marks: flat dark quads laid on the asphalt, fading slowly.
function makeSkidPool(scene, count) {
  const geo = new THREE.PlaneGeometry(0.55, 1.4);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x141414,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const marks = [];
  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(geo, mat.clone());
    mesh.rotation.x = -Math.PI / 2;
    mesh.visible = false;
    mesh.position.y = 0.09;
    scene.add(mesh);
    marks.push({ mesh, life: 0 });
  }
  return { marks, cursor: 0 };
}

export function createEffects(scene) {
  const smoke = makePuffPool(scene, 48, 0x9a9aa2, 1, 0.28);
  const sparks = makePuffPool(scene, 40, 0xffc93a, 1, 0.95);
  const flames = makePuffPool(scene, 24, 0xff6a2a, 1, 0.9);
  const rockets = makePuffPool(scene, 36, 0xffd23a, 1, 1);
  const skids = makeSkidPool(scene, 120);

  // Fireworks reuse the rocket pool for the burst; the burst colour is
  // set per launch by tinting the shared material clones.
  function burst(pool, x, y, z, n, speed, life, size) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const b = (Math.random() - 0.5) * Math.PI;
      const s = speed * (0.5 + Math.random() * 0.8);
      launch(
        pool, x, y, z,
        Math.cos(a) * Math.cos(b) * s,
        Math.abs(Math.sin(b)) * s + speed * 0.3,
        Math.sin(a) * Math.cos(b) * s,
        life * (0.7 + Math.random() * 0.6), size, 0.4, (Math.random() - 0.5) * 6,
      );
    }
  }

  return {
    // Grey puff from a tailpipe while the car is moving.
    exhaust(x, y, z, heading) {
      const back = 2.2;
      launch(
        smoke,
        x - Math.sin(heading) * back + (Math.random() - 0.5) * 0.3,
        y + 0.35,
        z - Math.cos(heading) * back,
        (Math.random() - 0.5) * 0.6, 0.8 + Math.random() * 0.5, (Math.random() - 0.5) * 0.6,
        0.7, 0.22, 1.1, 1.5,
      );
    },
    // Dark tyre mark under a rear wheel during a hard turn.
    skidMark(x, z, heading) {
      const m = skids.marks[skids.cursor];
      skids.cursor = (skids.cursor + 1) % skids.marks.length;
      m.mesh.visible = true;
      m.mesh.position.set(x, 0.09, z);
      m.mesh.rotation.z = -heading;
      m.mesh.material.opacity = 0.55;
      m.life = 6;
    },
    // Bright sparks flying out of an impact point.
    sparks(x, y, z) {
      burst(sparks, x, y, z, 10, 7, 0.55, 0.16);
    },
    // Small fireball + smoke column for a hard crash.
    explode(x, y, z) {
      burst(flames, x, y + 0.6, z, 12, 4, 0.8, 0.9);
      burst(smoke, x, y + 1.2, z, 6, 2, 1.8, 0.8);
      burst(sparks, x, y + 0.5, z, 14, 9, 0.7, 0.2);
    },
    // Gold rockets over the player's position when a mission passes.
    fireworks(x, z) {
      for (let k = 0; k < 5; k++) {
        burst(
          rockets,
          x + (Math.random() - 0.5) * 14, 14 + Math.random() * 10, z + (Math.random() - 0.5) * 14,
          8, 6, 1.4, 0.22,
        );
      }
    },
    update(dt) {
      for (const pool of [smoke, sparks, flames, rockets]) {
        for (const p of pool.items) {
          if (!p.mesh.visible) continue;
          p.life -= dt;
          if (p.life <= 0) {
            p.mesh.visible = false;
            continue;
          }
          p.mesh.position.x += p.vx * dt;
          p.mesh.position.y += p.vy * dt;
          p.mesh.position.z += p.vz * dt;
          p.vy -= pool === sparks || pool === rockets ? 9 * dt : -0.4 * dt;
          const frac = p.life / p.maxLife;
          p.mesh.material.opacity = Math.min(1, frac * 1.4) * (pool === smoke ? 0.28 : 0.95);
          const s = p.mesh.scale.x + p.grow * dt;
          p.mesh.scale.setScalar(s);
          p.mesh.material.rotation += p.spin * dt;
        }
      }
      for (const m of skids.marks) {
        if (!m.mesh.visible) continue;
        m.life -= dt;
        if (m.life <= 0) {
          m.mesh.visible = false;
          continue;
        }
        m.mesh.material.opacity = Math.min(0.55, m.life * 0.12);
      }
    },
  };
}
