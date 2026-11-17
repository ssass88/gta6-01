// Neon Vice: Syndicate - World Simulation Engine
// Full open-world city simulation: traffic AI, pedestrian AI, police pursuit (1-5 stars),
// vehicle physics & carjacking, weapon combat & projectiles, 5 story missions, and save/load.

import {
  BLOCK_SIZE,
  MISSIONS,
  PLAYER_CONFIG,
  RADIO_STATIONS,
  ROAD_WIDTH,
  SAVE_KEY,
  SIDEWALK_WIDTH,
  STEP,
  VEHICLE_TYPES,
  WANTED_LEVELS,
  WEAPON_TYPES,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from './config.js';

export const EVENT_SHOOT = 1 << 0;
export const EVENT_EXPLODE = 1 << 1;
export const EVENT_CRASH = 1 << 2;
export const EVENT_MISSION_PASS = 1 << 3;
export const EVENT_WASTED = 1 << 4;
export const EVENT_BUSTED = 1 << 5;
export const EVENT_STAR_UP = 1 << 6;
export const EVENT_CASH = 1 << 7;

export function createWorld(random) {
  // Road grid network
  const roadsX = [400, 1100, 1800, 2500, 3200, 3900, 4500];
  const roadsY = [400, 1000, 1600, 2200, 2800, 3400, 4000];

  // Procedural Buildings
  const buildings = [];
  const poiLocations = {
    ocean_hotel: { x: 4200, y: 1200, name: 'Ocean Palms Resort' },
    viper_spot: { x: 4260, y: 1250, name: 'Red Viper GT' },
    chop_shop: { x: 750, y: 3100, name: 'Little Havana Chop Shop & Spray' },
    bank_vault: { x: 2150, y: 700, name: 'First Vice Bank' },
    convoy_spot: { x: 2500, y: 1600, name: 'Cobra Convoy Avenues' },
    briefcase_spot: { x: 2600, y: 1620, name: 'Diamond Briefcase' },
    player_safehouse: { x: 1450, y: 2500, name: 'Syndicate Safehouse' },
    docks_safehouse: { x: 3550, y: 3700, name: 'Pier Warehouse' },
    pier9: { x: 3900, y: 3500, name: 'Pier 9 Docks' },
    pier9_cache: { x: 4100, y: 3650, name: 'Military Arms Cache' },
    vance_gates: { x: 2400, y: 2200, name: 'Vance Mansion Gates' },
    mansion_courtyard: { x: 2500, y: 2200, name: 'Vance Penthouse' },
    vance_boss: { x: 2550, y: 2200, name: 'Marcus Vance' },
  };

  // Generate city blocks & architectural facades
  function generateCityLayout() {
    buildings.length = 0;
    const colors = [
      '#1c2033', '#16192b', '#20243d', '#251b2f', '#1b2d3b', '#2e1c27', '#172226'
    ];
    const roofColors = [
      '#282c44', '#1f243d', '#2d3254', '#382542', '#243c4f', '#3f2535', '#20333b'
    ];
    const neonNames = [
      'VICE TOWER', 'HOTEL DEL MAR', 'CLUB FLAMINGO', 'PARADISE SUITES',
      'COBRA IMPORT', 'TROPIC MOTEL', 'SYNDICATE PLAZA', 'NEON HORIZON'
    ];

    for (let i = 0; i < roadsX.length - 1; i++) {
      for (let j = 0; j < roadsY.length - 1; j++) {
        const x1 = roadsX[i] + ROAD_WIDTH / 2 + SIDEWALK_WIDTH;
        const x2 = roadsX[i + 1] - ROAD_WIDTH / 2 - SIDEWALK_WIDTH;
        const y1 = roadsY[j] + ROAD_WIDTH / 2 + SIDEWALK_WIDTH;
        const y2 = roadsY[j + 1] - ROAD_WIDTH / 2 - SIDEWALK_WIDTH;
        const blockW = x2 - x1;
        const blockH = y2 - y1;

        if (blockW > 100 && blockH > 100) {
          // Subdivide block into 1 to 4 buildings
          const splitX = blockW > 280;
          const splitY = blockH > 280;
          const cols = splitX ? 2 : 1;
          const rows = splitY ? 2 : 1;
          const subW = blockW / cols;
          const subH = blockH / rows;

          for (let c = 0; c < cols; c++) {
            for (let r = 0; r < rows; r++) {
              const bx = x1 + c * subW + 8;
              const by = y1 + r * subH + 8;
              const bw = subW - 16;
              const bh = subH - 16;

              const isDowntown = bx > 1500 && bx < 3500 && by < 1500;
              const roofHeight = isDowntown ? random.range(80, 160) : random.range(35, 75);
              const colorIdx = random.int(0, colors.length - 1);

              buildings.push({
                x: bx,
                y: by,
                width: bw,
                height: bh,
                roofHeight,
                color: colors[colorIdx],
                roofColor: roofColors[colorIdx],
                neonText: random.next() > 0.65 ? random.choice(neonNames) : null,
                neonColor: random.choice(['#ff2a6d', '#05d9e8', '#ffd15c', '#800080']),
              });
            }
          }
        }
      }
    }
  }

  // Active Entities
  let player = null;
  const vehicles = [];
  const pedestrians = [];
  const projectiles = [];
  const particles = [];
  const tireTracks = [];
  const pickups = [];

  // Mission & Game State
  let missionState = {
    currentMissionIndex: 0,
    stageIndex: 0,
    stageTimer: 0,
    killsCount: 0,
    targetEntity: null,
    objectiveText: '',
    isPassed: false,
    bannerText: '',
    bannerTimer: 0,
  };

  let helicopter = null; // 5-Star police helicopter spotlight

  function createPlayer() {
    return {
      x: 4200,
      y: 1350,
      angle: -Math.PI / 2,
      vx: 0,
      vy: 0,
      speed: 0,
      health: PLAYER_CONFIG.maxHealth,
      armor: 50,
      cash: 1500,
      vehicle: null,
      weapons: ['FISTS', 'PISTOL', 'SMG'],
      currentWeaponIndex: 1, // Vice-9 Pistol
      ammo: {
        FISTS: Infinity,
        PISTOL: 60,
        SMG: 120,
        SHOTGUN: 0,
        RIFLE: 0,
        ROCKET: 0,
      },
      lastFireTime: 0,
      wantedLevel: 0,
      wantedStarsCooldown: 0,
      isEvading: false,
      isDead: false,
      isBusted: false,
      stats: { kills: 0, carsStolen: 0, cashEarned: 0 },
    };
  }

  function spawnVehicle(typeKey, x, y, angle = 0, isPlayerCar = false) {
    const proto = VEHICLE_TYPES[typeKey] || VEHICLE_TYPES.SENTINEL;
    const v = {
      id: Math.random().toString(36).slice(2, 9),
      typeKey,
      name: proto.name,
      x,
      y,
      angle,
      vx: 0,
      vy: 0,
      speed: 0,
      steer: 0,
      throttle: 0,
      brake: 0,
      width: proto.width,
      length: proto.length,
      maxSpeed: proto.maxSpeed,
      accel: proto.accel,
      brakeForce: proto.brake,
      reverseSpeed: proto.reverseSpeed,
      steerRate: proto.steerRate,
      grip: proto.grip,
      driftGrip: proto.driftGrip,
      mass: proto.mass,
      health: proto.maxHealth,
      maxHealth: proto.maxHealth,
      isPolice: proto.isPolice || false,
      hasSiren: proto.hasSiren || false,
      sirenOn: proto.hasSiren || false,
      sirenPhase: 0,
      color: random.choice(proto.colors),
      isPlayerCar,
      isWrecked: false,
      isDrifting: false,
      smokeCooldown: 0,
    };
    vehicles.push(v);
    return v;
  }

  function spawnPedestrian(x, y, role = 'CIVILIAN', weapon = 'FISTS') {
    const ped = {
      id: Math.random().toString(36).slice(2, 9),
      x,
      y,
      angle: random.range(0, Math.PI * 2),
      vx: 0,
      vy: 0,
      speed: random.range(50, 85),
      role, // 'CIVILIAN' | 'GANG' | 'COP' | 'SWAT' | 'BOSS'
      weapon,
      health: role === 'BOSS' ? 450 : role === 'SWAT' ? 140 : 80,
      maxHealth: role === 'BOSS' ? 450 : role === 'SWAT' ? 140 : 80,
      state: 'WALKING', // 'WALKING' | 'FLEEING' | 'ATTACKING' | 'DEAD'
      target: null,
      bark: null,
      barkTimer: 0,
      shootCooldown: random.range(0.5, 1.5),
      color:
        role === 'COP'
          ? '#1e3a8a'
          : role === 'SWAT'
          ? '#0f172a'
          : role === 'GANG'
          ? '#7f1d1d'
          : role === 'BOSS'
          ? '#f59e0b'
          : random.choice(['#f43f5e', '#06b6d4', '#eab308', '#8b5cf6', '#10b981']),
    };
    pedestrians.push(ped);
    return ped;
  }

  // Populate initial city life
  function populateCity() {
    vehicles.length = 0;
    pedestrians.length = 0;
    projectiles.length = 0;
    pickups.length = 0;

    // Ambient traffic on roads
    for (let i = 0; i < roadsX.length; i++) {
      const rx = roadsX[i];
      for (let k = 0; k < 3; k++) {
        const ry = random.range(300, WORLD_HEIGHT - 300);
        const types = ['VIPER_GT', 'STALLION_77', 'SENTINEL', 'MULE'];
        spawnVehicle(random.choice(types), rx + 24, ry, Math.PI / 2);
        spawnVehicle(random.choice(types), rx - 24, ry + 200, -Math.PI / 2);
      }
    }
    for (let j = 0; j < roadsY.length; j++) {
      const ry = roadsY[j];
      for (let k = 0; k < 3; k++) {
        const rx = random.range(300, WORLD_WIDTH - 300);
        const types = ['VIPER_GT', 'STALLION_77', 'SENTINEL'];
        spawnVehicle(random.choice(types), rx, ry + 24, 0);
        spawnVehicle(random.choice(types), rx + 250, ry - 24, Math.PI);
      }
    }

    // Pedestrians on sidewalks
    for (let i = 0; i < 45; i++) {
      const rx = random.choice(roadsX) + (random.next() > 0.5 ? 54 : -54);
      const ry = random.range(300, WORLD_HEIGHT - 300);
      spawnPedestrian(rx, ry, 'CIVILIAN');
    }

    // Story Mission 1 Red Viper GT
    spawnVehicle('VIPER_GT', poiLocations.viper_spot.x, poiLocations.viper_spot.y, -Math.PI / 2);
  }

  function reset() {
    generateCityLayout();
    player = createPlayer();
    populateCity();
    loadProgress();
    setupMission(missionState.currentMissionIndex || 0);
  }

  function loadProgress() {
    try {
      const raw = window.localStorage?.getItem(SAVE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.cash !== undefined) player.cash = data.cash;
        if (data.missionIndex !== undefined) missionState.currentMissionIndex = data.missionIndex;
        if (data.weapons) player.weapons = data.weapons;
        if (data.ammo) player.ammo = { ...player.ammo, ...data.ammo };
      }
    } catch {}
  }

  function saveProgress() {
    try {
      const payload = {
        cash: player.cash,
        missionIndex: missionState.currentMissionIndex,
        weapons: player.weapons,
        ammo: player.ammo,
      };
      window.localStorage?.setItem(SAVE_KEY, JSON.stringify(payload));
    } catch {}
  }

  function setupMission(index) {
    const mission = MISSIONS[index % MISSIONS.length];
    missionState.currentMissionIndex = index;
    missionState.stageIndex = 0;
    missionState.stageTimer = 0;
    missionState.killsCount = 0;
    missionState.isPassed = false;
    missionState.objectiveText = mission.stages[0]?.text || '';
    missionState.bannerText = `${mission.title}: ${mission.briefing}`;
    missionState.bannerTimer = 5.0;

    // Specific mission spawns
    if (index === 1) {
      // Cobra Convoy
      const convoyCar = spawnVehicle('STALLION_77', poiLocations.convoy_spot.x, poiLocations.convoy_spot.y, 0);
      convoyCar.color = '#7f1d1d';
      spawnPedestrian(convoyCar.x + 35, convoyCar.y, 'GANG', 'SMG');
      spawnPedestrian(convoyCar.x - 35, convoyCar.y, 'GANG', 'PISTOL');
    } else if (index === 2) {
      // Bank Heist - spawn guards
      for (let g = 0; g < 4; g++) {
        spawnPedestrian(poiLocations.bank_vault.x + (g - 1.5) * 40, poiLocations.bank_vault.y + 60, 'COP', 'PISTOL');
      }
    } else if (index === 3) {
      // Arms Deal Docks - spawn 8 mercs
      for (let m = 0; m < 8; m++) {
        spawnPedestrian(poiLocations.pier9.x + (m % 4) * 50 - 80, poiLocations.pier9.y + Math.floor(m / 4) * 60, 'GANG', 'RIFLE');
      }
    } else if (index === 4) {
      // Finale - Marcus Vance & bodyguards
      for (let v = 0; v < 10; v++) {
        spawnPedestrian(poiLocations.mansion_courtyard.x + (v % 5) * 45 - 90, poiLocations.mansion_courtyard.y + (v > 4 ? 60 : -60), 'SWAT', 'RIFLE');
      }
      spawnPedestrian(poiLocations.vance_boss.x, poiLocations.vance_boss.y, 'BOSS', 'ROCKET');
    }
  }

  function advanceMissionStage(events) {
    const mission = MISSIONS[missionState.currentMissionIndex % MISSIONS.length];
    missionState.stageIndex++;

    if (missionState.stageIndex >= mission.stages.length) {
      // Mission Complete!
      missionState.isPassed = true;
      player.cash += mission.rewardCash;
      player.stats.cashEarned += mission.rewardCash;
      missionState.bannerText = `MISSION ACCOMPLISHED! +$${mission.rewardCash.toLocaleString()}`;
      missionState.bannerTimer = 6.0;
      missionState.currentMissionIndex++;
      saveProgress();
      return events | EVENT_MISSION_PASS | EVENT_CASH;
    } else {
      const nextStage = mission.stages[missionState.stageIndex];
      missionState.objectiveText = nextStage.text;
      missionState.bannerText = `OBJECTIVE: ${nextStage.text}`;
      missionState.bannerTimer = 4.0;
      if (nextStage.forceWanted) {
        player.wantedLevel = Math.max(player.wantedLevel, nextStage.forceWanted);
        events |= EVENT_STAR_UP;
      }
      return events;
    }
  }

  // Check collision between a point/circle and all building walls
  function checkBuildingCollision(x, y, radius = 10) {
    for (let i = 0; i < buildings.length; i++) {
      const b = buildings[i];
      if (
        x + radius > b.x &&
        x - radius < b.x + b.width &&
        y + radius > b.y &&
        y - radius < b.y + b.height
      ) {
        return b;
      }
    }
    return null;
  }

  // Handle firing a weapon
  function firePlayerWeapon(targetAngle) {
    const weaponId = player.weapons[player.currentWeaponIndex];
    const w = WEAPON_TYPES[weaponId];
    if (!w) return 0;

    const now = performance.now() / 1000;
    if (now - player.lastFireTime < w.fireRate) return 0;
    player.lastFireTime = now;

    if (!w.isMelee) {
      if (player.ammo[weaponId] <= 0) return 0;
      player.ammo[weaponId]--;
    }

    // Public shooting triggers crime detection (2 stars)
    if (player.wantedLevel < 2) {
      player.wantedLevel = 2;
      player.wantedStarsCooldown = WANTED_LEVELS[2].cooldown;
    }

    const startX = player.vehicle ? player.vehicle.x : player.x;
    const startY = player.vehicle ? player.vehicle.y : player.y;

    if (w.isMelee) {
      // Punch hitbox
      const hitX = startX + Math.cos(targetAngle) * w.range;
      const hitY = startY + Math.sin(targetAngle) * w.range;
      for (let p of pedestrians) {
        if (p.state !== 'DEAD' && Math.hypot(p.x - hitX, p.y - hitY) < 32) {
          p.health -= w.damage;
          if (p.health <= 0) {
            p.state = 'DEAD';
            player.stats.kills++;
            pickups.push({ x: p.x, y: p.y, type: 'CASH', value: random.int(25, 100) });
          }
          break;
        }
      }
      return EVENT_SHOOT;
    }

    // Gun projectile spawn
    const pelletCount = w.pellets || 1;
    for (let i = 0; i < pelletCount; i++) {
      const spread = (random.next() - 0.5) * w.spread;
      const angle = targetAngle + spread;
      projectiles.push({
        x: startX + Math.cos(angle) * 20,
        y: startY + Math.sin(angle) * 20,
        vx: Math.cos(angle) * w.speed,
        vy: Math.sin(angle) * w.speed,
        damage: w.damage,
        isRocket: weaponId === 'ROCKET',
        splashRadius: w.splashRadius || 0,
        life: w.range / w.speed,
        isPlayer: true,
      });
    }

    // Muzzle flash particle
    particles.push({
      x: startX + Math.cos(targetAngle) * 24,
      y: startY + Math.sin(targetAngle) * 24,
      vx: 0,
      vy: 0,
      radius: 8,
      color: '#ffd15c',
      life: 0.06,
      maxLife: 0.06,
    });

    return EVENT_SHOOT;
  }

  // Update loop (fixed STEP = 1/60)
  function step(dt, inputState) {
    let events = 0;
    if (player.isDead || player.isBusted) return events;

    // 1. Mission Stage Checking
    const curMission = MISSIONS[missionState.currentMissionIndex % MISSIONS.length];
    if (curMission && !missionState.isPassed) {
      const curStage = curMission.stages[missionState.stageIndex];
      if (curStage) {
        if (curStage.target && poiLocations[curStage.target]) {
          const loc = poiLocations[curStage.target];
          const dist = Math.hypot(player.x - loc.x, player.y - loc.y);
          if (dist < 90) {
            if (curStage.holdDuration) {
              missionState.stageTimer += dt;
              if (missionState.stageTimer >= curStage.holdDuration) {
                events = advanceMissionStage(events);
              }
            } else if (!curStage.needLosePolice || player.wantedLevel === 0) {
              events = advanceMissionStage(events);
            }
          }
        } else if (curStage.needLosePolice && player.wantedLevel === 0) {
          events = advanceMissionStage(events);
        } else if (curStage.targetKills && missionState.killsCount >= curStage.targetKills) {
          events = advanceMissionStage(events);
        }
      }
    }

    if (missionState.bannerTimer > 0) {
      missionState.bannerTimer -= dt;
    }

    // 2. Wanted Level Cooldown & Police Evading
    if (player.wantedLevel > 0) {
      // Count police in proximity
      let nearbyCops = 0;
      for (let v of vehicles) {
        if (v.isPolice && !v.isWrecked && Math.hypot(v.x - player.x, v.y - player.y) < 650) {
          nearbyCops++;
        }
      }
      for (let p of pedestrians) {
        if ((p.role === 'COP' || p.role === 'SWAT') && p.state !== 'DEAD' && Math.hypot(p.x - player.x, p.y - player.y) < 550) {
          nearbyCops++;
        }
      }

      if (nearbyCops === 0) {
        player.isEvading = true;
        player.wantedStarsCooldown -= dt;
        if (player.wantedStarsCooldown <= 0) {
          player.wantedLevel = Math.max(0, player.wantedLevel - 1);
          player.wantedStarsCooldown = player.wantedLevel > 0 ? WANTED_LEVELS[player.wantedLevel].cooldown : 0;
        }
      } else {
        player.isEvading = false;
        player.wantedStarsCooldown = WANTED_LEVELS[player.wantedLevel].cooldown;
      }
    }

    // 3. Player Movement & Actions
    if (!player.vehicle) {
      // ON FOOT
      const move = inputState.moveVector || { x: 0, y: 0 };
      const isSprinting = inputState.isSprinting;
      const speed = isSprinting ? PLAYER_CONFIG.sprintSpeed : PLAYER_CONFIG.walkSpeed;

      const targetX = player.x + move.x * speed * dt;
      const targetY = player.y + move.y * speed * dt;

      // Building collision for player
      if (!checkBuildingCollision(targetX, player.y, PLAYER_CONFIG.radius)) {
        player.x = targetX;
      }
      if (!checkBuildingCollision(player.x, targetY, PLAYER_CONFIG.radius)) {
        player.y = targetY;
      }

      // Bound to world
      player.x = Math.max(50, Math.min(WORLD_WIDTH - 50, player.x));
      player.y = Math.max(50, Math.min(WORLD_HEIGHT - 50, player.y));

      // Aim angle
      player.angle = inputState.aimAngle ?? player.angle;

      // Shooting
      if (inputState.isShooting) {
        events |= firePlayerWeapon(player.angle);
      }

      // Enter Vehicle (Action)
      if (inputState.enterVehicle) {
        let bestDist = PLAYER_CONFIG.enterVehicleRadius;
        let chosenCar = null;
        for (let v of vehicles) {
          if (v.isWrecked) continue;
          const d = Math.hypot(v.x - player.x, v.y - player.y);
          if (d < bestDist) {
            bestDist = d;
            chosenCar = v;
          }
        }
        if (chosenCar) {
          player.vehicle = chosenCar;
          chosenCar.isPlayerCar = true;
          player.stats.carsStolen++;
          if (chosenCar.isPolice && player.wantedLevel === 0) {
            player.wantedLevel = 1;
            player.wantedStarsCooldown = WANTED_LEVELS[1].cooldown;
            events |= EVENT_STAR_UP;
          }
        }
      }
    } else {
      // IN VEHICLE
      const car = player.vehicle;
      const steerInput = inputState.moveVector.x;
      const throttleInput = -inputState.moveVector.y; // W = forward (+), S = reverse (-)
      const handbrake = inputState.isHandbrake;

      // Steering
      if (Math.abs(car.speed) > 10) {
        const dir = car.speed > 0 ? 1 : -1;
        car.angle += steerInput * car.steerRate * dir * dt;
      }

      // Acceleration / Braking
      if (throttleInput > 0) {
        if (car.speed < 0) {
          car.speed += car.brakeForce * dt;
        } else {
          car.speed += car.accel * dt;
        }
      } else if (throttleInput < 0) {
        if (car.speed > 0) {
          car.speed -= car.brakeForce * dt;
        } else {
          car.speed -= car.accel * 0.7 * dt;
        }
      } else {
        // Natural friction coasting
        car.speed *= Math.pow(0.85, dt * 60);
      }

      // Clamp speed
      car.speed = Math.max(-car.reverseSpeed, Math.min(car.maxSpeed, car.speed));

      // Drift & Slip
      car.isDrifting = handbrake && Math.abs(car.speed) > 100;
      const currentGrip = car.isDrifting ? car.driftGrip : car.grip;

      // Velocity components
      const forwardX = Math.cos(car.angle) * car.speed;
      const forwardY = Math.sin(car.angle) * car.speed;
      car.vx = car.vx * (1 - currentGrip) + forwardX * currentGrip;
      car.vy = car.vy * (1 - currentGrip) + forwardY * currentGrip;

      // Tire marks and smoke on drift
      if (car.isDrifting) {
        tireTracks.push({
          x: car.x - Math.cos(car.angle) * (car.length / 2 - 8),
          y: car.y - Math.sin(car.angle) * (car.length / 2 - 8),
          angle: car.angle,
          alpha: 0.55,
        });
        if (tireTracks.length > 250) tireTracks.shift();

        particles.push({
          x: car.x - Math.cos(car.angle) * 30 + (random.next() - 0.5) * 15,
          y: car.y - Math.sin(car.angle) * 30 + (random.next() - 0.5) * 15,
          vx: (random.next() - 0.5) * 40,
          vy: (random.next() - 0.5) * 40,
          radius: random.range(5, 12),
          color: 'rgba(230,230,230,0.4)',
          life: 0.35,
          maxLife: 0.35,
        });
      }

      // Move vehicle
      const newX = car.x + car.vx * dt;
      const newY = car.y + car.vy * dt;

      // Check collision with buildings
      const hitB = checkBuildingCollision(newX, newY, car.width / 2);
      if (hitB) {
        car.speed = -car.speed * 0.35;
        car.health -= Math.abs(car.speed) * 0.2;
        events |= EVENT_CRASH;
      } else {
        car.x = newX;
        car.y = newY;
      }

      // Sync player position with car
      player.x = car.x;
      player.y = car.y;
      player.angle = car.angle;

      // Exit Vehicle (Action)
      if (inputState.enterVehicle) {
        player.x = car.x + Math.cos(car.angle + Math.PI / 2) * (car.width / 2 + 20);
        player.y = car.y + Math.sin(car.angle + Math.PI / 2) * (car.width / 2 + 20);
        car.isPlayerCar = false;
        player.vehicle = null;
      }

      // Pay 'N' Spray / Chop Shop trigger
      const chopLoc = poiLocations.chop_shop;
      if (Math.hypot(car.x - chopLoc.x, car.y - chopLoc.y) < 80) {
        if (player.wantedLevel > 0 && player.cash >= 250) {
          player.cash -= 250;
          player.wantedLevel = 0;
          car.color = random.choice(VEHICLE_TYPES[car.typeKey]?.colors || ['#05d9e8']);
          car.health = car.maxHealth;
          missionState.bannerText = "VEHICLE REPAINTED & REPAIRED! WANTED LEVEL CLEARED!";
          missionState.bannerTimer = 4.0;
          events |= EVENT_CASH;
        }
      }
    }

    // 4. Vehicle Collision with Pedestrians & Other Cars
    for (let v of vehicles) {
      if (v.isWrecked) continue;
      // Hit pedestrians
      if (Math.abs(v.speed) > 80) {
        for (let p of pedestrians) {
          if (p.state !== 'DEAD' && Math.hypot(v.x - p.x, v.y - p.y) < v.width / 2 + 12) {
            p.health = 0;
            p.state = 'DEAD';
            pickups.push({ x: p.x, y: p.y, type: 'CASH', value: random.int(20, 80) });
            // Crime trigger if player drove
            if (v.isPlayerCar && player.wantedLevel < 1) {
              player.wantedLevel = 1;
              player.wantedStarsCooldown = WANTED_LEVELS[1].cooldown;
              events |= EVENT_STAR_UP;
            }
          }
        }
      }

      // Car-to-Car collisions
      for (let o of vehicles) {
        if (o === v || o.isWrecked) continue;
        const dist = Math.hypot(v.x - o.x, v.y - o.y);
        const minDist = (v.length + o.length) * 0.35;
        if (dist < minDist && dist > 0) {
          const nx = (v.x - o.x) / dist;
          const ny = (v.y - o.y) / dist;
          const overlap = minDist - dist;
          v.x += nx * overlap * 0.5;
          v.y += ny * overlap * 0.5;
          o.x -= nx * overlap * 0.5;
          o.y -= ny * overlap * 0.5;
          v.speed *= 0.6;
          o.speed *= 0.6;
        }
      }

      // Vehicle health check
      if (v.health <= 0 && !v.isWrecked) {
        v.isWrecked = true;
        v.speed = 0;
        events |= EVENT_EXPLODE;
        // Big Explosion
        for (let e = 0; e < 25; e++) {
          particles.push({
            x: v.x + (random.next() - 0.5) * 30,
            y: v.y + (random.next() - 0.5) * 30,
            vx: (random.next() - 0.5) * 160,
            vy: (random.next() - 0.5) * 160,
            radius: random.range(8, 22),
            color: random.choice(['#ff2a6d', '#ff9e00', '#ffd15c', '#333']),
            life: random.range(0.3, 0.7),
            maxLife: 0.7,
          });
        }
        if (player.vehicle === v) {
          player.health = 0;
          player.isDead = true;
          events |= EVENT_WASTED;
        }
      }
    }

    // 5. Police Dispatch & AI Pursuit
    if (player.wantedLevel > 0) {
      const wantedRule = WANTED_LEVELS[player.wantedLevel] || WANTED_LEVELS[1];
      let activePoliceCars = 0;
      for (let v of vehicles) {
        if (v.isPolice && !v.isWrecked) {
          activePoliceCars++;
          // Chase player
          const dx = player.x - v.x;
          const dy = player.y - v.y;
          const targetAngle = Math.atan2(dy, dx);
          v.angle += Math.sign(Math.sin(targetAngle - v.angle)) * v.steerRate * dt;
          v.speed = Math.min(v.maxSpeed, v.speed + v.accel * dt);
          v.x += Math.cos(v.angle) * v.speed * dt;
          v.y += Math.sin(v.angle) * v.speed * dt;
          v.sirenOn = true;
        }
      }

      // Spawn police if under quota
      if (activePoliceCars < wantedRule.dispatch && vehicles.length < 50) {
        const spawnDist = random.range(600, 900);
        const spawnAngle = random.range(0, Math.PI * 2);
        const px = player.x + Math.cos(spawnAngle) * spawnDist;
        const py = player.y + Math.sin(spawnAngle) * spawnDist;
        if (px > 200 && px < WORLD_WIDTH - 200 && py > 200 && py < WORLD_HEIGHT - 200) {
          const type = player.wantedLevel >= 4 ? 'SWAT_ENFORCER' : 'POLICE_INTERCEPTOR';
          spawnVehicle(type, px, py, spawnAngle + Math.PI);
        }
      }
    }

    // 6. Ambient Traffic AI
    for (let v of vehicles) {
      if (v.isPlayerCar || v.isPolice || v.isWrecked) continue;
      // Cruise in lane
      v.speed = Math.min(180, v.speed + 60 * dt);
      v.x += Math.cos(v.angle) * v.speed * dt;
      v.y += Math.sin(v.angle) * v.speed * dt;

      // Wrap or turn at world edge
      if (v.x < 150 || v.x > WORLD_WIDTH - 150 || v.y < 150 || v.y > WORLD_HEIGHT - 150) {
        v.angle += Math.PI;
      }
    }

    // 7. Pedestrian AI & Combat
    for (let p of pedestrians) {
      if (p.state === 'DEAD') continue;

      if (p.role === 'COP' || p.role === 'SWAT' || (p.role === 'GANG' && Math.hypot(p.x - player.x, p.y - player.y) < 400)) {
        // Combatant AI
        const dist = Math.hypot(player.x - p.x, player.y - p.y);
        const angle = Math.atan2(player.y - p.y, player.x - p.x);
        p.angle = angle;

        if (dist > 180) {
          // Approach
          p.x += Math.cos(angle) * p.speed * dt;
          p.y += Math.sin(angle) * p.speed * dt;
        }

        // Shoot at player
        p.shootCooldown -= dt;
        if (p.shootCooldown <= 0 && dist < 450) {
          p.shootCooldown = p.role === 'SWAT' ? 0.4 : 0.85;
          projectiles.push({
            x: p.x + Math.cos(angle) * 15,
            y: p.y + Math.sin(angle) * 15,
            vx: Math.cos(angle) * 850,
            vy: Math.sin(angle) * 850,
            damage: p.role === 'SWAT' ? 18 : 12,
            isRocket: false,
            life: 0.6,
            isPlayer: false,
          });
        }
      } else {
        // Civilian walking / fleeing
        if (p.state === 'FLEEING') {
          p.x += Math.cos(p.angle) * (p.speed * 1.8) * dt;
          p.y += Math.sin(p.angle) * (p.speed * 1.8) * dt;
        } else {
          p.x += Math.cos(p.angle) * p.speed * dt;
          p.y += Math.sin(p.angle) * p.speed * dt;
          if (random.next() < 0.005) {
            p.angle += (random.next() - 0.5) * 1.5;
          }
        }
      }
    }

    // 8. Projectiles Simulation
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const proj = projectiles[i];
      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;
      proj.life -= dt;

      let hit = false;

      // Hit buildings
      if (checkBuildingCollision(proj.x, proj.y, 4)) {
        hit = true;
      }

      // Hit vehicles
      if (!hit) {
        for (let v of vehicles) {
          if (v.isWrecked) continue;
          if (Math.hypot(v.x - proj.x, v.y - proj.y) < v.width / 2 + 8) {
            v.health -= proj.damage;
            hit = true;
            break;
          }
        }
      }

      // Hit pedestrians
      if (!hit && proj.isPlayer) {
        for (let p of pedestrians) {
          if (p.state !== 'DEAD' && Math.hypot(p.x - proj.x, p.y - proj.y) < 18) {
            p.health -= proj.damage;
            hit = true;
            if (p.health <= 0) {
              p.state = 'DEAD';
              player.stats.kills++;
              missionState.killsCount++;
              pickups.push({ x: p.x, y: p.y, type: 'CASH', value: random.int(30, 120) });
              if (p.role === 'COP' || p.role === 'SWAT') {
                player.wantedLevel = Math.max(player.wantedLevel, 3);
                player.wantedStarsCooldown = WANTED_LEVELS[3].cooldown;
                events |= EVENT_STAR_UP;
              }
            }
            break;
          }
        }
      }

      // Hit player (from enemy projectile)
      if (!hit && !proj.isPlayer) {
        if (Math.hypot(player.x - proj.x, player.y - proj.y) < PLAYER_CONFIG.radius + 6) {
          hit = true;
          if (player.armor > 0) {
            const absorbed = Math.min(player.armor, proj.damage);
            player.armor -= absorbed;
            player.health -= proj.damage - absorbed;
          } else {
            player.health -= proj.damage;
          }
          if (player.health <= 0) {
            player.isDead = true;
            events |= EVENT_WASTED;
          }
        }
      }

      if (hit || proj.life <= 0) {
        if (proj.isRocket) {
          events |= EVENT_EXPLODE;
          // Area splash
          for (let v of vehicles) {
            const d = Math.hypot(v.x - proj.x, v.y - proj.y);
            if (d < proj.splashRadius) v.health -= proj.damage * (1 - d / proj.splashRadius);
          }
          for (let p of pedestrians) {
            const d = Math.hypot(p.x - proj.x, p.y - proj.y);
            if (d < proj.splashRadius && p.state !== 'DEAD') p.health = 0;
          }
        }
        projectiles.splice(i, 1);
      }
    }

    // 9. Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const part = particles[i];
      part.x += part.vx * dt;
      part.y += part.vy * dt;
      part.life -= dt;
      if (part.life <= 0) particles.splice(i, 1);
    }

    // 10. Pickups
    for (let i = pickups.length - 1; i >= 0; i--) {
      const pk = pickups[i];
      if (Math.hypot(player.x - pk.x, player.y - pk.y) < 32) {
        if (pk.type === 'CASH') {
          player.cash += pk.value;
          player.stats.cashEarned += pk.value;
          events |= EVENT_CASH;
        }
        pickups.splice(i, 1);
      }
    }

    return events;
  }

  return {
    state: {
      get player() { return player; },
      get vehicles() { return vehicles; },
      get pedestrians() { return pedestrians; },
      get projectiles() { return projectiles; },
      get particles() { return particles; },
      get tireTracks() { return tireTracks; },
      get pickups() { return pickups; },
      get buildings() { return buildings; },
      get roadsX() { return roadsX; },
      get roadsY() { return roadsY; },
      get poiLocations() { return poiLocations; },
      get missionState() { return missionState; },
    },
    reset,
    step,
    setupMission,
    spawnVehicle,
    spawnPedestrian,
    saveProgress,
    loadProgress,
  };
}
