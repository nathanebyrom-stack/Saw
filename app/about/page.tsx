import type { Metadata } from "next";
import Image from "next/image";
import Section from "@/components/Section";
import Reveal, { RevealGroup, RevealItem } from "@/components/Reveal";
import CTABand from "@/components/CTABand";
import { company } from "@/content/company";

export const metadata: Metadata = {
  title: "About",
  description: `The story, values, and people behind ${company.name}.`,
};

const values = [
  {
    title: "Precision over promises",
    description:
      "We quote what we can deliver and report the truth even when it's inconvenient. Trust compounds faster than any discount.",
  },
  {
    title: "Operators, not order-takers",
    description:
      "Every account is run by people who've worked a dock, a customs desk, or a warehouse floor — not just a CRM.",
  },
  {
    title: "Visibility as a default",
    description:
      "Real-time data isn't a premium tier. Every client sees what we see, from booking to proof of delivery.",
  },
];

const timeline = [
  { year: "2011", event: "Founded in Rotterdam with a single ocean-freight desk." },
  { year: "2015", event: "Opened air-freight operations and first Asia-Pacific hub in Singapore." },
  { year: "2018", event: "Launched in-house customs brokerage across the EU and North America." },
  { year: "2021", event: "Crossed 10,000 monthly shipments; opened warehousing network." },
  { year: "2025", event: "Operating across 48 countries with 10 strategic hubs." },
];

export default function AboutPage() {
  return (
    <>
      <Section tone="off-white" className="pt-40 sm:pt-48">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
          <Reveal className="lg:col-span-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-blue">
              About {company.name}
            </p>
            <h1 className="mt-4 text-balance text-4xl font-bold tracking-tight text-graphite sm:text-6xl">
              Freight forwarding, run like an engineering team
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-graphite/60">
              {company.description}
            </p>
          </Reveal>
          <Reveal delay={0.1} className="lg:col-span-6">
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl">
              <Image
                src="https://images.unsplash.com/photo-1519003722824-194d4455a60c?q=80&w=1600&auto=format&fit=crop"
                alt="Container port with cranes loading a cargo vessel at sunset"
                fill
                sizes="(min-width: 1024px) 45vw, 90vw"
                className="object-cover"
                priority
              />
            </div>
          </Reveal>
        </div>
      </Section>

      <Section tone="light">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-blue">
            What we believe
          </p>
          <h2 className="mt-4 text-balance text-4xl font-bold tracking-tight text-graphite sm:text-5xl">
            Values that show up in the work
          </h2>
        </Reveal>

        <RevealGroup className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {values.map((value) => (
            <RevealItem
              key={value.title}
              className="rounded-2xl border border-graphite/10 bg-off-white p-8"
            >
              <h3 className="text-lg font-semibold text-graphite">{value.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-graphite/60">
                {value.description}
              </p>
            </RevealItem>
          ))}
        </RevealGroup>
      </Section>

      <Section tone="off-white">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-blue">
            Our journey
          </p>
          <h2 className="mt-4 text-balance text-4xl font-bold tracking-tight text-graphite sm:text-5xl">
            Fourteen years of moving freight
          </h2>
        </Reveal>

        <RevealGroup className="mx-auto mt-14 max-w-2xl divide-y divide-graphite/10 border-y border-graphite/10">
          {timeline.map((item) => (
            <RevealItem
              key={item.year}
              className="flex items-baseline gap-6 py-5"
            >
              <span className="w-16 flex-none text-lg font-bold text-brand-blue">
                {item.year}
              </span>
              <span className="text-sm text-graphite/70">{item.event}</span>
            </RevealItem>
          ))}
        </RevealGroup>
      </Section>

      <Section tone="light">
        <CTABand />
      </Section>
    </>
  );
}
