// Game data: cars, tracks, progression

export interface CarSpec {
  id: string;
  name: string;
  tagline: string;
  topSpeed: number; // km/h
  acceleration: number; // 0-10
  handling: number; // 0-10
  braking: number; // 0-10
  nitroCapacity: number; // 0-10
  driftRating: number; // 0-10
  color: number; // primary color
  accentColor: number;
  unlockRace: number; // career race index required to unlock (0 = unlocked from start)
  price: number;
  enginePitch: number; // base engine sound pitch
  bodyStyle: 'coupe' | 'hypercar' | 'muscle' | 'exotic' | 'tuner';
}

export const CARS: CarSpec[] = [
  {
    id: 'blaze-gt',
    name: 'BLAZE GT',
    tagline: 'Entry-level street legend',
    topSpeed: 350,
    acceleration: 6.5,
    handling: 7.5,
    braking: 7,
    nitroCapacity: 6,
    driftRating: 7,
    color: 0xff3b3b,
    accentColor: 0x1a1a1a,
    unlockRace: 0,
    price: 0,
    enginePitch: 1.0,
    bodyStyle: 'coupe',
  },
  {
    id: 'vortex-r',
    name: 'VORTEX R',
    tagline: 'Razor-sharp acceleration',
    topSpeed: 390,
    acceleration: 8.5,
    handling: 7,
    braking: 7,
    nitroCapacity: 7,
    driftRating: 6.5,
    color: 0xffd400,
    accentColor: 0x222222,
    unlockRace: 2,
    price: 5000,
    enginePitch: 1.1,
    bodyStyle: 'tuner',
  },
  {
    id: 'shadow-x',
    name: 'SHADOW X',
    tagline: 'Balanced precision machine',
    topSpeed: 430,
    acceleration: 8,
    handling: 9,
    braking: 9,
    nitroCapacity: 7.5,
    driftRating: 8,
    color: 0x1e90ff,
    accentColor: 0xc0c0c0,
    unlockRace: 4,
    price: 15000,
    enginePitch: 1.2,
    bodyStyle: 'exotic',
  },
  {
    id: 'inferno-s',
    name: 'INFERNO S',
    tagline: 'Raw power, heavy nitro',
    topSpeed: 465,
    acceleration: 9.5,
    handling: 7.5,
    braking: 8,
    nitroCapacity: 9,
    driftRating: 7.5,
    color: 0x8a2be2,
    accentColor: 0x000000,
    unlockRace: 6,
    price: 35000,
    enginePitch: 1.3,
    bodyStyle: 'muscle',
  },
  {
    id: 'apex-one',
    name: 'APEX ONE',
    tagline: 'Ultimate hypercar — 500 km/h',
    topSpeed: 500,
    acceleration: 10,
    handling: 9.5,
    braking: 9.5,
    nitroCapacity: 10,
    driftRating: 9,
    color: 0x00ff88,
    accentColor: 0x0a0a0a,
    unlockRace: 8,
    price: 80000,
    enginePitch: 1.45,
    bodyStyle: 'hypercar',
  },
];

export interface TrackSpec {
  id: string;
  name: string;
  environment: 'city' | 'highway' | 'mountain' | 'desert' | 'coastal' | 'industrial' | 'tunnel' | 'night' | 'rain' | 'airport' | 'forest' | 'circuit';
  laps: number;
  difficulty: number; // 1-5
  unlockRace: number;
  skyColor: number;
  fogColor: number;
  fogDensity: number;
  sunColor: number;
  ambientColor: number;
  groundColor: number;
  roadColor: number;
  // Spline control points for the track path (closed loop)
  path: [number, number, number][];
  width: number;
  description: string;
  aiCount: number;
  raceTime: number; // seconds, optional for time trial
}

// Helper: generate a looping path from control points. Each track is a closed loop.
export const TRACKS: TrackSpec[] = [
  {
    id: 'downtown-dash',
    name: 'DOWNTOWN DASH',
    environment: 'city',
    laps: 3,
    difficulty: 1,
    unlockRace: 0,
    skyColor: 0x87ceeb,
    fogColor: 0xb8d4e8,
    fogDensity: 0.0025,
    sunColor: 0xfff2cc,
    ambientColor: 0x99aacc,
    groundColor: 0x2a2a2e,
    roadColor: 0x1a1a1c,
    width: 18,
    path: [
      [0, 0, 0], [150, 0, 40], [280, 0, -20], [380, 0, -140],
      [420, 0, -300], [360, 0, -440], [200, 0, -480], [40, 0, -430],
      [-80, 0, -320], [-120, 0, -180], [-80, 0, -60],
    ],
    description: 'Sunlit city grid with tight corners',
    aiCount: 6,
    raceTime: 120,
  },
  {
    id: 'highway-fury',
    name: 'HIGHWAY FURY',
    environment: 'highway',
    laps: 2,
    difficulty: 2,
    unlockRace: 1,
    skyColor: 0xcfe3f5,
    fogColor: 0xdce8f2,
    fogDensity: 0.002,
    sunColor: 0xfff0c0,
    ambientColor: 0xaab4cc,
    groundColor: 0x3a4a2a,
    roadColor: 0x202024,
    width: 24,
    path: [
      [0, 0, 0], [250, 0, 30], [500, 0, 0], [750, 0, -50],
      [900, 0, -200], [850, 0, -400], [650, 0, -500], [400, 0, -470],
      [180, 0, -380], [50, 0, -220], [-30, 0, -100],
    ],
    description: 'Long straights and sweeping bends',
    aiCount: 7,
    raceTime: 150,
  },
  {
    id: 'mountain-pass',
    name: 'MOUNTAIN PASS',
    environment: 'mountain',
    laps: 3,
    difficulty: 3,
    unlockRace: 2,
    skyColor: 0xaed1e8,
    fogColor: 0xc5d8e5,
    fogDensity: 0.0035,
    sunColor: 0xffe0a0,
    ambientColor: 0x8090a5,
    groundColor: 0x4a5a3a,
    roadColor: 0x2a2a2c,
    width: 14,
    path: [
      [0, 0, 0], [120, 20, 80], [200, 50, 200], [150, 80, 350],
      [0, 110, 420], [-160, 90, 380], [-240, 50, 240], [-200, 20, 80],
      [-80, 0, -30],
    ],
    description: 'Winding mountain touge with elevation',
    aiCount: 5,
    raceTime: 180,
  },
  {
    id: 'desert-run',
    name: 'DESERT RUN',
    environment: 'desert',
    laps: 2,
    difficulty: 2,
    unlockRace: 3,
    skyColor: 0xf5d49e,
    fogColor: 0xe8c892,
    fogDensity: 0.002,
    sunColor: 0xffd880,
    ambientColor: 0xd4a060,
    groundColor: 0xc29968,
    roadColor: 0x302820,
    width: 20,
    path: [
      [0, 0, 0], [300, 0, 80], [580, 0, 0], [780, 0, -180],
      [720, 0, -400], [480, 0, -500], [200, 0, -450], [0, 0, -300],
      [-80, 0, -140],
    ],
    description: 'Endless sand and heat haze',
    aiCount: 6,
    raceTime: 140,
  },
  {
    id: 'coastal-circuit',
    name: 'COASTAL CIRCUIT',
    environment: 'coastal',
    laps: 3,
    difficulty: 3,
    unlockRace: 4,
    skyColor: 0x7ec8e3,
    fogColor: 0xaed8e8,
    fogDensity: 0.0022,
    sunColor: 0xfff4cc,
    ambientColor: 0x80a0c0,
    groundColor: 0x3a6a4a,
    roadColor: 0x1a1a20,
    width: 16,
    path: [
      [0, 0, 0], [180, 0, 120], [360, 20, 220], [500, 40, 140],
      [540, 20, -20], [420, 0, -160], [240, 0, -220], [80, 0, -180],
      [-40, 0, -80],
    ],
    description: 'Cliffside ocean roads',
    aiCount: 6,
    raceTime: 160,
  },
  {
    id: 'industrial-zone',
    name: 'INDUSTRIAL ZONE',
    environment: 'industrial',
    laps: 3,
    difficulty: 3,
    unlockRace: 5,
    skyColor: 0x808090,
    fogColor: 0x707080,
    fogDensity: 0.004,
    sunColor: 0xd0d0e0,
    ambientColor: 0x606070,
    groundColor: 0x3a3a3c,
    roadColor: 0x181818,
    width: 16,
    path: [
      [0, 0, 0], [160, 0, 60], [300, 0, 200], [340, 0, 360],
      [260, 0, 480], [100, 0, 500], [-60, 0, 420], [-120, 0, 260],
      [-80, 0, 100],
    ],
    description: 'Grimy warehouses and cranes',
    aiCount: 7,
    raceTime: 130,
  },
  {
    id: 'tunnel-raid',
    name: 'TUNNEL RAID',
    environment: 'tunnel',
    laps: 3,
    difficulty: 4,
    unlockRace: 6,
    skyColor: 0x0a0a14,
    fogColor: 0x0a0a14,
    fogDensity: 0.008,
    sunColor: 0x404050,
    ambientColor: 0x303040,
    groundColor: 0x141418,
    roadColor: 0x141418,
    width: 14,
    path: [
      [0, 0, 0], [200, 0, 40], [400, -20, -40], [520, -30, -200],
      [440, -20, -380], [260, 0, -440], [60, 0, -400], [-80, 0, -280],
      [-100, 0, -120],
    ],
    description: 'Underground tunnel network',
    aiCount: 5,
    raceTime: 140,
  },
  {
    id: 'night-city',
    name: 'NEON NIGHTS',
    environment: 'night',
    laps: 3,
    difficulty: 4,
    unlockRace: 7,
    skyColor: 0x0a0520,
    fogColor: 0x1a0a30,
    fogDensity: 0.004,
    sunColor: 0x8060c0,
    ambientColor: 0x4030a0,
    groundColor: 0x151520,
    roadColor: 0x0a0a12,
    width: 18,
    path: [
      [0, 0, 0], [180, 0, 100], [360, 0, 80], [500, 0, -60],
      [520, 0, -240], [420, 0, -400], [240, 0, -440], [60, 0, -380],
      [-80, 0, -240], [-120, 0, -80],
    ],
    description: 'Neon-lit night streets',
    aiCount: 7,
    raceTime: 150,
  },
  {
    id: 'airport-sprint',
    name: 'AIRPORT SPRINT',
    environment: 'airport',
    laps: 2,
    difficulty: 3,
    unlockRace: 8,
    skyColor: 0xaecbe0,
    fogColor: 0xc0d5e5,
    fogDensity: 0.0015,
    sunColor: 0xfff0c0,
    ambientColor: 0x90a0b5,
    groundColor: 0x555555,
    roadColor: 0x2a2a2c,
    width: 28,
    path: [
      [0, 0, 0], [400, 0, 40], [800, 0, 0], [1000, 0, -150],
      [900, 0, -350], [600, 0, -420], [250, 0, -380], [0, 0, -250],
      [-80, 0, -100],
    ],
    description: 'High-speed airport runways',
    aiCount: 8,
    raceTime: 130,
  },
  {
    id: 'final-apex',
    name: 'THE FINAL APEX',
    environment: 'circuit',
    laps: 3,
    difficulty: 5,
    unlockRace: 9,
    skyColor: 0xff8855,
    fogColor: 0xffaa80,
    fogDensity: 0.003,
    sunColor: 0xffcc88,
    ambientColor: 0xcc8866,
    groundColor: 0x2a2a30,
    roadColor: 0x141418,
    width: 20,
    path: [
      [0, 0, 0], [160, 10, 120], [340, 30, 220], [520, 20, 300],
      [680, 0, 240], [720, 0, 60], [600, 0, -100], [400, 0, -220],
      [220, 0, -320], [40, 0, -280], [-100, 0, -140],
    ],
    description: 'Ultimate championship circuit',
    aiCount: 8,
    raceTime: 180,
  },
];

export interface CareerRace {
  trackId: string;
  opponentLevel: number; // 0-1 (difficulty)
  reward: number;
  unlockCarId?: string;
  description: string;
}

export const CAREER: CareerRace[] = [
  { trackId: 'downtown-dash', opponentLevel: 0.3, reward: 1500, description: 'Your first street race. Prove yourself.' },
  { trackId: 'highway-fury', opponentLevel: 0.4, reward: 2000, description: 'Open highways, raw speed.' },
  { trackId: 'mountain-pass', opponentLevel: 0.5, reward: 3000, unlockCarId: 'vortex-r', description: 'The touge awaits. Unlocks VORTEX R.' },
  { trackId: 'desert-run', opponentLevel: 0.55, reward: 3500, description: 'Heat and dust. No room for error.' },
  { trackId: 'coastal-circuit', opponentLevel: 0.6, reward: 5000, unlockCarId: 'shadow-x', description: 'Cliffs and curves. Unlocks SHADOW X.' },
  { trackId: 'industrial-zone', opponentLevel: 0.7, reward: 6000, description: 'Narrow, gritty, unforgiving.' },
  { trackId: 'tunnel-raid', opponentLevel: 0.75, reward: 8000, unlockCarId: 'inferno-s', description: 'Into the underground. Unlocks INFERNO S.' },
  { trackId: 'night-city', opponentLevel: 0.8, reward: 10000, description: 'Neon jungle. Maximum pressure.' },
  { trackId: 'airport-sprint', opponentLevel: 0.85, reward: 15000, unlockCarId: 'apex-one', description: 'Full throttle. Unlocks APEX ONE.' },
  { trackId: 'final-apex', opponentLevel: 0.95, reward: 30000, description: 'The championship finale.' },
];
