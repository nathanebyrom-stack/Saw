"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Compass, Linkedin, Twitter, Instagram, ArrowRight } from "lucide-react";
import { company } from "@/content/company";
import { navLinks } from "@/content/nav";

const serviceLinks = [
  { label: "Freight Forwarding", href: "/services#freight-forwarding" },
  { label: "Warehousing", href: "/services#warehousing" },
  { label: "Last-Mile Delivery", href: "/services#last-mile" },
  { label: "Customs Brokerage", href: "/services#customs-brokerage" },
  { label: "Supply Chain Consulting", href: "/services#consulting" },
];

export default function Footer() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "success">("idle");

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.includes("@")) return;
    setStatus("success");
    setEmail("");
  }

  return (
    <footer className="bg-graphite-deep text-white/80">
      <div className="container-px mx-auto max-w-8xl py-16 sm:py-20">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Link
              href="/"
              className="focus-ring flex items-center gap-2 text-lg font-bold tracking-tight text-white"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
                <Compass className="h-5 w-5 text-brand-blue" strokeWidth={2.5} />
              </span>
              {company.name}
            </Link>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/60">
              {company.description}
            </p>
            <div className="mt-6 flex items-center gap-3">
              {[
                { icon: Linkedin, href: company.social.linkedin, label: "LinkedIn" },
                { icon: Twitter, href: company.social.x, label: "X" },
                { icon: Instagram, href: company.social.instagram, label: "Instagram" },
              ].map(({ icon: Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={label}
                  className="focus-ring flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/70 transition-colors hover:border-brand-blue hover:text-brand-blue"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">Services</h3>
            <ul className="mt-4 space-y-3">
              {serviceLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="focus-ring text-sm text-white/60 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">Company</h3>
            <ul className="mt-4 space-y-3">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="focus-ring text-sm text-white/60 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <a
                  href={`mailto:${company.email}`}
                  className="focus-ring text-sm text-white/60 transition-colors hover:text-white"
                >
                  {company.email}
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">Stay in the loop</h3>
            <p className="mt-4 text-sm text-white/60">
              Trade-lane updates and capacity alerts, once a month. No spam.
            </p>
            <form onSubmit={handleSubmit} className="mt-4">
              <label htmlFor="footer-email" className="sr-only">
                Email address
              </label>
              <div className="flex items-center overflow-hidden rounded-full border border-white/15 bg-white/5 pr-1.5 focus-within:border-brand-blue">
                <input
                  id="footer-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="focus-ring w-full bg-transparent px-4 py-2.5 text-sm text-white placeholder:text-white/40 outline-none"
                />
                <button
                  type="submit"
                  aria-label="Subscribe"
                  className="focus-ring flex h-8 w-8 flex-none items-center justify-center rounded-full bg-brand-blue text-white transition-transform hover:scale-105"
                >
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
              <p
                role="status"
                className="mt-2 h-4 text-xs text-brand-blue-light"
              >
                {status === "success" ? "You're subscribed. Welcome aboard." : ""}
              </p>
            </form>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t hairline-light pt-8 text-xs text-white/40 sm:flex-row sm:items-center">
          <p>
            &copy; {new Date().getFullYear()} {company.name}. All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link href="#" className="focus-ring hover:text-white/70">
              Privacy Policy
            </Link>
            <Link href="#" className="focus-ring hover:text-white/70">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
