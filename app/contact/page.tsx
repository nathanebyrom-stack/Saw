import type { Metadata } from "next";
import { Mail, MapPin, Phone } from "lucide-react";
import Section from "@/components/Section";
import Reveal from "@/components/Reveal";
import ContactForm from "@/components/ContactForm";
import { company } from "@/content/company";

export const metadata: Metadata = {
  title: "Contact",
  description: `Get in touch with the ${company.name} team for a freight quote or logistics consultation.`,
};

const details = [
  { icon: Mail, label: "Email", value: company.email, href: `mailto:${company.email}` },
  { icon: Phone, label: "Phone", value: company.phone, href: `tel:${company.phone.replace(/\s+/g, "")}` },
  { icon: MapPin, label: "Headquarters", value: company.address, href: undefined },
];

export default function ContactPage() {
  return (
    <>
      <Section tone="off-white" className="pt-40 sm:pt-48">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-blue">
            Contact
          </p>
          <h1 className="mt-4 text-balance text-4xl font-bold tracking-tight text-graphite sm:text-6xl">
            Let&apos;s move your freight
          </h1>
          <p className="mt-5 text-lg text-graphite/60">
            Tell us about your lanes and volumes — a specialist will follow up
            within one business day with a tailored quote.
          </p>
        </Reveal>
      </Section>

      <Section tone="light" className="pt-0">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          <Reveal className="lg:col-span-7">
            <div className="rounded-3xl border border-graphite/10 bg-white p-8 sm:p-10">
              <ContactForm />
            </div>
          </Reveal>

          <Reveal delay={0.1} className="lg:col-span-5">
            <div className="rounded-3xl bg-graphite-deep p-8 text-white sm:p-10">
              <h2 className="text-xl font-semibold">Reach us directly</h2>
              <ul className="mt-6 space-y-6">
                {details.map(({ icon: Icon, label, value, href }) => (
                  <li key={label} className="flex items-start gap-4">
                    <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-white/10 text-brand-blue-light">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-white/40">
                        {label}
                      </p>
                      {href ? (
                        <a href={href} className="focus-ring text-sm text-white hover:text-brand-blue-light">
                          {value}
                        </a>
                      ) : (
                        <p className="text-sm text-white">{value}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-8 border-t hairline-light pt-6 text-sm text-white/50">
                Office hours: Monday–Friday, 08:00–19:00 CET. Emergency
                shipment support available 24/7 for active accounts.
              </div>
            </div>
          </Reveal>
        </div>
      </Section>
    </>
  );
}
