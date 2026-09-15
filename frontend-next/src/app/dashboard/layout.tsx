"use client"
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    FileText,
    LogOut,
    ChevronDown,
    GraduationCap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [user, setUser] = useState<{ name: string; email: string; enrollment: string } | null>(null);

    useEffect(() => {
        // Check auth
        if (typeof window !== 'undefined') {
            const token = localStorage.getItem('student_token') || localStorage.getItem('access_token');
            if (!token) {
                router.push('/');
            } else {
                setUser({
                    name: localStorage.getItem('fullName') || 'Student',
                    email: localStorage.getItem('email') || '',
                    enrollment: localStorage.getItem('enrollment') || '',
                });
            }
        }
    }, [router]);

    // Close user menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (!target.closest('.user-menu-container')) {
                setIsUserMenuOpen(false);
            }
        };

        if (isUserMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isUserMenuOpen]);

    const handleLogout = () => {
        localStorage.clear();
        router.push('/');
    };

    const navItems = [
        { icon: LayoutDashboard, label: 'Overview', href: '/dashboard' },
        { icon: FileText, label: 'My Feedback', href: '/dashboard/feedback' },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
            {/* Top Navbar */}
            <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
                <div className="max-w-7xl mx-auto ">
                    <div className="flex items-center justify-between h-16">
                        {/* Logo and Brand */}
                        <div className="flex items-center gap-4">
                            <Image src="/images/AITR-logo.jpg" alt="AITR Logo" width={180} height={30} className="object-contain" />
                        </div>

                        {/* Navigation Links */}
                        <div className="hidden md:flex items-center gap-2">
                            {navItems.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={cn(
                                        "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200",
                                        pathname === item.href
                                            ? "bg-slate-100 text-indigo-600"
                                            : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                                    )}
                                >
                                    <item.icon size={18} />
                                    {item.label}
                                </Link>
                            ))}
                        </div>

                        {/* Right Side: User Menu */}
                        <div className="flex items-center gap-6">
                            {/* User Menu */}
                            <div className="relative user-menu-container flex items-center">
                                <button
                                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                                    className="flex items-center gap-3 pl-2 pr-3 py-1.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all"
                                >
                                    <div className="h-9 w-9 rounded-full bg-slate-100 border border-slate-200 text-indigo-600 flex items-center justify-center font-black text-sm shadow-sm">
                                        {user?.name?.[0] || 'U'}
                                    </div>
                                    <div className="hidden sm:block text-left">
                                        <p className="text-sm font-bold text-slate-900 leading-none">{user?.name}</p>
                                        <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">{user?.enrollment}</p>
                                    </div>
                                    <ChevronDown className={cn(
                                        "h-4 w-4 text-slate-400 transition-transform hidden sm:block",
                                        isUserMenuOpen && "rotate-180"
                                    )} />
                                </button>

                                {/* Dropdown Menu */}
                                {isUserMenuOpen && (
                                    <div className="absolute right-0 top-[120%] mt-2 w-72 bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden animate-in fade-in-0 zoom-in-95">
                                        <div className="p-5 bg-slate-50 border-b border-slate-100">
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="h-14 w-14 rounded-full bg-white border border-slate-200 text-indigo-600 flex items-center justify-center font-black text-xl shadow-sm">
                                                    {user?.name?.[0] || 'U'}
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-sm font-bold text-slate-900">{user?.name}</p>
                                                    <p className="text-xs font-semibold text-slate-500 mt-0.5">{user?.email}</p>
                                                </div>
                                            </div>
                                            <div className="inline-block px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-sm">
                                                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                                                    Enrollment: {user?.enrollment}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Mobile Navigation Links */}
                                        <div className="md:hidden p-2 border-b border-slate-100">
                                            {navItems.map((item) => (
                                                <Link
                                                    key={item.href}
                                                    href={item.href}
                                                    onClick={() => setIsUserMenuOpen(false)}
                                                    className={cn(
                                                        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors",
                                                        pathname === item.href
                                                            ? "bg-slate-50 text-indigo-600"
                                                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                                    )}
                                                >
                                                    <item.icon size={18} />
                                                    {item.label}
                                                </Link>
                                            ))}
                                        </div>

                                        <div className="p-2">
                                            <button
                                                onClick={handleLogout}
                                                className="flex items-center gap-3 px-3 py-2.5 w-full text-sm font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                                            >
                                                <LogOut size={18} />
                                                Sign Out
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {children}
            </main>
        </div>
    );
}
