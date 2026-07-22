"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, PlayCircle } from "lucide-react";
import Button from "@/components/Button";

const headlineLine1 = "Global freight,";
const headlineLine2 = "precisely delivered.";

function AnimatedHeadline() {
  const shouldReduceMotion = useReducedMotion();
  const lines = [headlineLine1, headlineLine2];

  return (
    <h1 className="text-balance text-5xl font-bold leading-[1.03] tracking-tightest text-graphite sm:text-6xl md:text-7xl lg:text-[5.25rem]">
      {lines.map((line, lineIndex) => (
        <span key={line} className="block overflow-hidden pb-1">
          <span className="block">
            {line.split(" ").map((word, wordIndex) => (
              <motion.span
                key={word + wordIndex}
                className="inline-block will-change-transform"
                initial={
                  shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: "110%" }
                }
                animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                transition={{
                  duration: 0.85,
                  ease: [0.16, 1, 0.3, 1],
                  delay: 0.15 + lineIndex * 0.12 + wordIndex * 0.08,
                }}
              >
                {word}
                {wordIndex < line.split(" ").length - 1 ? " " : ""}
                {lineIndex === 1 && word === line.split(" ").at(-1) ? (
                  <span className="text-brand-blue">.</span>
                ) : null}
              </motion.span>
            ))}
          </span>
        </span>
      ))}
    </h1>
  );
}

export default function Hero() {
  return (
    <section className="relative flex min-h-[100svh] items-center overflow-hidden bg-off-white pt-28">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-1/4 -top-1/4 h-[70%] w-[70%] rounded-full bg-mesh-blue blur-3xl animate-drift" />
        <RouteLines />
      </div>

      <div className="container-px relative mx-auto grid max-w-8xl grid-cols-1 items-end gap-12 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-graphite/10 bg-white px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-graphite/60"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-brand-blue" />
            Freight forwarding &amp; logistics
          </motion.p>

          <AnimatedHeadline />

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.7 }}
            className="mt-7 max-w-xl text-lg leading-relaxed text-graphite/70 sm:text-xl"
          >
            Meridian Freight moves ocean, air, and ground cargo for ambitious
            brands — with the visibility and precision of a partner built for
            the next decade of trade.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.85 }}
            className="mt-10 flex flex-wrap items-center gap-4"
          >
            <Button href="/contact" icon={<ArrowRight className="h-4 w-4" />}>
              Get a Quote
            </Button>
            <Button
              href="/services"
              variant="secondary"
              icon={<PlayCircle className="h-4 w-4" />}
            >
              Explore Services
            </Button>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1 }}
          className="lg:col-span-4"
        >
          <div className="rounded-3xl border border-graphite/10 bg-white/70 p-6 backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-graphite/40">
              This month
            </p>
            <p className="mt-3 text-4xl font-bold tracking-tight text-graphite">
              12,482
            </p>
            <p className="mt-1 text-sm text-graphite/60">
              shipments in transit across 48 countries
            </p>
            <div className="mt-5 h-px w-full bg-graphite/10" />
            <div className="mt-5 flex items-center justify-between text-sm">
              <span className="text-graphite/60">On-time performance</span>
              <span className="font-semibold text-brand-blue">99.4%</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function RouteLines() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <svg
      className="absolute inset-0 h-full w-full opacity-[0.25]"
      viewBox="0 0 1000 700"
      fill="none"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {[
        "M -50 500 C 200 400, 350 550, 600 380 S 950 250, 1100 300",
        "M -50 200 C 250 300, 400 120, 650 220 S 900 400, 1100 350",
        "M -50 620 C 300 600, 500 680, 750 560 S 950 480, 1100 520",
      ].map((d, i) => (
        <motion.path
          key={d}
          d={d}
          stroke="#1E5AF6"
          strokeWidth={1.5}
          strokeDasharray="6 10"
          initial={shouldReduceMotion ? {} : { pathLength: 0 }}
          animate={shouldReduceMotion ? {} : { pathLength: 1 }}
          transition={{ duration: 2.5, delay: 0.3 + i * 0.3, ease: "easeOut" }}
        />
      ))}
    </svg>
  );
}
