// HUD: health bar, money, pulsing wanted stars, clock, mission panel
// ("MISSION n/4 — TITLE" plus the objective line), banner, speedometer
// while driving, and a 2D minimap that draws roads, the coastline and
// sand, the plaza, the player, police, traffic and a pulsing mission
// marker.

import { ROAD_LINES } from './world.js';
import { formatMoney } from './utils.js';

export function createHud() {
  const root = document.getElementById('hud');
  const healthFill = document.getElementById('health-fill');
  const moneyEl = document.getElementById('money');
  const starsEl = document.getElementById('stars');
  const clockEl = document.getElementById('clock');
  const missionEl = document.getElementById('mission-panel');
  const objectiveEl = document.getElementById('objective');
  const bannerEl = document.getElementById('banner');
  const bannerTitle = document.getElementById('banner-title');
  const bannerSub = document.getElementById('banner-sub');
  const speedEl = document.getElementById('speed');
  const hintEl = document.getElementById('hint');
  const minimap = document.getElementById('minimap');
  const mapCtx = minimap.getContext('2d');
  const wantedLabel = document.getElementById('wanted-label');

  function drawMinimap(view) {
    const size = minimap.width;
    const range = 460; // world metres across the map
    const toMap = (x, z) => [((x + range / 2) / range) * size, ((z + range / 2) / range) * size];
    // Land base.
    mapCtx.fillStyle = 'rgba(16, 34, 24, 0.88)';
    mapCtx.fillRect(0, 0, size, size);
    // Ocean (south) and the sand strip of the beach.
    const [, shoreY] = toMap(0, 203);
    mapCtx.fillStyle = 'rgba(42, 110, 168, 0.95)';
    mapCtx.fillRect(0, shoreY + size * 0.05, size, size);
    mapCtx.fillStyle = 'rgba(232, 210, 154, 0.95)';
    mapCtx.fillRect(0, shoreY, size, size * 0.05);
    // Central plaza as a pale circle.
    const [px0, pz0] = toMap(0, 0);
    mapCtx.fillStyle = 'rgba(159, 200, 232, 0.8)';
    mapCtx.beginPath();
    mapCtx.arc(px0, pz0, 7, 0, Math.PI * 2);
    mapCtx.fill();
    // Roads.
    mapCtx.strokeStyle = 'rgba(220, 220, 210, 0.85)';
    mapCtx.lineWidth = 4;
    for (const line of ROAD_LINES) {
      const [ax] = toMap(line, 0);
      mapCtx.beginPath();
      mapCtx.moveTo(ax, 0);
      mapCtx.lineTo(ax, size);
      mapCtx.stroke();
      const [, bz] = toMap(0, line);
      mapCtx.beginPath();
      mapCtx.moveTo(0, bz);
      mapCtx.lineTo(size, bz);
      mapCtx.stroke();
    }
    // Mission marker: a gold diamond that breathes.
    if (view.marker) {
      const [mx, mz] = toMap(view.marker.x, view.marker.z);
      const pulse = 6 + Math.sin(performance.now() / 220) * 2.5;
      mapCtx.fillStyle = 'rgba(255, 201, 58, 0.35)';
      mapCtx.beginPath();
      mapCtx.arc(mx, mz, pulse + 6, 0, Math.PI * 2);
      mapCtx.fill();
      mapCtx.fillStyle = '#ffc93a';
      mapCtx.beginPath();
      mapCtx.moveTo(mx, mz - pulse);
      mapCtx.lineTo(mx + pulse, mz);
      mapCtx.lineTo(mx, mz + pulse);
      mapCtx.lineTo(mx - pulse, mz);
      mapCtx.fill();
    }
    // Traffic (grey dots).
    mapCtx.fillStyle = 'rgba(200, 200, 200, 0.9)';
    for (const car of view.traffic || []) {
      const [cx, cz] = toMap(car.x, car.z);
      mapCtx.fillRect(cx - 2, cz - 2, 4, 4);
    }
    // Police (flashing blue/red).
    for (const cop of view.police || []) {
      const [cx, cz] = toMap(cop.x, cop.z);
      mapCtx.fillStyle = Math.floor(performance.now() / 300) % 2 === 0 ? '#3a6bff' : '#ff3a3a';
      mapCtx.beginPath();
      mapCtx.arc(cx, cz, 4, 0, Math.PI * 2);
      mapCtx.fill();
    }

    // Player (white triangle pointing along the heading).
    const [px, pz] = toMap(view.player.x, view.player.z);
    mapCtx.save();
    mapCtx.translate(px, pz);
    // Map y grows downward while world z grows south, so the triangle
    // points along the heading with a flip on the z axis.
    mapCtx.rotate(Math.PI - view.player.heading);
    mapCtx.fillStyle = '#ffffff';
    mapCtx.strokeStyle = '#222222';
    mapCtx.lineWidth = 1;
    mapCtx.beginPath();
    mapCtx.moveTo(0, -7);
    mapCtx.lineTo(5, 6);
    mapCtx.lineTo(-5, 6);
    mapCtx.closePath();
    mapCtx.fill();
    mapCtx.stroke();
    mapCtx.restore();
    // North tick.
    mapCtx.fillStyle = 'rgba(255,255,255,0.8)';
    mapCtx.font = 'bold 11px sans-serif';
    mapCtx.fillText('N', size - 14, 14);
  }

  return {
    show() {
      root.style.display = 'block';
    },
    hide() {
      root.style.display = 'none';
    },
    setHint(text) {
      hintEl.textContent = text || '';
      hintEl.style.display = text ? 'block' : 'none';
    },
    /** Refresh every HUD element from the current game state. */
    update(view) {
      healthFill.style.width = Math.max(0, view.health) + '%';
      healthFill.style.background = view.health > 50 ? '#4fae5f' : view.health > 25 ? '#e8c33a' : '#d94f3d';
      moneyEl.textContent = formatMoney(view.money);
      starsEl.textContent = '★'.repeat(view.wanted) + '☆'.repeat(5 - view.wanted);
      starsEl.style.color = view.wanted > 0 ? '#ffd23a' : 'rgba(255,255,255,0.45)';
      // Wanted stars throb while the heat is on.
      if (view.wanted > 0) {
        const beat = 1 + Math.sin(performance.now() / 160) * 0.14;
        starsEl.style.transform = 'scale(' + beat.toFixed(3) + ')';
        starsEl.style.transformOrigin = 'right center';
      } else {
        starsEl.style.transform = 'scale(1)';
      }
      wantedLabel.style.display = view.wanted > 0 ? 'inline' : 'none';
      clockEl.textContent = view.clock;
      if (missionEl && view.missionTitle) {
        const total = view.missionTotal || 4;
        const num = Math.min(view.missionIndex + 1, total);
        missionEl.textContent = 'MISSION ' + num + '/' + total + ' — ' + view.missionTitle;
      }
      objectiveEl.textContent = view.objective;
      if (view.banner) {
        bannerTitle.textContent = view.banner.text;
        bannerSub.textContent = view.banner.sub;
        bannerEl.style.display = 'block';
      } else {
        bannerEl.style.display = 'none';
      }
      if (view.speedKmh != null) {
        speedEl.style.display = 'block';
        speedEl.textContent = Math.round(view.speedKmh) + ' km/h';
      } else {
        speedEl.style.display = 'none';
      }
      drawMinimap(view);
    },
  };
}
