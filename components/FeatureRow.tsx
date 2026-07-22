import Image from "next/image";
import { Check } from "lucide-react";
import type { Feature } from "@/content/features";
import Reveal from "@/components/Reveal";
import { cn } from "@/lib/utils";

export default function FeatureRow({
  feature,
  reverse = false,
}: {
  feature: Feature;
  reverse?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <Reveal className={cn(reverse && "lg:order-2")}>
        <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-graphite/5">
          <Image
            src={feature.image}
            alt={feature.imageAlt}
            fill
            sizes="(min-width: 1024px) 45vw, 90vw"
            className="object-cover"
          />
        </div>
      </Reveal>

      <Reveal delay={0.1} className={cn(reverse && "lg:order-1")}>
        <h3 className="text-balance text-3xl font-bold tracking-tight text-graphite sm:text-4xl">
          {feature.title}
        </h3>
        <p className="mt-5 text-base leading-relaxed text-graphite/65">
          {feature.description}
        </p>
        <ul className="mt-7 space-y-3">
          {feature.points.map((point) => (
            <li key={point} className="flex items-start gap-3 text-sm text-graphite/75">
              <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-brand-blue/10 text-brand-blue">
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              </span>
              {point}
            </li>
          ))}
        </ul>
      </Reveal>
    </div>
  );
}
