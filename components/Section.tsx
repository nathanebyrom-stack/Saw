import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SectionProps = {
  children: ReactNode;
  className?: string;
  id?: string;
  tone?: "light" | "off-white" | "dark";
  as?: "section" | "div";
};

const toneStyles: Record<NonNullable<SectionProps["tone"]>, string> = {
  light: "bg-white text-graphite",
  "off-white": "bg-off-white text-graphite",
  dark: "bg-graphite-deep text-white",
};

export default function Section({
  children,
  className,
  id,
  tone = "light",
  as = "section",
}: SectionProps) {
  const Tag = as;
  return (
    <Tag
      id={id}
      className={cn("relative py-20 sm:py-28", toneStyles[tone], className)}
    >
      <div className="container-px mx-auto max-w-8xl">{children}</div>
    </Tag>
  );
}
