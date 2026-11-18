// Sunset Bay — golden-hour lighting. A shader sky dome that grades from
// deep blue overhead through pink to orange at the horizon, a low sun disc
// glowing over the ocean, warm haze, and a long-shadow directional light
// that replaces the flat midday lighting the city used to have.

import * as THREE from 'three';
import { SUNSET } from './config.js';

// A big inside-out sphere carrying a three-stop vertical gradient.
function buildSkyDome() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(SUNSET.skyTop) },
      mid: { value: new THREE.Color(SUNSET.skyMid) },
      low: { value: new THREE.Color(SUNSET.skyLow) },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = position;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform vec3 top;
      uniform vec3 mid;
      uniform vec3 low;
      varying vec3 vDir;
      void main() {
        float h = normalize(vDir).y;
        vec3 col = h > 0.25
          ? mix(mid, top, smoothstep(0.25, 0.75, h))
          : mix(low, mid, smoothstep(-0.08, 0.25, h));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(900, 24, 16), mat);
  dome.renderOrder = -10;
  return dome;
}

// Soft radial glow painted on a canvas, used for the sun halo.
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255, 236, 180, 1)');
  grad.addColorStop(0.25, 'rgba(255, 170, 90, 0.75)');
  grad.addColorStop(0.6, 'rgba(255, 110, 80, 0.22)');
  grad.addColorStop(1, 'rgba(255, 110, 80, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// The sun itself: a bright disc low over the sea plus a wide halo sprite.
function buildSunRig() {
  const dir = new THREE.Vector3(SUNSET.sunDir.x, SUNSET.sunDir.y, SUNSET.sunDir.z).normalize();
  const group = new THREE.Group();
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(34, 32),
    new THREE.MeshBasicMaterial({ color: 0xffe9b0, fog: false }),
  );
  disc.position.copy(dir).multiplyScalar(820);
  disc.lookAt(0, 0, 0);
  group.add(disc);
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(),
      transparent: true,
      depthWrite: false,
      fog: false,
      opacity: 0.95,
    }),
  );
  halo.scale.set(420, 420, 1);
  halo.position.copy(dir).multiplyScalar(810);
  group.add(halo);
  return { group, disc, halo, dir };
}

export function createSunsetLighting(scene) {
  scene.background = null; // the dome is the sky now
  scene.fog = new THREE.Fog(SUNSET.fogColor, SUNSET.fogNear, SUNSET.fogFar);
  scene.add(buildSkyDome());

  const rig = buildSunRig();
  scene.add(rig.group);

  // Low, warm key light: long evening shadows across the streets.
  const sun = new THREE.DirectionalLight(SUNSET.sunColor, 3.4);
  sun.position.copy(rig.dir).multiplyScalar(320);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -260;
  sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260;
  sun.shadow.camera.bottom = -260;
  sun.shadow.camera.far = 800;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  // Cool blue bounce from the sky so shadowed faces are not pitch black.
  scene.add(new THREE.HemisphereLight(0x8a7fd8, 0x6b4a3a, 1.6));

  return {
    sun,
    // Slow breathing on the halo; the sun sinks a touch over minutes.
    update(dt, elapsed) {
      rig.halo.material.opacity = 0.88 + Math.sin(elapsed * 0.7) * 0.07;
    },
  };
}
