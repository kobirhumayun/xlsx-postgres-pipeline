"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Navbar() {
    const pathname = usePathname();

    const isActive = (path) => pathname === path;

    const links = [
        { href: "/", label: "Home" },
        { href: "/import", label: "Import" },
        { href: "/query", label: "Query" },
        { href: "/backup", label: "Backup" },
    ];

    return (
        <nav className="border-b border-zinc-200 bg-white">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
                <div className="flex items-center gap-8">
                    <Link href="/" className="text-lg font-bold tracking-tight text-zinc-900">
                        XLSX Pipeline
                    </Link>
                    <div className="hidden md:flex md:gap-6">
                        {links.map(({ href, label }) => (
                            <Link
                                key={href}
                                href={href}
                                className={`text-sm font-medium transition-colors hover:text-zinc-900 ${isActive(href) ? "text-zinc-900 border-b-2 border-zinc-900 pb-0.5" : "text-zinc-500"
                                    }`}
                            >
                                {label}
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </nav>
    );
}
