export type Testimonial = {
  quote: string;
  name: string;
  role: string;
  company: string;
  initials: string;
};

export const testimonials: Testimonial[] = [
  {
    quote:
      "Meridian rebuilt our transpacific routing in under three weeks and cut our average transit time by four days. Their team communicates like an extension of ours, not a vendor.",
    name: "Elena Marsh",
    role: "VP of Supply Chain",
    company: "Northfield Outdoor",
    initials: "EM",
  },
  {
    quote:
      "We moved eleven markets of customs brokerage to Meridian in a single quarter with zero missed clearances. The visibility dashboard alone paid for the switch.",
    name: "Daniel Osei",
    role: "Head of Logistics",
    company: "Corvette Labs",
    initials: "DO",
  },
  {
    quote:
      "What stands out is how they plan for the disruption before it happens. Peak season used to be our worst quarter — now it's just another quarter.",
    name: "Priya Nandakumar",
    role: "COO",
    company: "Alder & Finch",
    initials: "PN",
  },
  {
    quote:
      "Their warehousing team treats our SKUs like their own inventory. Pick accuracy and turnaround times both improved within the first month.",
    name: "Tom Reyes",
    role: "Director of Fulfillment",
    company: "Basecamp Supply Co.",
    initials: "TR",
  },
];
