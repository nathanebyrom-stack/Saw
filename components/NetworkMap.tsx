"use client";

import { motion, useReducedMotion } from "framer-motion";
import { networkHubs, networkRoutes } from "@/content/network";

function hubPath(a: { x: number; y: number }, b: { x: number; y: number }) {
  const midX = (a.x + b.x) / 2;
  const midY = Math.min(a.y, b.y) - 8;
  return `M ${a.x} ${a.y} Q ${midX} ${midY} ${b.x} ${b.y}`;
}

export default function NetworkMap() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden rounded-3xl border border-white/10 bg-graphite p-4 sm:p-8">
      <div
        className="absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "18px 18px",
        }}
        aria-hidden="true"
      />

      <svg
        viewBox="0 0 100 100"
        className="relative h-full w-full"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Map of Meridian Freight's global logistics network connecting major trade hubs"
      >
        {networkRoutes.map(([a, b], i) => {
          const from = networkHubs[a];
          const to = networkHubs[b];
          if (!from || !to) return null;
          return (
            <motion.path
              key={`${a}-${b}-${i}`}
              d={hubPath(from, to)}
              fill="none"
              stroke="#1E5AF6"
              strokeWidth={0.35}
              strokeLinecap="round"
              initial={shouldReduceMotion ? {} : { pathLength: 0, opacity: 0 }}
              whileInView={
                shouldReduceMotion ? {} : { pathLength: 1, opacity: 0.7 }
              }
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 1.6, delay: i * 0.08, ease: "easeOut" }}
            />
          );
        })}

        {networkHubs.map((hub, i) => (
          <g key={hub.name}>
            <motion.circle
              cx={hub.x}
              cy={hub.y}
              r={1.6}
              fill="#1E5AF6"
              initial={shouldReduceMotion ? {} : { scale: 0, opacity: 0 }}
              whileInView={shouldReduceMotion ? {} : { scale: 1, opacity: 1 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.5, delay: 0.4 + i * 0.05 }}
            />
            <circle
              cx={hub.x}
              cy={hub.y}
              r={1.6}
              fill="none"
              stroke="#1E5AF6"
              strokeWidth={0.3}
              opacity={0.5}
              className={shouldReduceMotion ? "" : "animate-pulse-soft"}
            />
          </g>
        ))}
      </svg>

      <div className="pointer-events-none absolute inset-x-4 bottom-4 flex flex-wrap gap-x-5 gap-y-2 sm:inset-x-8 sm:bottom-8">
        {networkHubs.slice(0, 6).map((hub) => (
          <span
            key={hub.name}
            className="text-xs font-medium text-white/50 sm:text-sm"
          >
            {hub.name}
          </span>
        ))}
      </div>
    </div>
  );
}
