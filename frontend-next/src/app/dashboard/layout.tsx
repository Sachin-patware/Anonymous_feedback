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
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 flex flex-col">
            {/* Top Navbar */}
            <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-200/80 shadow-xs">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-14 sm:h-16">
                        {/* Logo and Brand */}
                        <div className="flex items-center gap-3">
                            <Image src="/images/AITR-logo.jpg" alt="AITR Logo" width={150} height={28} className="object-contain w-[120px] sm:w-[160px]" />
                        </div>

                        {/* Navigation Links (Laptop / Desktop) */}
                        <div className="hidden md:flex items-center gap-2">
                            {navItems.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={cn(
                                        "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200",
                                        pathname === item.href
                                            ? "bg-indigo-50 text-indigo-600 shadow-xs"
                                            : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                                    )}
                                >
                                    <item.icon size={18} />
                                    {item.label}
                                </Link>
                            ))}
                        </div>

                        {/* Right Side: User Profile */}
                        <div className="flex items-center gap-3 sm:gap-6">
                            {/* User Menu */}
                            <div className="relative user-menu-container flex items-center">
                                <button
                                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                                    className="flex items-center gap-2.5 pl-2 pr-2.5 sm:pr-3 py-1.5 rounded-xl hover:bg-slate-100/70 border border-transparent hover:border-slate-200 transition-all cursor-pointer"
                                >
                                    <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 text-white flex items-center justify-center font-black text-xs sm:text-sm shadow-sm">
                                        {user?.name?.[0] || 'U'}
                                    </div>
                                    <div className="hidden sm:block text-left">
                                        <p className="text-sm font-bold text-slate-900 leading-none truncate max-w-[140px]">{user?.name}</p>
                                        <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">{user?.enrollment}</p>
                                    </div>
                                    <ChevronDown className={cn(
                                        "h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400 transition-transform",
                                        isUserMenuOpen && "rotate-180"
                                    )} />
                                </button>

                                {/* Dropdown Menu */}
                                {isUserMenuOpen && (
                                    <div className="absolute right-0 top-[120%] mt-2 w-72 bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden animate-in fade-in-0 zoom-in-95 z-50">
                                        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-100">
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 text-white flex items-center justify-center font-black text-lg shadow-sm">
                                                    {user?.name?.[0] || 'U'}
                                                </div>
                                                <div className="flex-1 overflow-hidden">
                                                    <p className="text-sm font-bold text-slate-900 truncate">{user?.name}</p>
                                                    <p className="text-xs font-semibold text-slate-500 truncate">{user?.enrollment}</p>
                                                </div>
                                            </div>
                                            <div className="inline-block px-2.5 py-1 bg-white border border-slate-200 rounded-lg shadow-2xs">
                                                <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">
                                                    Student Portal
                                                </p>
                                            </div>
                                        </div>

                                        <div className="p-2">
                                            <button
                                                onClick={handleLogout}
                                                className="flex items-center gap-3 px-3 py-2.5 w-full text-sm font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
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
            <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-24 md:pb-12">
                {children}
            </main>

            {/* Mobile Bottom Navigation Bar (md:hidden) */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200/80 px-4 py-2 shadow-lg">
                <div className="grid grid-cols-2 gap-2 max-w-md mx-auto">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex flex-col items-center justify-center py-1.5 px-3 rounded-xl font-bold text-xs transition-all",
                                    isActive
                                        ? "bg-blue-50 text-blue-600 font-black shadow-2xs"
                                        : "text-slate-500 hover:text-slate-800"
                                )}
                            >
                                <item.icon size={20} className={cn("mb-0.5", isActive ? "text-blue-600" : "text-slate-400")} />
                                {item.label}
                            </Link>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
