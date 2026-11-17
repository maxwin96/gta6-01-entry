// The player on foot: a simple stylized character (hoodie body, head, cap)
// that walks/runs with WASD relative to the camera, collides with building
// footprints, and punches with F or mouse click.

import * as THREE from 'three';
import { PLAYER } from './config.js';
import { clamp } from './utils.js';
import { clampToCity } from './world.js';

export function createPlayer(scene) {
  const group = new THREE.Group();

  const skin = new THREE.MeshLambertMaterial({ color: 0xe8b98a });
  const hoodie = new THREE.MeshLambertMaterial({ color: 0x2f6fb2 });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x2e3a4a });
  const capMat = new THREE.MeshLambertMaterial({ color: 0xd94f3d });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.85, 0.36), hoodie);
  body.position.y = 1.05;
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 12), skin);
  head.position.y = 1.68;
  head.castShadow = true;
  group.add(head);

  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.1, 14), capMat);
  cap.position.y = 1.86;
  group.add(cap);
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.26), capMat);
  brim.position.set(0, 1.82, 0.3);
  group.add(brim);

  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.62, 0.28), jeans);
  legL.position.set(-0.16, 0.31, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.16;
  group.add(legR);

  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.2), hoodie);
  armL.position.set(-0.42, 1.05, 0);
  group.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.42;
  group.add(armR);

  scene.add(group);

  const state = {
    pos: new THREE.Vector3(-28, 0, 28),
    heading: 0, // facing direction, radians
    health: PLAYER.maxHealth,
    moving: false,
    punching: 0, // punch animation timer
    walkPhase: 0,
  };

  function collides(x, z, colliders) {
    const r = PLAYER.radius;
    for (const c of colliders) {
      if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) return true;
    }
    return false;
  }

  return {
    group,
    state,
    reset(x, z) {
      state.pos.set(x, 0, z);
      state.heading = 0;
      state.health = PLAYER.maxHealth;
      state.punching = 0;
      group.position.copy(state.pos);
    },
    setHealth(value) {
      state.health = clamp(value, 0, PLAYER.maxHealth);
    },
    punch() {
      if (state.punching <= 0) {
        state.punching = 0.35;
        return true;
      }
      return false;
    },
    update(dt, input, cameraYaw, colliders) {
      const axes = input.moveAxes();
      const speed = input.running() ? PLAYER.runSpeed : PLAYER.walkSpeed;
      // Movement is relative to where the camera looks. The camera sits
      // behind the player at yaw `cameraYaw`, so its view forward on the
      // ground is (-sin, -cos) and its right is (cos, -sin).
      const sin = Math.sin(cameraYaw);
      const cos = Math.cos(cameraYaw);
      let mx = -sin * axes.forward + cos * axes.strafe;
      let mz = -cos * axes.forward - sin * axes.strafe;
      const len = Math.hypot(mx, mz);
      state.moving = len > 0.01;
      if (state.moving) {
        mx /= len;
        mz /= len;
        const step = speed * dt;
        const nx = state.pos.x + mx * step;
        const nz = state.pos.z + mz * step;
        const clamped = clampToCity(nx, nz);
        // Axis-separated collision so the player slides along walls.
        if (!collides(clamped.x, state.pos.z, colliders)) state.pos.x = clamped.x;
        if (!collides(state.pos.x, clamped.z, colliders)) state.pos.z = clamped.z;
        state.heading = Math.atan2(mx, mz);
        state.walkPhase += dt * speed * 1.6;
      }
      if (state.punching > 0) state.punching -= dt;

      group.position.copy(state.pos);
      group.rotation.y = state.heading;
      // Walk swing + punch: arms swing, legs alternate, right arm jabs.
      const swing = state.moving ? Math.sin(state.walkPhase) * 0.55 : 0;
      legL.rotation.x = swing;
      legR.rotation.x = -swing;
      armL.rotation.x = -swing;
      if (state.punching > 0) {
        const k = 1 - state.punching / 0.35;
        armR.rotation.x = -1.5 * Math.sin(k * Math.PI);
      } else {
        armR.rotation.x = swing;
      }
    },
  };
}
