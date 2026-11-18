// Sunset Bay — one place for every number the game tunes by.
// City shape, player feel, car handling, wanted rules, job payouts and
// the sunset look all live here, so a single edit retunes the whole game.

export const CITY = {
  // A block is this wide; streets run in the gaps between blocks.
  block: 42,
  road: 14,
  // Blocks along each side of the square city.
  blocks: 7,
  // How much sand sits between the last street and the water.
  beachWidth: 26,
};

export const PLAYER = {
  walkSpeed: 6,
  runSpeed: 10.5,
  radius: 0.55,
  height: 1.8,
  maxHealth: 100,
};

export const CAR = {
  accel: 22,
  brake: 34,
  reverseAccel: 12,
  maxSpeed: 34,
  maxReverse: 10,
  turnRate: 1.9,
  // Natural slow-down with no pedal pressed.
  drag: 0.6,
};

// Wanted stars run 0 (clean) to 5 (the whole department is out).
export const WANTED = {
  max: 5,
  // Quiet seconds before one star fades on its own.
  decaySeconds: 26,
  // Cruisers on the road for each star.
  policePerStar: 1,
  maxPolice: 5,
  // How close a cruiser must get to bust you on foot.
  bustDistance: 2.2,
};

// The four jobs, in story order. The last one is the new sprint: race
// three checkpoints down Ocean Drive to the pier before the clock dies.
export const MISSIONS = [
  {
    id: 'package',
    title: 'Package Run',
    brief: 'Pick up the package at the pier, then deliver it to the hotel on Ocean Drive.',
    reward: 500,
  },
  {
    id: 'hotwheels',
    title: 'Hot Wheels',
    brief: 'Steal the red sports car parked by the plaza and bring it to the garage.',
    reward: 800,
  },
  {
    id: 'heat',
    title: 'Heat',
    brief: 'The cops are onto you. Lose them — survive 60 seconds with a 3-star wanted level.',
    reward: 1200,
  },
  {
    id: 'sprint',
    title: 'Sunset Sprint',
    brief: 'Race the Ocean Drive checkpoints to the pier in 90 seconds — the cops will be watching.',
    reward: 1500,
  },
];

// The sprint itself: seconds on the clock, stars while racing, and the
// three checkpoints (east Ocean Drive, mid Ocean Drive, then the pier).
export const SPRINT = {
  timeLimit: 90,
  wanted: 2,
  checkpointRadius: 7,
};

// Golden-hour look: low sun, warm haze, long shadows.
export const SUNSET = {
  sunColor: 0xffb36b,
  skyTop: 0x3a4a8f,
  skyMid: 0xe86a92,
  skyLow: 0xff9a4d,
  fogColor: 0xf2a56b,
  fogNear: 200,
  fogFar: 640,
  // Sun hangs low over the sea, to the south-west — high enough that the
  // streets still catch warm light, low enough for long shadows.
  sunDir: { x: -0.45, y: 0.42, z: 0.86 },
};

export const SAVE_KEY = 'sunset-bay-save-v1';
export const START_MONEY = 250;
