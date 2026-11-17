// Neon Vice: Syndicate - Deterministic Screenshot Scenes
// Staged scenes behind ?shot=city|driving|police-chase|mission.
// Each sets up a rich cinematic frame demonstrating the open world, driving, police AI, and mission combat.

import { SCREEN_PLAY } from './render.js';
import { VEHICLE_TYPES } from './config.js';

export function stageShot(name, world) {
  world.reset();
  const state = world.state;
  const pl = state.player;

  if (name === 'city') {
    // 1-city.png: Sun-soaked Ocean Beach Promenade
    // Player on foot beside red Viper GT, palm trees, pedestrians, ocean water, neon hotel
    pl.x = 4220;
    pl.y = 1260;
    pl.angle = -Math.PI / 2;
    pl.vehicle = null;
    pl.health = 100;
    pl.armor = 80;
    pl.cash = 45200;
    pl.currentWeaponIndex = 1; // Vice-9 Pistol

    // Red Viper GT parked beside player
    const viper = world.spawnVehicle('VIPER_GT', 4260, 1260, -Math.PI / 2);
    viper.color = '#ff2a6d';

    // Ambient traffic on Ocean Drive
    const cruiser = world.spawnVehicle('SENTINEL', 4260, 1080, -Math.PI / 2);
    cruiser.color = '#05d9e8';
    const muscle = world.spawnVehicle('STALLION_77', 4220, 1420, Math.PI / 2);
    muscle.color = '#ffd15c';

    // Civilians strolling along sidewalk promenade
    world.spawnPedestrian(4190, 1200, 'CIVILIAN');
    world.spawnPedestrian(4200, 1290, 'CIVILIAN');
    world.spawnPedestrian(4180, 1340, 'CIVILIAN');
    world.spawnPedestrian(4210, 1140, 'CIVILIAN');

    state.missionState.bannerText = 'OCEAN DRIVE: Meet Jax at the Neon Palms Diner';
    state.missionState.bannerTimer = 10.0;
  } else if (name === 'driving') {
    // 2-driving.png: High-Speed Downtown Drift
    // Viper GT drifting at high speed with tire smoke, headlights blazing, skyscrapers
    pl.x = 2500;
    pl.y = 1600;
    pl.angle = -0.4;
    pl.cash = 68400;

    const car = world.spawnVehicle('VIPER_GT', 2500, 1600, -0.4, true);
    car.color = '#ff2a6d';
    car.speed = 380;
    car.vx = Math.cos(car.angle) * 380;
    car.vy = Math.sin(car.angle) * 380;
    car.isDrifting = true;
    pl.vehicle = car;

    // Passing civilian vehicles
    const sedan = world.spawnVehicle('SENTINEL', 2460, 1420, -Math.PI / 2);
    sedan.color = '#475569';
    sedan.speed = 140;

    const truck = world.spawnVehicle('MULE', 2540, 1800, Math.PI / 2);
    truck.color = '#e2e8f0';

    // Tire smoke and skidmark particles
    for (let i = 0; i < 18; i++) {
      state.tireTracks.push({
        x: car.x - 30 + (Math.random() - 0.5) * 15,
        y: car.y + 10 + (Math.random() - 0.5) * 15,
        alpha: 0.65,
      });
      state.particles.push({
        x: car.x - 35 + (Math.random() - 0.5) * 20,
        y: car.y + 12 + (Math.random() - 0.5) * 20,
        vx: -60 + (Math.random() - 0.5) * 30,
        vy: 20 + (Math.random() - 0.5) * 30,
        radius: 8 + Math.random() * 8,
        color: 'rgba(240, 240, 240, 0.45)',
        life: 0.5,
        maxLife: 0.5,
      });
    }

    state.missionState.bannerText = '♫ RADIO: Vice Wave 80s - Midnight Cruise';
    state.missionState.bannerTimer = 10.0;
  } else if (name === 'police-chase') {
    // 3-police-chase.png: 4-Star Tactical Police & SWAT Pursuit
    // Multiple VCPD Interceptors and SWAT Enforcer with flashing lightbars
    pl.x = 1800;
    pl.y = 2200;
    pl.angle = Math.PI / 2;
    pl.wantedLevel = 4;
    pl.cash = 92000;

    const getawayCar = world.spawnVehicle('STALLION_77', 1800, 2200, Math.PI / 2, true);
    getawayCar.color = '#d90429';
    getawayCar.speed = 340;
    pl.vehicle = getawayCar;

    // Pursuing police cruisers with active flashing sirens
    const cop1 = world.spawnVehicle('POLICE_INTERCEPTOR', 1780, 2020, Math.PI / 2);
    cop1.sirenOn = true;
    cop1.speed = 350;

    const cop2 = world.spawnVehicle('POLICE_INTERCEPTOR', 1830, 1960, Math.PI / 2);
    cop2.sirenOn = true;
    cop2.speed = 360;

    // SWAT Enforcer Roadblock ahead
    const swat = world.spawnVehicle('SWAT_ENFORCER', 1800, 2450, 0);
    swat.sirenOn = true;

    // Sparks and pursuit particles
    for (let s = 0; s < 12; s++) {
      state.particles.push({
        x: getawayCar.x + (Math.random() - 0.5) * 25,
        y: getawayCar.y - 30,
        vx: (Math.random() - 0.5) * 80,
        vy: -90,
        radius: 3 + Math.random() * 4,
        color: '#facc15',
        life: 0.3,
        maxLife: 0.3,
      });
    }

    state.missionState.bannerText = 'EVADE VCPD SWAT: Lose line of sight or respray at Chop Shop!';
    state.missionState.bannerTimer = 10.0;
  } else if (name === 'mission') {
    // 4-mission.png: The First Vice Bank Heist Shootout
    // Heavy combat outside First Vice Bank: exploded Cobra van, money pickups, muzzle flashes
    pl.x = 2150;
    pl.y = 740;
    pl.angle = -Math.PI / 2;
    pl.health = 75;
    pl.armor = 40;
    pl.cash = 125000;
    pl.currentWeaponIndex = 4; // Syndicate Carbine Assault Rifle
    pl.wantedLevel = 3;

    // Exploded Cobra gang vehicle
    const wreckedCar = world.spawnVehicle('SENTINEL', 2150, 640, 0.2);
    wreckedCar.color = '#7f1d1d';
    wreckedCar.isWrecked = true;

    // Fire & explosion debris particles
    for (let f = 0; f < 30; f++) {
      state.particles.push({
        x: wreckedCar.x + (Math.random() - 0.5) * 40,
        y: wreckedCar.y + (Math.random() - 0.5) * 40,
        vx: (Math.random() - 0.5) * 120,
        vy: (Math.random() - 0.5) * 120,
        radius: 6 + Math.random() * 14,
        color: Math.random() > 0.5 ? '#f43f5e' : '#f59e0b',
        life: 0.6,
        maxLife: 0.6,
      });
    }

    // Money pickups scattered on road
    state.pickups.push({ x: 2180, y: 700, type: 'CASH', value: 5000 });
    state.pickups.push({ x: 2120, y: 710, type: 'CASH', value: 5000 });
    state.pickups.push({ x: 2160, y: 680, type: 'CASH', value: 10000 });

    // Hostile Cobra guards engaging
    world.spawnPedestrian(2080, 660, 'GANG', 'SMG');
    world.spawnPedestrian(2220, 650, 'GANG', 'PISTOL');

    // Bullet tracers flying
    state.projectiles.push({
      x: pl.x,
      y: pl.y - 15,
      vx: 0,
      vy: -1200,
      damage: 44,
      isRocket: false,
      life: 0.4,
      isPlayer: true,
    });

    state.missionState.bannerText = 'MISSION 3: Grab the $25,000 Vault Cash and Escape to Safehouse!';
    state.missionState.bannerTimer = 10.0;
  }

  return { screen: SCREEN_PLAY };
}
