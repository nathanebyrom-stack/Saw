"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X, Compass } from "lucide-react";
import { navLinks } from "@/content/nav";
import { company } from "@/content/company";
import Button from "@/components/Button";
import { cn } from "@/lib/utils";

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 16);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled || open
          ? "bg-white/85 backdrop-blur-md shadow-[0_1px_0_rgba(43,47,54,0.08)]"
          : "bg-transparent"
      )}
    >
      <nav
        aria-label="Primary"
        className="container-px mx-auto flex max-w-8xl items-center justify-between py-4"
      >
        <Link
          href="/"
          className="focus-ring flex items-center gap-2 text-lg font-bold tracking-tight text-graphite"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-graphite text-white">
            <Compass className="h-5 w-5 text-brand-blue" strokeWidth={2.5} />
          </span>
          {company.name}
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="focus-ring text-sm font-medium text-graphite/80 transition-colors hover:text-brand-blue"
            >
              {link.label}
            </Link>
          ))}
          <Button href="/contact" variant="primary" className="px-6 py-2.5 text-sm">
            Get a Quote
          </Button>
        </div>

        <button
          type="button"
          className="focus-ring inline-flex items-center justify-center rounded-full p-2 text-graphite md:hidden"
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden bg-white md:hidden"
          >
            <div className="container-px flex flex-col gap-1 pb-6">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="focus-ring rounded-lg px-2 py-3 text-base font-medium text-graphite hover:bg-off-white"
                >
                  {link.label}
                </Link>
              ))}
              <Button
                href="/contact"
                variant="primary"
                className="mt-2 w-full justify-center"
              >
                Get a Quote
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
