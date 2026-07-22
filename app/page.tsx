import Hero from "@/components/Hero";
import LogoStrip from "@/components/LogoStrip";
import Section from "@/components/Section";
import ServiceCard from "@/components/ServiceCard";
import StatCounter from "@/components/StatCounter";
import NetworkMap from "@/components/NetworkMap";
import ProcessStep from "@/components/ProcessStep";
import FeatureRow from "@/components/FeatureRow";
import TestimonialCarousel from "@/components/TestimonialCarousel";
import CTABand from "@/components/CTABand";
import Reveal, { RevealGroup, RevealItem } from "@/components/Reveal";
import { services } from "@/content/services";
import { stats } from "@/content/stats";
import { processSteps } from "@/content/process";
import { features } from "@/content/features";

export default function HomePage() {
  return (
    <>
      <Hero />

      <Section tone="light" className="py-12 sm:py-16">
        <LogoStrip />
      </Section>

      <Section id="services" tone="off-white">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-blue">
            What we do
          </p>
          <h2 className="mt-4 text-balance text-4xl font-bold tracking-tight text-graphite sm:text-5xl">
            End-to-end logistics, under one roof
          </h2>
          <p className="mt-4 text-lg text-graphite/60">
            From first mile to final delivery, Meridian handles every link in
            the chain — so you deal with one partner, not twelve vendors.
          </p>
        </Reveal>

        <RevealGroup className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <RevealItem key={service.title}>
              <ServiceCard service={service} />
            </RevealItem>
          ))}
        </RevealGroup>
      </Section>

      <Section tone="dark">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-blue-light">
            By the numbers
          </p>
          <h2 className="mt-4 text-balance text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Scale you can measure
          </h2>
        </Reveal>

        <RevealGroup className="mt-14 grid grid-cols-2 gap-8 sm:gap-10 lg:grid-cols-4">
          {stats.map((stat) => (
            <RevealItem key={stat.label} className="text-center lg:text-left">
              <p className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
                <StatCounter stat={stat} />
              </p>
              <p className="mt-3 text-sm leading-relaxed text-white/50">
                {stat.label}
              </p>
            </RevealItem>
          ))}
        </RevealGroup>
      </Section>

      <Section id="network" tone="light">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
          <Reveal className="lg:col-span-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-blue">
              Global network
            </p>
            <h2 className="mt-4 text-balance text-4xl font-bold tracking-tight text-graphite sm:text-5xl">
              A network built across six continents
            </h2>
            <p className="mt-5 text-base leading-relaxed text-graphite/60">
              Ten strategic hubs and hundreds of carrier relationships mean
              your freight always has a path — even when the fastest route
              changes overnight.
            </p>
          </Reveal>

          <Reveal delay={0.1} className="lg:col-span-7">
            <NetworkMap />
          </Reveal>
        </div>
      </Section>

      <Section tone="off-white">
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-12">
          <Reveal className="lg:col-span-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-blue">
              How it works
            </p>
            <h2 className="mt-4 text-balance text-4xl font-bold tracking-tight text-graphite sm:text-5xl">
              From quote to delivery in four steps
            </h2>
            <p className="mt-5 text-base leading-relaxed text-graphite/60">
              A clear, predictable process — designed so your team always
              knows exactly where a shipment stands.
            </p>
          </Reveal>

          <RevealGroup className="lg:col-span-8">
            {processSteps.map((step, i) => (
              <ProcessStep
                key={step.number}
                step={step}
                isLast={i === processSteps.length - 1}
              />
            ))}
          </RevealGroup>
        </div>
      </Section>

      <Section tone="light">
        <Reveal className="mx-auto mb-16 max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-blue">
            Why Meridian
          </p>
          <h2 className="mt-4 text-balance text-4xl font-bold tracking-tight text-graphite sm:text-5xl">
            Built for teams who can&apos;t afford surprises
          </h2>
        </Reveal>

        <div className="space-y-24 sm:space-y-32">
          {features.map((feature, i) => (
            <FeatureRow key={feature.title} feature={feature} reverse={i % 2 === 1} />
          ))}
        </div>
      </Section>

      <Section tone="dark">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-blue-light">
            Testimonials
          </p>
          <h2 className="mt-4 text-balance text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Trusted by supply chain leaders
          </h2>
        </Reveal>

        <div className="mt-14">
          <TestimonialCarousel />
        </div>
      </Section>

      <Section tone="off-white">
        <CTABand />
      </Section>
    </>
  );
}
