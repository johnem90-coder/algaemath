"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
    { href: "/core-concepts", title: "Core Concepts" },
    { href: "/equations", title: "Equations" },
    { href: "/simple-simulators", title: "Simulators" },
    { href: "/explorations", title: "Explorations" },
    { href: "/experiments", title: "Experiments", soon: true },
    { href: "/technoeconomics", title: "TEA", soon: true },
];

export default function SiteHeader() {
    const pathname = usePathname();
    const [mobileNavOpen, setMobileNavOpen] = useState(false);

    return (
        <header>
            {/* Top nav bar */}
            <nav className="border-b bg-background">
                <div className="mx-auto flex h-14 max-w-[90rem] items-center justify-between px-6">
                    <Link
                        href="/"
                        className="no-underline"
                    >
                        <svg viewBox="0 0 228 68" width="152" height="45" xmlns="http://www.w3.org/2000/svg" aria-label="AlgaeMath">
                            <rect x="3" y="26" width="52" height="16" rx="8" fill="none" stroke="#1c2820" strokeWidth="2.2"/>
                            <path d="M 4 49 C 22 49 37 19 55 19" fill="none" stroke="#449e5a" strokeWidth="2.8" strokeLinecap="round"/>
                            <circle cx="29" cy="34" r="3.5" fill="#449e5a"/>
                            <text x="66" y="41" fontFamily="'Geist','Geist Sans',sans-serif" fontSize="21" fontWeight="600">
                                <tspan fill="#449e5a">Algae</tspan><tspan fill="#1c2820">Math</tspan>
                            </text>
                        </svg>
                    </Link>

                    {/* Desktop nav */}
                    <div className="hidden sm:flex items-center gap-1">
                        {navItems.map((item) =>
                            item.soon ? (
                                <span
                                    key={item.href}
                                    className="px-3 py-1.5 text-sm text-muted-foreground/50 cursor-default"
                                >
                                    {item.title}
                                </span>
                            ) : (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`rounded-md px-3 py-1.5 text-sm no-underline transition-colors ${
                                        pathname.startsWith(item.href)
                                            ? "bg-[hsl(var(--accent-science-muted))] font-medium text-[hsl(var(--accent-science))]"
                                            : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    {item.title}
                                </Link>
                            ),
                        )}
                    </div>

                    {/* Mobile menu button */}
                    <button
                        onClick={() => setMobileNavOpen((v) => !v)}
                        className="sm:hidden flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Toggle navigation menu"
                    >
                        {mobileNavOpen ? (
                            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                                <path d="M4 4L14 14M14 4L4 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                        ) : (
                            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                                <path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                        )}
                    </button>
                </div>

                {/* Mobile dropdown nav */}
                {mobileNavOpen && (
                    <div className="sm:hidden border-t bg-background px-6 py-2">
                        {navItems.map((item) =>
                            item.soon ? (
                                <span
                                    key={item.href}
                                    className="block px-3 py-2 text-sm text-muted-foreground/50 cursor-default"
                                >
                                    {item.title}
                                </span>
                            ) : (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setMobileNavOpen(false)}
                                    className={`block rounded-md px-3 py-2 text-sm no-underline transition-colors ${
                                        pathname.startsWith(item.href)
                                            ? "bg-[hsl(var(--accent-science-muted))] font-medium text-[hsl(var(--accent-science))]"
                                            : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    {item.title}
                                </Link>
                            ),
                        )}
                    </div>
                )}
            </nav>
        </header>
    );
}
