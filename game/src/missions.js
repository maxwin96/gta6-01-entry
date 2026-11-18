// Missions: four chained jobs with a glowing objective marker, a HUD
// objective line, completion rewards and a "mission passed" banner.
// A newcomer in Sunset Bay runs errands for the harbour fixer "Marisol",
// steals a car for the chop shop, shakes a police tail — and now caps it
// off with a timed sprint down Ocean Drive to the pier.

import * as THREE from 'three';
import { MISSIONS, SPRINT } from './config.js';
import { flatDistance } from './utils.js';

function buildMarker(color) {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.2, 0.18, 10, 32),
    new THREE.MeshBasicMaterial({ color }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.4;
  group.add(ring);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 1.4, 26, 12, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, side: THREE.DoubleSide }),
  );
  beam.position.y = 13;
  group.add(beam);
  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 12, 10),
    new THREE.MeshBasicMaterial({ color }),
  );
  dot.position.y = 1.2;
  group.add(dot);
  group.visible = false;
  return { group, dot };
}

// The sprint route: east Ocean Drive, mid Ocean Drive, then the pier.
function sprintRoute(places) {
  return [
    { x: 140, z: 196, label: 'Checkpoint 1/3 — east Ocean Drive' },
    { x: 28, z: 196, label: 'Checkpoint 2/3 — mid Ocean Drive' },
    { x: places.pier.x, z: places.pier.z, label: 'Final checkpoint — the pier' },
  ];
}

export function createMissions(scene, places) {
  const markers = {
    gold: buildMarker(0xffc93a),
    red: buildMarker(0xff4444),
  };
  scene.add(markers.gold.group);
  scene.add(markers.red.group);

  const state = {
    index: 0, // active mission (0..3); 4 = all done
    stage: 0, // step inside the current mission
    timer: 0, // mission 3 and sprint countdowns
    hasPackage: false,
    banner: null, // { text, sub, until } shown by the HUD
    objective: '',
    marker: null, // { x, z } of the visible objective marker
    checkpoint: 0, // sprint checkpoint reached so far
  };
  const route = sprintRoute(places);

  function setObjective(text) {
    state.objective = text;
  }

  function showBanner(text, sub, seconds) {
    state.banner = { text, sub, until: performance.now() / 1000 + seconds };
  }

  function currentMission() {
    return MISSIONS[state.index] || null;
  }

  function placeMarker(kind, x, z) {
    const marker = markers[kind];
    marker.group.position.set(x, 0, z);
    marker.group.visible = true;
    state.marker = { x, z };
    return marker;
  }

  function hideMarkers() {
    markers.gold.group.visible = false;
    markers.red.group.visible = false;
    state.marker = null;
  }

  /** Set up the objective for the current mission stage. */
  function startMission(index) {
    state.index = index;
    state.stage = 0;
    state.timer = 0;
    state.hasPackage = false;
    state.checkpoint = 0;
    hideMarkers();
    if (index === 0) {
      placeMarker('gold', places.pier.x, places.pier.z);
      setObjective('Pick up the package at the pier (south beach)');
    } else if (index === 1) {
      placeMarker('red', places.sportsCar.x, places.sportsCar.z);
      setObjective('Steal the red sports car by the plaza');
    } else if (index === 2) {
      setObjective('Survive the police chase — 60 seconds left');
      state.timer = 60;
    } else if (index === 3) {
      state.timer = SPRINT.timeLimit;
      placeMarker('gold', route[0].x, route[0].z);
      setObjective('Sunset Sprint — ' + route[0].label + ' — ' + SPRINT.timeLimit + 's');
    } else {
      setObjective('All jobs done — Sunset Bay is yours, kid.');
    }
  }

  /** Called when a mission is finished: pay out and advance. Returns the reward. */
  function completeMission() {
    const mission = currentMission();
    const reward = mission ? mission.reward : 0;
    showBanner('MISSION PASSED', mission ? mission.title + ' — +' + '$' + reward : '', 4);
    state.index += 1;
    if (state.index < MISSIONS.length) startMission(state.index);
    else {
      hideMarkers();
      setObjective('All jobs done — Sunset Bay is yours, kid.');
      showBanner('ALL MISSIONS COMPLETE', 'You own the streets of Sunset Bay', 6);
    }
    return reward;
  }

  return {
    state,
    currentMission,
    startMission,
    showBanner,
    /** Current objective marker position (or null) for the minimap. */
    markerPos() {
      return state.marker;
    },
    get banner() {
      const b = state.banner;
      if (!b) return null;
      if (performance.now() / 1000 > b.until) {
        state.banner = null;
        return null;
      }
      return b;
    },
    get objective() {
      return state.objective;
    },
    /** Per-frame progress checks. `hooks` supplies game callbacks. */
    update(dt, hooks) {
      const mission = currentMission();
      if (!mission) return;
      const pos = hooks.playerPos();
      // Pulse the marker dot.
      const t = performance.now() / 1000;
      markers.gold.dot.position.y = 1.2 + Math.sin(t * 3) * 0.25;
      markers.red.dot.position.y = 1.2 + Math.sin(t * 3) * 0.25;

      if (mission.id === 'package') {
        if (state.stage === 0) {
          if (flatDistance(pos, places.pier) < 4) {
            state.hasPackage = true;
            state.stage = 1;
            placeMarker('gold', places.hotel.x, places.hotel.z);
            setObjective('Deliver the package to the hotel on Ocean Drive');
            hooks.onPickup();
          }
        } else if (flatDistance(pos, places.hotel) < 4) {
          hooks.onReward(completeMission());
          if (hooks.onFireworks) hooks.onFireworks();
        }
      } else if (mission.id === 'hotwheels') {
        if (state.stage === 0 && hooks.inSportsCar()) {
          state.stage = 1;
          placeMarker('gold', places.garage.x, places.garage.z);
          setObjective('Drive the sports car to the garage (south-west)');
          hooks.onPickup();
        } else if (state.stage === 1 && hooks.inSportsCar() && flatDistance(pos, places.garage) < 6) {
          hooks.onReward(completeMission());
          if (hooks.onFireworks) hooks.onFireworks();
        }
      } else if (mission.id === 'heat') {
        state.timer -= dt;
        setObjective('Survive the police chase — ' + Math.max(0, Math.ceil(state.timer)) + ' seconds left');
        if (state.timer <= 0) {
          hooks.onReward(completeMission());
          if (hooks.onFireworks) hooks.onFireworks();
        }
      } else if (mission.id === 'sprint') {
        state.timer -= dt;
        const left = Math.max(0, Math.ceil(state.timer));
        const cp = route[state.checkpoint];
        setObjective('Sunset Sprint — ' + cp.label + ' — ' + left + 's left');
        if (flatDistance(pos, cp) < SPRINT.checkpointRadius) {
          state.checkpoint += 1;
          hooks.onPickup();
          if (state.checkpoint >= route.length) {
            hooks.onReward(completeMission());
            if (hooks.onFireworks) hooks.onFireworks();
          } else {
            const next = route[state.checkpoint];
            placeMarker('gold', next.x, next.z);
            showBanner('CHECKPOINT ' + state.checkpoint + '/3', next.label, 2.5);
          }
        } else if (state.timer <= 0) {
          // Out of time: the sprint restarts from its first checkpoint.
          showBanner('OUT OF TIME', 'The sprint restarts — hit the checkpoints faster', 3);
          startMission(3);
          if (hooks.onSprintRestart) hooks.onSprintRestart();
        }
      }
    },
  };
}
