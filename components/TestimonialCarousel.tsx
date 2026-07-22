"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Quote } from "lucide-react";
import { testimonials } from "@/content/testimonials";

export default function TestimonialCarousel() {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);

  function go(next: number) {
    setDirection(next > index ? 1 : -1);
    setIndex((next + testimonials.length) % testimonials.length);
  }

  const active = testimonials[index];

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="Client testimonials"
      className="relative"
    >
      <div className="mx-auto max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 sm:p-12">
        <Quote className="h-9 w-9 text-brand-blue" strokeWidth={1.5} />

        <div className="relative mt-6 min-h-[9rem] sm:min-h-[7rem]">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={index}
              custom={direction}
              initial={{ opacity: 0, x: direction * 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -24 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              aria-live="polite"
            >
              <p className="text-balance text-xl font-medium leading-relaxed text-white sm:text-2xl">
                &ldquo;{active.quote}&rdquo;
              </p>
              <div className="mt-6 flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-blue text-sm font-semibold text-white">
                  {active.initials}
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{active.name}</p>
                  <p className="text-xs text-white/50">
                    {active.role}, {active.company}
                  </p>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => go(index - 1)}
          aria-label="Previous testimonial"
          className="focus-ring flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/70 transition-colors hover:border-brand-blue hover:text-brand-blue"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2">
          {testimonials.map((t, i) => (
            <button
              key={t.name}
              type="button"
              onClick={() => go(i)}
              aria-label={`Go to testimonial ${i + 1} of ${testimonials.length}`}
              aria-current={i === index}
              className="focus-ring h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === index ? "1.75rem" : "0.4rem",
                backgroundColor:
                  i === index ? "#1E5AF6" : "rgba(255,255,255,0.25)",
              }}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => go(index + 1)}
          aria-label="Next testimonial"
          className="focus-ring flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/70 transition-colors hover:border-brand-blue hover:text-brand-blue"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
