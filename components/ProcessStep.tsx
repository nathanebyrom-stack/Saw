import type { ProcessStepData } from "@/content/process";
import { RevealItem } from "@/components/Reveal";

export default function ProcessStep({
  step,
  isLast,
}: {
  step: ProcessStepData;
  isLast: boolean;
}) {
  return (
    <RevealItem className="relative flex gap-6 pb-12 last:pb-0">
      <div className="flex flex-col items-center">
        <span className="flex h-14 w-14 flex-none items-center justify-center rounded-2xl bg-brand-blue text-lg font-bold text-white">
          {step.number}
        </span>
        {!isLast && <span className="mt-2 w-px flex-1 bg-graphite/15" />}
      </div>
      <div className="pt-2">
        <h3 className="text-xl font-semibold tracking-tight text-graphite">
          {step.title}
        </h3>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-graphite/60">
          {step.description}
        </p>
      </div>
    </RevealItem>
  );
}
