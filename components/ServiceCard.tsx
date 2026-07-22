"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Service } from "@/content/services";
import { serviceIconMap } from "@/lib/service-icons";

export default function ServiceCard({ service }: { service: Service }) {
  const Icon = serviceIconMap[service.icon];

  return (
    <motion.div
      whileHover={{ y: -6 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      className="h-full"
    >
      <Link
        href={service.href}
        className="focus-ring group flex h-full flex-col justify-between rounded-2xl border border-graphite/10 bg-white p-8 shadow-[0_1px_2px_rgba(43,47,54,0.04)] transition-colors duration-300 hover:border-brand-blue/40"
      >
        <div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-off-white text-brand-blue transition-colors duration-300 group-hover:bg-brand-blue group-hover:text-white">
            <Icon className="h-6 w-6" strokeWidth={1.75} />
          </div>
          <h3 className="mt-6 text-xl font-semibold tracking-tight text-graphite">
            {service.title}
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-graphite/60">
            {service.description}
          </p>
        </div>
        <div className="mt-8 inline-flex items-center gap-1 text-sm font-semibold text-brand-blue">
          Learn more
          <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1" />
        </div>
      </Link>
    </motion.div>
  );
}
