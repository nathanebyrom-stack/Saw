import type { Metadata } from "next";
import Section from "@/components/Section";
import Reveal, { RevealGroup, RevealItem } from "@/components/Reveal";
import ServiceCard from "@/components/ServiceCard";
import ProcessStep from "@/components/ProcessStep";
import CTABand from "@/components/CTABand";
import { services } from "@/content/services";
import { processSteps } from "@/content/process";
import { company } from "@/content/company";
import { serviceIconMap } from "@/lib/service-icons";

export const metadata: Metadata = {
  title: "Services",
  description: `Freight forwarding, warehousing, last-mile delivery, customs brokerage, and supply chain consulting from ${company.name}.`,
};

export default function ServicesPage() {
  return (
    <>
      <Section tone="off-white" className="pt-40 sm:pt-48">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-blue">
            Services
          </p>
          <h1 className="mt-4 text-balance text-4xl font-bold tracking-tight text-graphite sm:text-6xl">
            One partner for the entire supply chain
          </h1>
          <p className="mt-5 text-lg text-graphite/60">
            Every service below is delivered by an in-house team — no
            subcontracted black boxes, no finger-pointing when plans change.
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

      <Section tone="light" className="space-y-24 sm:space-y-28">
        {services.map((service, i) => {
          const Icon = serviceIconMap[service.icon];
          const id = service.href.split("#")[1];
          return (
            <Reveal
              key={service.title}
              id={id}
              as="div"
              className="scroll-mt-28 border-t border-graphite/10 pt-16 first:border-t-0 first:pt-0"
            >
              <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
                <div className="lg:col-span-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-blue/10 text-brand-blue">
                    <Icon className="h-6 w-6" strokeWidth={1.75} />
                  </span>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.15em] text-graphite/40">
                    0{i + 1}
                  </p>
                  <h2 className="mt-2 text-3xl font-bold tracking-tight text-graphite">
                    {service.title}
                  </h2>
                </div>
                <div className="lg:col-span-8">
                  <p className="max-w-2xl text-base leading-relaxed text-graphite/65">
                    {service.description}
                  </p>
                </div>
              </div>
            </Reveal>
          );
        })}
      </Section>

      <Section tone="off-white">
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-12">
          <Reveal className="lg:col-span-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-blue">
              How it works
            </p>
            <h2 className="mt-4 text-balance text-4xl font-bold tracking-tight text-graphite sm:text-5xl">
              Getting started is simple
            </h2>
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
        <CTABand />
      </Section>
    </>
  );
}
