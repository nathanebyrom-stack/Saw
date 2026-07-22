"use client";

import { useEffect, useRef } from "react";
import {
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "framer-motion";
import type { Stat } from "@/content/stats";

export default function StatCounter({ stat }: { stat: Stat }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-10% 0px" });
  const shouldReduceMotion = useReducedMotion();
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, {
    damping: 30,
    stiffness: 60,
  });

  const isDecimal = !Number.isInteger(stat.value);

  useEffect(() => {
    if (isInView) {
      motionValue.set(shouldReduceMotion ? stat.value : stat.value);
    }
  }, [isInView, motionValue, stat.value, shouldReduceMotion]);

  useEffect(() => {
    const unsubscribe = springValue.on("change", (latest) => {
      if (!ref.current) return;
      const formatted = isDecimal
        ? latest.toFixed(1)
        : Math.round(latest).toLocaleString("en-US");
      ref.current.textContent = `${stat.prefix ?? ""}${formatted}${stat.suffix}`;
    });
    return unsubscribe;
  }, [springValue, isDecimal, stat.prefix, stat.suffix]);

  return (
    <span
      ref={ref}
      className="tabular-nums"
      aria-label={`${stat.prefix ?? ""}${stat.value}${stat.suffix}`}
    >
      {`${stat.prefix ?? ""}0${stat.suffix}`}
    </span>
  );
}
