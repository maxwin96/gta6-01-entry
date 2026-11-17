// HUD: health bar, money, wanted stars, clock, mission objective, banner,
// speedometer while driving, and a 2D minimap that draws roads, the player,
// police, traffic and the mission marker.

import { ROAD_LINES } from './world.js';
import { formatMoney } from './utils.js';

export function createHud() {
  const root = document.getElementById('hud');
  const healthFill = document.getElementById('health-fill');
  const moneyEl = document.getElementById('money');
  const starsEl = document.getElementById('stars');
  const clockEl = document.getElementById('clock');
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
    mapCtx.fillStyle = 'rgba(12, 26, 18, 0.82)';
    mapCtx.fillRect(0, 0, size, size);
    // Beach sand strip at the bottom (south, z past the city edge).
    mapCtx.fillStyle = 'rgba(232, 210, 154, 0.9)';
    mapCtx.fillRect(0, size * 0.94, size, size * 0.06);
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
    // Mission marker (gold diamond).
    if (view.marker) {
      const [mx, mz] = toMap(view.marker.x, view.marker.z);
      mapCtx.fillStyle = '#ffc93a';
      mapCtx.beginPath();
      mapCtx.moveTo(mx, mz - 7);
      mapCtx.lineTo(mx + 7, mz);
      mapCtx.lineTo(mx, mz + 7);
      mapCtx.lineTo(mx - 7, mz);
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
      wantedLabel.style.display = view.wanted > 0 ? 'inline' : 'none';
      clockEl.textContent = view.clock;
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
