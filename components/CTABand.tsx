import { ArrowRight } from "lucide-react";
import Button from "@/components/Button";
import Reveal from "@/components/Reveal";

export default function CTABand() {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-brand-blue px-8 py-16 text-center sm:px-16 sm:py-20">
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-graphite-deep/20 blur-3xl"
        aria-hidden="true"
      />
      <Reveal className="relative mx-auto max-w-2xl">
        <h2 className="text-balance text-3xl font-bold tracking-tight text-white sm:text-5xl">
          Ready to move freight with confidence?
        </h2>
        <p className="mt-5 text-lg text-white/80">
          Talk to a logistics specialist today and get a tailored quote within
          one business day.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
          <Button
            href="/contact"
            variant="secondary"
            icon={<ArrowRight className="h-4 w-4" />}
          >
            Get a Quote
          </Button>
          <Button href="/contact" variant="ghost" className="text-white">
            Talk to Sales
          </Button>
        </div>
      </Reveal>
    </div>
  );
}
