export type ServiceIconKey =
  | "freight"
  | "warehouse"
  | "lastMile"
  | "customs"
  | "consulting";

export type Service = {
  icon: ServiceIconKey;
  title: string;
  description: string;
  href: string;
};

export const services: Service[] = [
  {
    icon: "freight",
    title: "Freight Forwarding",
    description:
      "Ocean, air, and rail freight orchestrated across 140+ trade lanes, with a single point of accountability from origin to destination.",
    href: "/services#freight-forwarding",
  },
  {
    icon: "warehouse",
    title: "Warehousing",
    description:
      "Bonded and non-bonded facilities with real-time inventory visibility, cross-docking, and value-added kitting services.",
    href: "/services#warehousing",
  },
  {
    icon: "lastMile",
    title: "Last-Mile Delivery",
    description:
      "Time-definite ground distribution networks tuned for retail, e-commerce, and industrial delivery windows.",
    href: "/services#last-mile",
  },
  {
    icon: "customs",
    title: "Customs Brokerage",
    description:
      "Licensed brokers and compliance specialists who keep shipments moving through borders without friction or fines.",
    href: "/services#customs-brokerage",
  },
  {
    icon: "consulting",
    title: "Supply Chain Consulting",
    description:
      "Network design, carrier strategy, and cost modeling for teams scaling into new markets and manufacturing bases.",
    href: "/services#consulting",
  },
];
