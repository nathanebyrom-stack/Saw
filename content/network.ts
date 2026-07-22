export type NetworkHub = {
  name: string;
  x: number;
  y: number;
};

export const networkHubs: NetworkHub[] = [
  { name: "Rotterdam", x: 47.5, y: 30 },
  { name: "New York", x: 24, y: 36 },
  { name: "Los Angeles", x: 12, y: 41 },
  { name: "Shanghai", x: 80, y: 42 },
  { name: "Singapore", x: 76, y: 58 },
  { name: "Dubai", x: 60, y: 46 },
  { name: "São Paulo", x: 32, y: 74 },
  { name: "Sydney", x: 87, y: 78 },
  { name: "Lagos", x: 49, y: 58 },
  { name: "Mumbai", x: 66, y: 48 },
];

export const networkRoutes: [number, number][] = [
  [0, 1],
  [0, 3],
  [0, 5],
  [1, 2],
  [1, 0],
  [2, 3],
  [3, 4],
  [4, 5],
  [4, 9],
  [5, 8],
  [1, 6],
  [4, 7],
  [8, 5],
  [9, 4],
];
