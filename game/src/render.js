// Neon Vice: Syndicate - 2.5D Canvas Rendering Engine
// Features 2.5D building extrusion, dynamic headlights & siren strobes,
// minimap radar HUD, particle effects, synthwave retro aesthetic, and cinematic menus.

import {
  BLOCK_SIZE,
  MISSIONS,
  RADIO_STATIONS,
  ROAD_WIDTH,
  SIDEWALK_WIDTH,
  VEHICLE_TYPES,
  WEAPON_TYPES,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from './config.js';

export const SCREEN_TITLE = 'TITLE';
export const SCREEN_PLAY = 'PLAY';
export const SCREEN_PAUSED = 'PAUSED';
export const SCREEN_OVER = 'OVER';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let width = 0;
  let height = 0;
  let camera = { x: 4200, y: 1350, zoom: 1.0, shake: 0 };

  function resize() {
    width = canvas.width = window.innerWidth || 1280;
    height = canvas.height = window.innerHeight || 720;
  }
  window.addEventListener('resize', resize);
  resize();

  function triggerShake(amount = 12) {
    camera.shake = Math.max(camera.shake, amount);
  }

  // Draw ground, roads, crosswalks, sidewalks, and beach
  function drawGround(state, camX, camY, zoom) {
    // Base asphalt
    ctx.fillStyle = '#12131c';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-camX, -camY);

    // Ocean & Beach on East side
    const beachX = 4350;
    ctx.fillStyle = '#e5c158'; // Sandy beach
    ctx.fillRect(beachX, 0, 150, WORLD_HEIGHT);

    // Animated ocean water
    const oceanX = beachX + 150;
    const waveShift = Math.sin(performance.now() / 800) * 8;
    const oceanGrad = ctx.createLinearGradient(oceanX, 0, WORLD_WIDTH, 0);
    oceanGrad.addColorStop(0, '#0284c7');
    oceanGrad.addColorStop(1, '#0369a1');
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(oceanX + waveShift, 0, WORLD_WIDTH - oceanX, WORLD_HEIGHT);

    // Palm trees along beach promenade
    for (let py = 100; py < WORLD_HEIGHT; py += 160) {
      drawPalmTree(beachX + 40, py);
    }

    // East-West Roads
    for (let ry of state.roadsY) {
      // Sidewalk borders
      ctx.fillStyle = '#26293a';
      ctx.fillRect(0, ry - ROAD_WIDTH / 2 - SIDEWALK_WIDTH, WORLD_WIDTH, ROAD_WIDTH + SIDEWALK_WIDTH * 2);

      // Road asphalt
      ctx.fillStyle = '#181a24';
      ctx.fillRect(0, ry - ROAD_WIDTH / 2, WORLD_WIDTH, ROAD_WIDTH);

      // Dashed yellow centerline
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 3;
      ctx.setLineDash([24, 20]);
      ctx.beginPath();
      ctx.moveTo(0, ry);
      ctx.lineTo(WORLD_WIDTH, ry);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // North-South Roads
    for (let rx of state.roadsX) {
      // Sidewalk borders
      ctx.fillStyle = '#26293a';
      ctx.fillRect(rx - ROAD_WIDTH / 2 - SIDEWALK_WIDTH, 0, ROAD_WIDTH + SIDEWALK_WIDTH * 2, WORLD_HEIGHT);

      // Road asphalt
      ctx.fillStyle = '#181a24';
      ctx.fillRect(rx - ROAD_WIDTH / 2, 0, ROAD_WIDTH, WORLD_HEIGHT);

      // Dashed yellow centerline
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 3;
      ctx.setLineDash([24, 20]);
      ctx.beginPath();
      ctx.moveTo(rx, 0);
      ctx.lineTo(rx, WORLD_HEIGHT);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Intersection Crosswalks (Zebra Stripes)
    for (let rx of state.roadsX) {
      for (let ry of state.roadsY) {
        drawIntersectionCrosswalks(rx, ry);
      }
    }

    // Tire Skidmarks
    ctx.lineWidth = 6;
    for (let track of state.tireTracks) {
      ctx.strokeStyle = `rgba(10, 10, 15, ${track.alpha})`;
      ctx.beginPath();
      ctx.arc(track.x, track.y, 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawPalmTree(x, y) {
    // Drop shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(x + 12, y + 14, 20, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Trunk
    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();

    // Fronds (swaying in wind)
    const time = performance.now() / 1000;
    ctx.strokeStyle = '#15803d';
    ctx.lineWidth = 5;
    for (let a = 0; a < 6; a++) {
      const angle = a * (Math.PI / 3) + Math.sin(time + a) * 0.1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(angle) * 32, y + Math.sin(angle) * 32);
      ctx.stroke();
    }
  }

  function drawIntersectionCrosswalks(rx, ry) {
    ctx.fillStyle = '#cbd5e1';
    const halfRoad = ROAD_WIDTH / 2;
    // North crosswalk
    for (let x = rx - halfRoad + 8; x < rx + halfRoad - 8; x += 16) {
      ctx.fillRect(x, ry - halfRoad - 20, 10, 16);
    }
    // South crosswalk
    for (let x = rx - halfRoad + 8; x < rx + halfRoad - 8; x += 16) {
      ctx.fillRect(x, ry + halfRoad + 4, 10, 16);
    }
    // West crosswalk
    for (let y = ry - halfRoad + 8; y < ry + halfRoad - 8; y += 16) {
      ctx.fillRect(rx - halfRoad - 20, y, 16, 10);
    }
    // East crosswalk
    for (let y = ry - halfRoad + 8; y < ry + halfRoad - 8; y += 16) {
      ctx.fillRect(rx + halfRoad + 4, y, 16, 10);
    }
  }

  // 2.5D Building Extrusion with neon signs & illuminated windows
  function drawBuildings(state, camX, camY, zoom) {
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-camX, -camY);

    for (let b of state.buildings) {
      // Perspective shift vector for 2.5D extrusion
      const pScale = 0.09 * (b.roofHeight / 100);
      const offX = (b.x + b.width / 2 - camX) * pScale;
      const offY = (b.y + b.height / 2 - camY) * pScale;

      const roofX = b.x + offX;
      const roofY = b.y + offY;

      // Cast building shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(b.x + 14, b.y + 14, b.width, b.height);

      // Extruded Facade Walls (Gradient with windows)
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(roofX, roofY);
      ctx.lineTo(roofX + b.width, roofY);
      ctx.lineTo(b.x + b.width, b.y);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(b.x + b.width, b.y);
      ctx.lineTo(roofX + b.width, roofY);
      ctx.lineTo(roofX + b.width, roofY + b.height);
      ctx.lineTo(b.x + b.width, b.y + b.height);
      ctx.fill();

      // Lit Neon Windows on wall facades
      if (b.roofHeight > 60) {
        ctx.fillStyle = 'rgba(254, 240, 138, 0.6)';
        for (let wy = b.y + 12; wy < b.y + b.height - 12; wy += 28) {
          ctx.fillRect(b.x + b.width - 6, wy, 4, 12);
        }
      }

      // Roof Surface
      ctx.fillStyle = b.roofColor;
      ctx.fillRect(roofX, roofY, b.width, b.height);

      // Roof border highlight
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 2;
      ctx.strokeRect(roofX, roofY, b.width, b.height);

      // AC Units on roof
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(roofX + 16, roofY + 16, 24, 20);
      ctx.fillRect(roofX + b.width - 40, roofY + 20, 20, 20);

      // Glowing Rooftop Neon Billboards
      if (b.neonText) {
        ctx.save();
        ctx.font = 'bold 15px -apple-system, sans-serif';
        ctx.fillStyle = b.neonColor;
        ctx.shadowColor = b.neonColor;
        ctx.shadowBlur = 12;
        ctx.fillText(b.neonText, roofX + 16, roofY + b.height - 18);
        ctx.restore();
      }
    }

    ctx.restore();
  }

  // Draw Vehicles with headlights, brake lights, sirens, and chassis details
  function drawVehicles(state, camX, camY, zoom) {
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-camX, -camY);

    for (let v of state.vehicles) {
      ctx.save();
      ctx.translate(v.x, v.y);
      ctx.rotate(v.angle);

      // Headlight conical light beams
      if (!v.isWrecked) {
        const beamGrad = ctx.createRadialGradient(v.length / 2 + 10, 0, 10, v.length / 2 + 160, 0, 120);
        beamGrad.addColorStop(0, 'rgba(240, 249, 255, 0.45)');
        beamGrad.addColorStop(0.6, 'rgba(224, 242, 254, 0.15)');
        beamGrad.addColorStop(1, 'rgba(224, 242, 254, 0)');

        ctx.fillStyle = beamGrad;
        ctx.beginPath();
        ctx.moveTo(v.length / 2, -12);
        ctx.lineTo(v.length / 2 + 180, -75);
        ctx.lineTo(v.length / 2 + 180, 75);
        ctx.lineTo(v.length / 2, 12);
        ctx.closePath();
        ctx.fill();
      }

      // Drop shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(-v.length / 2 + 6, -v.width / 2 + 6, v.length, v.width);

      // Car body / chassis
      ctx.fillStyle = v.isWrecked ? '#262626' : v.color;
      ctx.beginPath();
      ctx.roundRect(-v.length / 2, -v.width / 2, v.length, v.width, [6, 10, 10, 6]);
      ctx.fill();

      // Windshield & rear glass (tinted cyan/black)
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-v.length * 0.22, -v.width * 0.4, v.length * 0.48, v.width * 0.8);

      // Roof panel
      ctx.fillStyle = v.isWrecked ? '#1c1917' : v.color;
      ctx.fillRect(-v.length * 0.12, -v.width * 0.35, v.length * 0.3, v.width * 0.7);

      // Headlight bulbs (front)
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(v.length / 2 - 3, -v.width / 2 + 4, 3, 7);
      ctx.fillRect(v.length / 2 - 3, v.width / 2 - 11, 3, 7);

      // Taillights (rear red glow)
      ctx.fillStyle = v.speed < 0 || v.isDrifting ? '#ef4444' : '#991b1b';
      ctx.fillRect(-v.length / 2, -v.width / 2 + 4, 3, 7);
      ctx.fillRect(-v.length / 2, v.width / 2 - 11, 3, 7);

      // Police Strobe Siren Lightbar
      if (v.isPolice && v.sirenOn) {
        const time = performance.now() / 90;
        const phase = Math.floor(time) % 2 === 0;

        // Lightbar chassis
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-4, -v.width * 0.45, 8, v.width * 0.9);

        // Flashing blue / red strobes
        ctx.fillStyle = phase ? '#3b82f6' : '#ef4444';
        ctx.shadowColor = phase ? '#3b82f6' : '#ef4444';
        ctx.shadowBlur = 18;
        ctx.fillRect(-3, -v.width * 0.38, 6, v.width * 0.35);

        ctx.fillStyle = phase ? '#ef4444' : '#3b82f6';
        ctx.shadowColor = phase ? '#ef4444' : '#3b82f6';
        ctx.fillRect(-3, v.width * 0.03, 6, v.width * 0.35);
        ctx.shadowBlur = 0;
      }

      // Wrecked vehicle fire / smoke
      if (v.isWrecked) {
        ctx.fillStyle = '#ea580c';
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    ctx.restore();
  }

  // Draw Pedestrians & Player
  function drawCharacters(state, camX, camY, zoom) {
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-camX, -camY);

    // Pedestrians
    for (let p of state.pedestrians) {
      if (p.state === 'DEAD') {
        // Dead body on ground with blood decal
        ctx.fillStyle = 'rgba(153, 27, 27, 0.7)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 12, 6, p.angle, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(0, 4, 10, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Torso / Suit
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 8, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      // Head
      ctx.fillStyle = '#fed7aa'; // Skin tone
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();

      // Weapon in hands
      if (p.weapon !== 'FISTS') {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(4, 2, 10, 3);
      }

      ctx.restore();
    }

    // Player (when on foot)
    const pl = state.player;
    if (!pl.vehicle && !pl.isDead) {
      ctx.save();
      ctx.translate(pl.x, pl.y);
      ctx.rotate(pl.angle);

      // Player Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      ctx.ellipse(0, 5, 12, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Iconic Vice City white suit shoulders
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.ellipse(0, 0, 10, 14, 0, 0, Math.PI * 2);
      ctx.fill();

      // Magenta inner shirt
      ctx.fillStyle = '#ec4899';
      ctx.fillRect(-3, -4, 6, 8);

      // Head
      ctx.fillStyle = '#fcd34d';
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();

      // Aviator sunglasses
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(2, -4, 4, 3);
      ctx.fillRect(2, 1, 4, 3);

      // Equipped Weapon
      const wep = pl.weapons[pl.currentWeaponIndex];
      if (wep !== 'FISTS') {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(6, 4, 14, 4);
      }

      ctx.restore();
    }

    ctx.restore();
  }

  // Draw Projectiles, Particles, and Pickups
  function drawCombatFX(state, camX, camY, zoom) {
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-camX, -camY);

    // Pickups (Cash, Health)
    for (let pk of state.pickups) {
      const pulse = 1 + Math.sin(performance.now() / 200) * 0.15;
      ctx.fillStyle = '#22c55e';
      ctx.shadowColor = '#22c55e';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(pk.x, pk.y, 8 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('$', pk.x - 3, pk.y + 4);
    }

    // Bullet Tracers
    ctx.lineWidth = 3;
    for (let proj of state.projectiles) {
      ctx.strokeStyle = proj.isRocket ? '#ff9e00' : '#fef08a';
      ctx.beginPath();
      ctx.moveTo(proj.x, proj.y);
      ctx.lineTo(proj.x - proj.vx * 0.02, proj.y - proj.vy * 0.02);
      ctx.stroke();
    }

    // Particles (Sparks, Smoke, Fire)
    for (let part of state.particles) {
      const alpha = part.life / part.maxLife;
      ctx.fillStyle = part.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(part.x, part.y, part.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // Mission Objective Waypoint Pulsing Beacon
    const curMission = MISSIONS[state.missionState.currentMissionIndex % MISSIONS.length];
    if (curMission && !state.missionState.isPassed) {
      const curStage = curMission.stages[state.missionState.stageIndex];
      if (curStage && curStage.target && state.poiLocations[curStage.target]) {
        const loc = state.poiLocations[curStage.target];
        const pulse = (performance.now() % 1200) / 1200;

        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#facc15';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(loc.x, loc.y, 25 + pulse * 45, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#eab308';
        ctx.beginPath();
        ctx.arc(loc.x, loc.y, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    ctx.restore();
  }

  // Heads Up Display (Minimap radar, wanted stars, health/armor, speedo, mission banners)
  function drawHUD(state) {
    const pl = state.player;

    // 1. MINIMAP RADAR (Bottom-Left)
    const radarSize = 160;
    const radarX = 110;
    const radarY = height - 110;
    const radarRadius = radarSize / 2;
    const radarScale = 0.055;

    ctx.save();
    // Clip circular radar
    ctx.beginPath();
    ctx.arc(radarX, radarY, radarRadius, 0, Math.PI * 2);
    ctx.clip();

    // Radar background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(radarX - radarRadius, radarY - radarRadius, radarSize, radarSize);

    // Draw miniature road network on radar
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
    ctx.lineWidth = 3;
    for (let rx of state.roadsX) {
      const mx = radarX + (rx - pl.x) * radarScale;
      ctx.beginPath();
      ctx.moveTo(mx, radarY - radarRadius);
      ctx.lineTo(mx, radarY + radarRadius);
      ctx.stroke();
    }
    for (let ry of state.roadsY) {
      const my = radarY + (ry - pl.y) * radarScale;
      ctx.beginPath();
      ctx.moveTo(radarX - radarRadius, my);
      ctx.lineTo(radarX + radarRadius, my);
      ctx.stroke();
    }

    // Police blips (blinking red/blue)
    for (let v of state.vehicles) {
      if (v.isPolice) {
        const mx = radarX + (v.x - pl.x) * radarScale;
        const my = radarY + (v.y - pl.y) * radarScale;
        ctx.fillStyle = (Math.floor(performance.now() / 150) % 2 === 0) ? '#ef4444' : '#3b82f6';
        ctx.beginPath();
        ctx.arc(mx, my, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Objective waypoint on radar
    const curMission = MISSIONS[state.missionState.currentMissionIndex % MISSIONS.length];
    if (curMission && !state.missionState.isPassed) {
      const curStage = curMission.stages[state.missionState.stageIndex];
      if (curStage && curStage.target && state.poiLocations[curStage.target]) {
        const loc = state.poiLocations[curStage.target];
        const mx = radarX + (loc.x - pl.x) * radarScale;
        const my = radarY + (loc.y - pl.y) * radarScale;
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(mx, my, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Player marker (center arrow)
    ctx.save();
    ctx.translate(radarX, radarY);
    ctx.rotate(pl.angle);
    ctx.fillStyle = '#06b6d4';
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-6, -5);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-6, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.restore(); // End radar clip

    // Radar Border Ring
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#06b6d4';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(radarX, radarY, radarRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 2. TOP-RIGHT STATS (Wanted Stars, Weapon, Health, Armor, Cash)
    const rightX = width - 240;
    const topY = 24;

    // Cash Display ($)
    ctx.font = '900 28px -apple-system, sans-serif';
    ctx.fillStyle = '#4ade80';
    ctx.shadowColor = '#22c55e';
    ctx.shadowBlur = 8;
    ctx.fillText(`$${String(pl.cash).padStart(7, '0')}`, rightX, topY + 24);
    ctx.shadowBlur = 0;

    // Wanted Stars (1 to 5)
    for (let s = 1; s <= 5; s++) {
      const starX = rightX + (s - 1) * 32;
      const starY = topY + 44;
      const isActive = s <= pl.wantedLevel;
      const isFlashing = pl.isEvading && Math.floor(performance.now() / 250) % 2 === 0;

      ctx.font = '24px sans-serif';
      if (isActive && !isFlashing) {
        ctx.fillStyle = '#facc15';
        ctx.shadowColor = '#facc15';
        ctx.shadowBlur = 10;
        ctx.fillText('★', starX, starY);
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = 'rgba(71, 85, 105, 0.5)';
        ctx.fillText('★', starX, starY);
      }
    }

    // Health & Armor Bars
    const barW = 160;
    const barH = 14;

    // Armor Bar (Cyan)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
    ctx.fillRect(rightX, topY + 80, barW, barH);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(rightX, topY + 80, barW * (pl.armor / 100), barH);

    // Health Bar (Pink / Red)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
    ctx.fillRect(rightX, topY + 98, barW, barH);
    ctx.fillStyle = '#f43f5e';
    ctx.fillRect(rightX, topY + 98, barW * (pl.health / 100), barH);

    // Weapon Icon & Ammo
    const curWep = WEAPON_TYPES[pl.weapons[pl.currentWeaponIndex]] || WEAPON_TYPES.PISTOL;
    ctx.font = 'bold 15px sans-serif';
    ctx.fillStyle = '#e2e8f0';
    const ammoText = curWep.isMelee ? 'MELEE' : `${pl.ammo[curWep.id]} / ∞`;
    ctx.fillText(`${curWep.name.toUpperCase()}  [${ammoText}]`, rightX, topY + 130);

    // 3. VEHICLE SPEEDOMETER (Bottom-Right when driving)
    if (pl.vehicle) {
      const v = pl.vehicle;
      const spd = Math.round(Math.abs(v.speed) * 0.22); // Convert to MPH
      const spdX = width - 150;
      const spdY = height - 80;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      ctx.roundRect(spdX - 20, spdY - 50, 150, 95, 12);
      ctx.fill();
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.font = '900 36px -apple-system, sans-serif';
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(`${spd}`, spdX + 10, spdY);

      ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('MPH', spdX + 75, spdY - 14);

      // Vehicle Health Bar
      ctx.fillStyle = '#334155';
      ctx.fillRect(spdX - 10, spdY + 16, 130, 8);
      ctx.fillStyle = v.health > 100 ? '#22c55e' : '#ef4444';
      ctx.fillRect(spdX - 10, spdY + 16, 130 * Math.max(0, v.health / v.maxHealth), 8);
    }

    // 4. TOP-CENTER OBJECTIVE BANNER
    if (state.missionState.bannerTimer > 0) {
      const bannerW = 680;
      const bannerH = 48;
      const bx = width / 2 - bannerW / 2;
      const by = 24;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.beginPath();
      ctx.roundRect(bx, by, bannerW, bannerH, 8);
      ctx.fill();
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.font = 'bold 16px -apple-system, sans-serif';
      ctx.fillStyle = '#facc15';
      ctx.textAlign = 'center';
      ctx.fillText(state.missionState.bannerText, width / 2, by + 30);
      ctx.textAlign = 'left';
    }
  }

  // Draw Title Screen with synthwave sun, palm silhouettes, and retro logo
  function drawTitleScreen() {
    ctx.fillStyle = '#090a10';
    ctx.fillRect(0, 0, width, height);

    // Glowing Retro Synthwave Sun
    const sunGrad = ctx.createLinearGradient(0, height * 0.2, 0, height * 0.65);
    sunGrad.addColorStop(0, '#facc15');
    sunGrad.addColorStop(0.5, '#f43f5e');
    sunGrad.addColorStop(1, '#8b5cf6');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(width / 2, height * 0.45, 140, 0, Math.PI * 2);
    ctx.fill();

    // Horizontal Sun Blinds
    ctx.fillStyle = '#090a10';
    for (let y = height * 0.38; y < height * 0.62; y += 12) {
      ctx.fillRect(width / 2 - 145, y, 290, 4);
    }

    // Perspective Grid Horizon
    ctx.strokeStyle = 'rgba(236, 72, 153, 0.4)';
    ctx.lineWidth = 2;
    for (let x = -width; x < width * 2; x += 60) {
      ctx.beginPath();
      ctx.moveTo(width / 2, height * 0.55);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = height * 0.56; y < height; y += (y - height * 0.5) * 0.3 + 8) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Title Logo
    ctx.textAlign = 'center';
    ctx.font = 'italic 900 68px -apple-system, sans-serif';
    ctx.fillStyle = '#06b6d4';
    ctx.shadowColor = '#06b6d4';
    ctx.shadowBlur = 25;
    ctx.fillText('NEON VICE', width / 2, height * 0.28);

    ctx.font = '900 34px -apple-system, sans-serif';
    ctx.fillStyle = '#ec4899';
    ctx.shadowColor = '#ec4899';
    ctx.shadowBlur = 15;
    ctx.fillText('S Y N D I C A T E', width / 2, height * 0.35);
    ctx.shadowBlur = 0;

    // Start Prompt
    const pulse = 0.5 + Math.sin(performance.now() / 300) * 0.5;
    ctx.font = 'bold 20px -apple-system, sans-serif';
    ctx.fillStyle = `rgba(254, 240, 138, ${0.4 + pulse * 0.6})`;
    ctx.fillText('PRESS SPACE OR CLICK TO START', width / 2, height * 0.76);

    // Controls summary
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('WASD: Move / Drive  |  F: Enter / Exit Car  |  Mouse: Aim & Shoot  |  Space: Drift  |  R: Radio', width / 2, height * 0.85);

    ctx.textAlign = 'left';
  }

  // Draw Pause Menu
  function drawPauseScreen() {
    ctx.fillStyle = 'rgba(9, 10, 16, 0.85)';
    ctx.fillRect(0, 0, width, height);

    ctx.textAlign = 'center';
    ctx.font = 'bold 44px -apple-system, sans-serif';
    ctx.fillStyle = '#06b6d4';
    ctx.shadowColor = '#06b6d4';
    ctx.shadowBlur = 15;
    ctx.fillText('GAME PAUSED', width / 2, height * 0.35);
    ctx.shadowBlur = 0;

    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText('Press [P] or [ESC] or [SPACE] to Resume', width / 2, height * 0.48);
    ctx.fillText('Press [M] to Toggle Map  |  Press [R] to Switch Radio', width / 2, height * 0.54);

    ctx.textAlign = 'left';
  }

  // Draw Wasted / Game Over Screen
  function drawGameOverScreen(state) {
    ctx.fillStyle = 'rgba(153, 27, 27, 0.45)';
    ctx.fillRect(0, 0, width, height);

    ctx.textAlign = 'center';
    ctx.font = 'italic 900 84px -apple-system, sans-serif';
    ctx.fillStyle = '#ef4444';
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 30;
    ctx.fillText('WASTED', width / 2, height * 0.45);
    ctx.shadowBlur = 0;

    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = '#f8fafc';
    ctx.fillText('PRESS SPACE OR CLICK TO RESPAWN AT HOSPITAL', width / 2, height * 0.6);

    ctx.textAlign = 'left';
  }

  // Main draw dispatch
  function draw(state, screen = SCREEN_PLAY) {
    if (screen === SCREEN_TITLE) {
      drawTitleScreen();
      return;
    }

    // Camera follow with speed lookahead & screen shake
    const pl = state.player;
    const targetCamX = pl.x + (pl.vehicle ? Math.cos(pl.vehicle.angle) * pl.vehicle.speed * 0.25 : 0);
    const targetCamY = pl.y + (pl.vehicle ? Math.sin(pl.vehicle.angle) * pl.vehicle.speed * 0.25 : 0);

    camera.x += (targetCamX - camera.x) * 0.1;
    camera.y += (targetCamY - camera.y) * 0.1;

    // Zoom out when driving fast
    const targetZoom = pl.vehicle ? Math.max(0.72, 1.0 - (Math.abs(pl.vehicle.speed) / 500) * 0.25) : 1.0;
    camera.zoom += (targetZoom - camera.zoom) * 0.05;

    // Shake decay
    let sx = 0;
    let sy = 0;
    if (camera.shake > 0) {
      sx = (Math.random() - 0.5) * camera.shake;
      sy = (Math.random() - 0.5) * camera.shake;
      camera.shake *= 0.88;
      if (camera.shake < 0.5) camera.shake = 0;
    }

    const camX = camera.x + sx;
    const camY = camera.y + sy;

    drawGround(state, camX, camY, camera.zoom);
    drawBuildings(state, camX, camY, camera.zoom);
    drawVehicles(state, camX, camY, camera.zoom);
    drawCharacters(state, camX, camY, camera.zoom);
    drawCombatFX(state, camX, camY, camera.zoom);
    drawHUD(state);

    if (screen === SCREEN_PAUSED) drawPauseScreen();
    else if (screen === SCREEN_OVER || pl.isDead) drawGameOverScreen(state);
  }

  return {
    draw,
    triggerShake,
    resize,
  };
}
