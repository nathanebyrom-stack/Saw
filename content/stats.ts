export type Stat = {
  value: number;
  suffix: string;
  prefix?: string;
  label: string;
};

export const stats: Stat[] = [
  { value: 12000, suffix: "+", label: "shipments moved every month" },
  { value: 48, suffix: "", label: "countries served across 6 continents" },
  { value: 99.4, suffix: "%", label: "on-time delivery performance" },
  { value: 15, suffix: " yrs", label: "average client partnership length" },
];
