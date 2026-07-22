export type Feature = {
  title: string;
  description: string;
  image: string;
  imageAlt: string;
  points: string[];
};

export const features: Feature[] = [
  {
    title: "Visibility built for operators, not just executives",
    description:
      "Every shipment is traceable to the container and carton level. Your ops team gets the same real-time data we use internally — no black boxes, no waiting on a status email.",
    image:
      "https://images.unsplash.com/photo-1494412651409-8963ce7935a7?q=80&w=1600&auto=format&fit=crop",
    imageAlt: "Aerial view of stacked shipping containers at a busy port terminal",
    points: [
      "Live milestone tracking across every mode",
      "API and EDI integrations with your WMS or ERP",
      "Exception alerts before they become delays",
    ],
  },
  {
    title: "A carrier network we've spent a decade earning",
    description:
      "Preferred allocations with ocean carriers, airlines, and ground fleets mean your freight moves even when capacity is tight — and at rates built on long-term volume, not spot-market panic.",
    image:
      "https://images.unsplash.com/photo-1578575437130-527eed3abbec?q=80&w=1600&auto=format&fit=crop",
    imageAlt: "Cargo ship loaded with containers departing a harbor at dusk",
    points: [
      "Preferred capacity on 140+ trade lanes",
      "Multi-carrier redundancy for peak season",
      "Dedicated account team, not a ticket queue",
    ],
  },
  {
    title: "Compliance handled before it becomes a problem",
    description:
      "Licensed customs brokers and trade compliance specialists manage classification, duties, and documentation, so your shipments clear borders the first time, every time.",
    image:
      "https://images.unsplash.com/photo-1616401784845-180882ba9ba8?q=80&w=1600&auto=format&fit=crop",
    imageAlt: "Warehouse worker reviewing shipment documentation on a tablet",
    points: [
      "In-house licensed brokerage in every major market",
      "HS classification and duty optimization",
      "Audit-ready documentation archive",
    ],
  },
];
