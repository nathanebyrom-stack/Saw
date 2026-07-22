export type ProcessStepData = {
  number: string;
  title: string;
  description: string;
};

export const processSteps: ProcessStepData[] = [
  {
    number: "01",
    title: "Consult & quote",
    description:
      "Tell us your lanes, volumes, and constraints. Our specialists model routing options and return a transparent quote within one business day.",
  },
  {
    number: "02",
    title: "Plan & book",
    description:
      "We reserve capacity across our carrier network, prepare documentation, and confirm a routing plan built around your delivery window.",
  },
  {
    number: "03",
    title: "Move & track",
    description:
      "Your cargo moves under continuous monitoring. Live milestones and exception alerts land in your dashboard and inbox automatically.",
  },
  {
    number: "04",
    title: "Deliver & report",
    description:
      "Freight clears customs and reaches its final destination. You get a full performance report — landed cost, transit time, and documentation archive.",
  },
];
