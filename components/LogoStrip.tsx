import { clientLogos } from "@/content/logos";

export default function LogoStrip() {
  const doubled = [...clientLogos, ...clientLogos];

  return (
    <div className="overflow-hidden py-10">
      <p className="container-px mx-auto mb-8 max-w-8xl text-center text-xs font-semibold uppercase tracking-[0.2em] text-graphite/40">
        Trusted by teams moving freight worldwide
      </p>
      <div
        className="group relative flex w-max animate-marquee gap-16 [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)] hover:[animation-play-state:paused]"
        aria-hidden="true"
      >
        {doubled.map((logo, i) => (
          <span
            key={`${logo.name}-${i}`}
            className="flex-none select-none text-xl font-semibold tracking-tight text-graphite/30"
          >
            {logo.name}
          </span>
        ))}
      </div>
      <span className="sr-only">
        {clientLogos.map((l) => l.name).join(", ")}
      </span>
    </div>
  );
}
