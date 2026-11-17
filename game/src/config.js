// Sunset Bay — shared tuning constants for the whole game.
// Every number that more than one module needs lives here so the feel
// of the city (sizes, speeds, money, wanted rules) can be tuned in one place.

export const CITY = {
  // One city block is a square of this size; roads run between blocks.
  block: 42,
  road: 14,
  // Blocks per side of the square city grid.
  blocks: 7,
  // How far the beach and ocean extend past the southern edge.
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
  // How quickly a car slows down on its own when no pedal is pressed.
  drag: 0.6,
};

// Wanted stars: 0 = clean, 5 = the whole department is after you.
export const WANTED = {
  max: 5,
  // Seconds without a new crime before one star fades away.
  decaySeconds: 26,
  // Police cars on the road per wanted star.
  policePerStar: 1,
  maxPolice: 5,
  // How close a police car has to get to bust you on foot.
  bustDistance: 2.2,
};

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
];

export const SAVE_KEY = 'sunset-bay-save-v1';
export const START_MONEY = 250;
