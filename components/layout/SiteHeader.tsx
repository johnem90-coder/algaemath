"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
    { href: "/core-concepts", title: "Core Concepts" },
    { href: "/equations", title: "Equations" },
    { href: "/simple-simulators", title: "Simulators" },
    { href: "/models", title: "Models", soon: true },
    { href: "/experiments", title: "Experiments", soon: true },
    { href: "/technoeconomics", title: "TEA", soon: true },
];

export default function SiteHeader() {
    const pathname = usePathname();

    return (
        <header>
            {/* Top nav bar */}
            <nav className="border-b bg-background">
                <div className="mx-auto flex h-14 max-w-[90rem] items-center justify-between px-6">
                    <Link
                        href="/"
                        className="text-lg font-semibold tracking-tight no-underline"
                    >
                        <span className="text-[hsl(var(--accent-science))]">
                            Algae
                        </span>
                        Math
                    </Link>

                    <div className="flex items-center gap-1">
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
                </div>
            </nav>
        </header>
    );
}
