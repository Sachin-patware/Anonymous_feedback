"use client"
import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Loader2, CheckCircle2, Star, Send, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Toast, ToastType } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';
import { FEEDBACK_QUESTIONS } from '@/app/dashboard/feedbackQuestions';

interface Teacher {
    allocation_id: number;
    teacher_name: string;
    is_submitted: boolean;
    subject_code: string;
    subject_name: string;
}

interface Subject {
    subject_code: string;
    subject_name: string;
    teachers: Teacher[];
}

interface FeedbackState {
    [allocationId: string]: {
        ratings: { [q: string]: number };
    };
}

export default function DashboardPage() {
    const router = useRouter();
    const scrollRef = useRef<HTMLDivElement>(null);
    const [allTeachers, setAllTeachers] = useState<Teacher[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);
    const [mobileTeacherIdx, setMobileTeacherIdx] = useState(0);
    const [toast, setToast] = useState<{ msg: string; type: ToastType; visible: boolean }>({
        msg: '',
        type: 'info',
        visible: false,
    });

    const [feedbacks, setFeedbacks] = useState<FeedbackState>({});

    const showToast = (msg: string, type: ToastType) => {
        setToast({ msg, type, visible: true });
    };

    useEffect(() => {
        fetchTeachers();
    }, []);

    const checkScroll = () => {
        const el = scrollRef.current;
        if (!el) return;
        setCanScrollLeft(el.scrollLeft > 8);
        setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
    };

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        // Small delay so DOM paints first
        setTimeout(checkScroll, 100);
        el.addEventListener('scroll', checkScroll, { passive: true });
        window.addEventListener('resize', checkScroll);
        return () => {
            el.removeEventListener('scroll', checkScroll);
            window.removeEventListener('resize', checkScroll);
        };
    }, [allTeachers]);

    const scrollBy = (dir: 'left' | 'right') => {
        scrollRef.current?.scrollBy({ left: dir === 'right' ? 300 : -300, behavior: 'smooth' });
    };

    const fetchTeachers = async () => {
        try {
            const res = await apiFetch('/my-teachers/');
            const data = await res.json();

            if (data.status === "ok") {
                const flatTeachers: Teacher[] = [];
                data.subjects.forEach((subj: Subject) => {
                    subj.teachers.forEach(t => {
                        flatTeachers.push({
                            ...t,
                            subject_code: subj.subject_code,
                            subject_name: subj.subject_name
                        });
                    });
                });
                setAllTeachers(flatTeachers);

                const initialFeedback: FeedbackState = {};
                flatTeachers.forEach(t => {
                    if (!t.is_submitted) {
                        initialFeedback[t.allocation_id] = {
                            ratings: {
                                q1: 0, q2: 0, q3: 0, q4: 0, q5: 0,
                                q6: 0, q7: 0, q8: 0, q9: 0, q10: 0
                            }
                        };
                    }
                });
                setFeedbacks(initialFeedback);
            } else {
                showToast("Session expired or invalid. Please login again.", "error");
                router.push('/');
            }
        } catch (error) {
            console.error("Fetch teachers error:", error);
            showToast("Error connecting to server. Is backend running?", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleRatingChange = (allocationId: number, qKey: string, rating: number) => {
        setFeedbacks(prev => ({
            ...prev,
            [allocationId]: {
                ...prev[allocationId],
                ratings: {
                    ...prev[allocationId]?.ratings,
                    [qKey]: rating
                }
            }
        }));
    };

    const getProgress = (allocationId: number) => {
        const f = feedbacks[allocationId];
        if (!f || !f.ratings) return 0;
        return Object.values(f.ratings).filter(val => val > 0).length;
    };

    const handleSubmitAll = async () => {
        const pendingTeachers = allTeachers.filter(t => !t.is_submitted);
        const incomplete = pendingTeachers.some(t => getProgress(t.allocation_id) < 10);

        if (incomplete) {
            showToast("Please provide all 10 ratings for each teacher before submitting.", "error");
            return;
        }

        setSubmitting(true);
        let successCount = 0;
        let failCount = 0;

        for (const t of pendingTeachers) {
            const payload = {
                subject_code: t.subject_code,
                allocation_id: t.allocation_id,
                ...feedbacks[t.allocation_id].ratings
            };

            try {
                const res = await apiFetch('/submit-feedback/', {
                    method: "POST",
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (data.status === "ok") {
                    successCount++;
                } else {
                    failCount++;
                }
            } catch {
                failCount++;
            }
        }

        setSubmitting(false);
        if (failCount === 0) {
            showToast(`All ${successCount} feedbacks submitted successfully!`, "success");
            fetchTeachers();
        } else {
            showToast(`${successCount} submitted, ${failCount} failed. Please try again.`, "error");
        }
    };

    if (loading) {
        return (
            <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
                    <Loader2 className="w-8 h-8 animate-spin text-white" />
                </div>
                <p className="text-gray-500 font-semibold">Loading your assigned teachers...</p>
            </div>
        );
    }

    const pendingTeachers = allTeachers.filter(t => !t.is_submitted);
    const hasNoAssignments = allTeachers.length === 0;
    const totalRated = pendingTeachers.filter(t => getProgress(t.allocation_id) === 10).length;
    const safeMobileIdx = Math.min(mobileTeacherIdx, Math.max(0, pendingTeachers.length - 1));
    const currentMobileTeacher = pendingTeachers[safeMobileIdx];

    const RATING_TEXT: Record<number, string> = {
        1: 'Poor',
        2: 'Average',
        3: 'Good',
        4: 'Very Good',
        5: 'Excellent'
    };

    return (
        <div className="min-h-screen pb-32">
            <Toast
                message={toast.msg}
                type={toast.type}
                isVisible={toast.visible}
                onClose={() => setToast(prev => ({ ...prev, visible: false }))}
            />

            {/* Header */}
            <div className="text-center space-y-2 sm:space-y-3 mb-6 sm:mb-10 px-2">
                <h2 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">
                    Rate Your <span className="text-blue-600">Teachers</span>
                </h2>
                <p className="text-gray-400 text-xs sm:text-sm font-medium max-w-md mx-auto">
                    Provide honest feedback on teaching performance — all submissions are 100% anonymous.
                </p>
            </div>

            {/* Empty / Done States */}
            {hasNoAssignments ? (
                <div className="max-w-lg mx-auto flex flex-col items-center justify-center py-16 sm:py-20 bg-white rounded-3xl border border-gray-100 shadow-xl text-center px-4">
                    <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-blue-50 flex items-center justify-center mb-4 sm:mb-6">
                        <BookOpen className="w-8 h-8 sm:w-10 sm:h-10 text-blue-400" />
                    </div>
                    <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">No Teachers Assigned Yet</h3>
                    <p className="text-gray-400 max-w-sm text-xs sm:text-sm">Your class has no active teacher allocations right now. Please check again later.</p>
                </div>
            ) : pendingTeachers.length === 0 ? (
                <div className="max-w-lg mx-auto flex flex-col items-center justify-center py-16 sm:py-20 bg-white rounded-3xl border border-gray-100 shadow-xl text-center px-4">
                    <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-green-50 flex items-center justify-center mb-4 sm:mb-6">
                        <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10 text-green-500" />
                    </div>
                    <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">All Done! 🎉</h3>
                    <p className="text-gray-400 max-w-sm text-xs sm:text-sm">You've submitted feedback for all your teachers. Thank you!</p>
                </div>
            ) : (
                <>
                    {/* Overall Progress Summary Bar */}
                    <div className="max-w-7xl mx-auto mb-6 sm:mb-8 px-2 sm:px-4">
                        <div className="flex items-center justify-between mb-2 sm:mb-3">
                            <div className="flex items-center gap-2 sm:gap-3">
                                <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                                    <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 fill-blue-600" />
                                </div>
                                <span className="text-xs sm:text-sm font-bold text-gray-700">
                                    {totalRated} / {pendingTeachers.length} <span className="text-gray-400 font-medium hidden sm:inline">Teachers fully rated</span>
                                </span>
                            </div>
                            <span className="text-xs sm:text-sm font-extrabold text-blue-600 bg-blue-50 px-2.5 sm:px-3 py-1 rounded-full">
                                {Math.round((totalRated / pendingTeachers.length) * 100)}% Complete
                            </span>
                        </div>
                        <div className="h-2.5 sm:h-3 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                            <motion.div
                                className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${(totalRated / pendingTeachers.length) * 100}%` }}
                                transition={{ type: 'spring', stiffness: 80, damping: 15 }}
                            />
                        </div>
                    </div>

                    {/* ═══════════════════════════════════════════════════════════
                        MOBILE VIEW: Dedicated Card Flow (Phone Screen Optimized)
                        ═══════════════════════════════════════════════════════════ */}
                    <div className="block md:hidden px-1 space-y-4">
                        {/* Mobile Teacher Pill Selector */}
                        <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                            {pendingTeachers.map((t, idx) => {
                                const prog = getProgress(t.allocation_id);
                                const isDone = prog === 10;
                                const isSelected = idx === safeMobileIdx;
                                return (
                                    <button
                                        key={t.allocation_id}
                                        onClick={() => setMobileTeacherIdx(idx)}
                                        className={cn(
                                            "flex-shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-2xl border text-xs font-bold transition-all cursor-pointer",
                                            isSelected
                                                ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200"
                                                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                                        )}
                                    >
                                        <span className="truncate max-w-[120px]">{t.teacher_name.split(' ')[0]}</span>
                                        <span className={cn(
                                            "text-[10px] px-1.5 py-0.5 rounded-full font-black",
                                            isSelected
                                                ? "bg-white/20 text-white"
                                                : isDone
                                                    ? "bg-emerald-100 text-emerald-700"
                                                    : "bg-slate-100 text-slate-600"
                                        )}>
                                            {isDone ? '✓ 10/10' : `${prog}/10`}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Active Teacher Card for Mobile */}
                        {currentMobileTeacher && (
                            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xl overflow-hidden p-4 sm:p-5 space-y-5">
                                {/* Teacher Header Info */}
                                <div className="flex items-center gap-3.5 pb-4 border-b border-slate-100">
                                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-md shrink-0">
                                        {currentMobileTeacher.teacher_name.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-base text-slate-900 leading-tight truncate">
                                            {currentMobileTeacher.teacher_name}
                                        </h3>
                                        <p className="text-xs font-semibold text-blue-600 mt-0.5 truncate">
                                            {currentMobileTeacher.subject_name} ({currentMobileTeacher.subject_code})
                                        </p>
                                        <div className="flex items-center gap-2 mt-1.5">
                                            <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                                <div 
                                                    className="bg-blue-600 h-full rounded-full transition-all duration-300"
                                                    style={{ width: `${(getProgress(currentMobileTeacher.allocation_id) / 10) * 100}%` }}
                                                />
                                            </div>
                                            <span className="text-[10px] font-black text-slate-500">
                                                {getProgress(currentMobileTeacher.allocation_id)}/10
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Questions List */}
                                <div className="space-y-4">
                                    {FEEDBACK_QUESTIONS.map((q, idx) => {
                                        const currentVal = feedbacks[currentMobileTeacher.allocation_id]?.ratings[q.key] || 0;
                                        return (
                                            <div
                                                key={q.key}
                                                className={cn(
                                                    "p-3.5 rounded-2xl border transition-all",
                                                    currentVal > 0
                                                        ? "bg-blue-50/20 border-blue-100"
                                                        : "bg-slate-50/50 border-slate-100"
                                                )}
                                            >
                                                <div className="flex items-start gap-2.5 mb-3">
                                                    <span className="shrink-0 h-5 w-5 rounded-md bg-white border border-slate-200 text-blue-600 text-[10px] font-black flex items-center justify-center shadow-2xs">
                                                        {(idx + 1).toString().padStart(2, '0')}
                                                    </span>
                                                    <p className="text-xs font-bold text-slate-800 leading-snug">
                                                        {q.label}
                                                    </p>
                                                </div>

                                                {/* Mobile Touch Rating Bar */}
                                                <div className="flex items-center justify-between gap-1 pt-1">
                                                    {[1, 2, 3, 4, 5].map((star) => {
                                                        const isSelected = currentVal === star;
                                                        const isFilled = currentVal >= star;
                                                        return (
                                                            <button
                                                                key={star}
                                                                type="button"
                                                                onClick={() => handleRatingChange(currentMobileTeacher.allocation_id, q.key, star)}
                                                                className={cn(
                                                                    "flex-1 flex flex-col items-center justify-center py-2.5 px-1 rounded-xl transition-all cursor-pointer active:scale-90 border",
                                                                    isSelected
                                                                        ? "bg-amber-50 border-amber-300 text-amber-500 shadow-xs"
                                                                        : isFilled
                                                                            ? "bg-amber-50/40 border-amber-200 text-amber-400"
                                                                            : "bg-white border-slate-200 text-slate-300 hover:text-amber-300"
                                                                )}
                                                            >
                                                                <Star
                                                                    size={24}
                                                                    fill={isFilled ? "currentColor" : "none"}
                                                                    strokeWidth={isFilled ? 0.5 : 1.5}
                                                                />
                                                                <span className="text-[10px] font-black mt-1">
                                                                    {star}
                                                                </span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>

                                                {currentVal > 0 && (
                                                    <p className="text-[11px] font-semibold text-amber-600 mt-2 text-right">
                                                        {RATING_TEXT[currentVal]}
                                                    </p>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Next / Prev Controls */}
                                <div className="flex gap-3 pt-3 border-t border-slate-100">
                                    <button
                                        onClick={() => setMobileTeacherIdx(Math.max(0, safeMobileIdx - 1))}
                                        disabled={safeMobileIdx === 0}
                                        className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                                    >
                                        <ChevronLeft size={16} /> Previous
                                    </button>
                                    <button
                                        onClick={() => setMobileTeacherIdx(Math.min(pendingTeachers.length - 1, safeMobileIdx + 1))}
                                        disabled={safeMobileIdx === pendingTeachers.length - 1}
                                        className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                                    >
                                        Next Teacher <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ═══════════════════════════════════════════════════════════
                        DESKTOP / LAPTOP VIEW (100% untouched for laptops)
                        ═══════════════════════════════════════════════════════════ */}
                    <div className="hidden md:block max-w-[1400px] mx-auto px-4">
                        <div className="relative bg-white rounded-[2rem] border border-gray-100 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.08)] overflow-hidden flex flex-row min-h-[700px]">
                            {/* Left Column: Fixed Questions */}
                            <div className="w-[340px] flex-shrink-0 bg-slate-50/50 border-r border-gray-100 flex flex-col">
                                {/* Fixed Sidebar Header Spacer */}
                                <div className="h-[180px] p-8 flex flex-col justify-end border-b border-gray-100/50">
                                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Feedback Criteria</h4>
                                    <p className="text-[13px] text-gray-500 font-medium leading-relaxed">Please rate each teacher based on the parameters listed below.</p>
                                </div>
                                
                                {/* Question Labels */}
                                <div className="flex-1 py-4">
                                    {FEEDBACK_QUESTIONS.map((q, idx) => (
                                        <div key={q.key} className="h-16 px-8 flex items-center border-b border-transparent">
                                            <div className="flex items-start gap-4">
                                                <span className="flex-shrink-0 h-6 w-6 rounded-lg bg-white border border-gray-200 text-blue-600 text-[11px] font-black flex items-center justify-center shadow-sm">
                                                    {(idx + 1).toString().padStart(2, '0')}
                                                </span>
                                                <p className="text-gray-700 text-[12px] font-semibold leading-snug line-clamp-5">
                                                    {q.label}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Right Column: Scrollable Teachers */}
                            <div className="flex-1 relative overflow-hidden flex flex-col">
                                {/* Navigation Arrows (Floating) */}
                                <AnimatePresence>
                                    {canScrollLeft && (
                                        <motion.button
                                            initial={{ opacity: 0, x: 10 }}
                                            animate={{ opacity: 1, x: 20 }}
                                            exit={{ opacity: 0, x: 10 }}
                                            onClick={() => scrollBy('left')}
                                            className="absolute left-0 top-[90px] -translate-y-1/2 z-30 bg-white border border-gray-200 shadow-2xl rounded-2xl p-4 text-gray-700 hover:text-blue-600 hover:border-blue-200 transition-all active:scale-90 cursor-pointer"
                                        >
                                            <ChevronLeft size={24} />
                                        </motion.button>
                                    )}
                                </AnimatePresence>

                                <AnimatePresence>
                                    {canScrollRight && (
                                        <motion.button
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: -20 }}
                                            exit={{ opacity: 0, x: -10 }}
                                            onClick={() => scrollBy('right')}
                                            className="absolute right-0 top-[90px] -translate-y-1/2 z-30 bg-white border border-gray-200 shadow-2xl rounded-2xl p-4 text-gray-700 hover:text-blue-600 hover:border-blue-200 transition-all active:scale-90 cursor-pointer"
                                        >
                                            <ChevronRight size={24} />
                                        </motion.button>
                                    )}
                                </AnimatePresence>

                                {/* Teacher Scroll Row */}
                                <div
                                    ref={scrollRef}
                                    className="flex overflow-x-auto scroll-smooth"
                                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                                >
                                    {pendingTeachers.map((teacher) => {
                                        const progress = getProgress(teacher.allocation_id);
                                        const isComplete = progress === 10;
                                        
                                        return (
                                            <div key={teacher.allocation_id} className="flex-shrink-0 w-[300px] border-r border-gray-100 last:border-r-0 flex flex-col group">
                                                {/* Teacher Card Header (Sticky part for this column) */}
                                                <div className={cn(
                                                    "h-[180px] p-6 flex flex-col items-center text-center transition-colors border-b border-gray-100",
                                                    isComplete ? "bg-blue-50/30" : "bg-white group-hover:bg-slate-50/50"
                                                )}>
                                                    <div className={cn(
                                                        "h-16 w-16 rounded-[1.25rem] flex items-center justify-center font-black text-2xl mb-3 shadow-md transition-transform group-hover:scale-105",
                                                        isComplete
                                                            ? "bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-blue-200"
                                                            : "bg-white border-2 border-slate-100 text-blue-600"
                                                    )}>
                                                        {teacher.teacher_name.charAt(0)}
                                                    </div>
                                                    <h3 className="text-[15px] font-bold text-gray-900 leading-tight line-clamp-1 w-full">{teacher.teacher_name}</h3>
                                                    <p className="text-blue-600 font-semibold text-[12px] mt-1 line-clamp-1 w-full px-2">{teacher.subject_name}</p>
                                                    <div className="mt-3 w-full max-w-[120px]">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">{progress}/10</span>
                                                            {isComplete && <CheckCircle2 size={12} className="text-blue-600" />}
                                                        </div>
                                                        <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                                                            <div 
                                                                className={cn("h-full transition-all duration-500", isComplete ? "bg-blue-600" : "bg-blue-400")}
                                                                style={{ width: `${(progress / 10) * 100}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Star Ratings Column */}
                                                <div className="flex-1 py-4">
                                                    {FEEDBACK_QUESTIONS.map((q) => {
                                                        const currentVal = feedbacks[teacher.allocation_id]?.ratings[q.key] || 0;
                                                        return (
                                                            <div key={q.key} className="h-16 flex items-center justify-center border-b border-gray-50/50 last:border-b-0 px-4">
                                                                <div className="flex items-center gap-1">
                                                                    {[1, 2, 3, 4, 5].map((star) => (
                                                                        <button
                                                                            key={star}
                                                                            type="button"
                                                                            onClick={() => handleRatingChange(teacher.allocation_id, q.key, star)}
                                                                            className={cn(
                                                                                "transition-all duration-200 focus:outline-none active:scale-75 cursor-pointer",
                                                                                currentVal >= star
                                                                                    ? "text-amber-400"
                                                                                    : "text-gray-300 hover:text-amber-300"
                                                                            )}
                                                                        >
                                                                            <Star
                                                                                size={20}
                                                                                fill={currentVal >= star ? "currentColor" : "none"}
                                                                                className={cn(currentVal >= star ? "drop-shadow-sm" : "")}
                                                                                strokeWidth={currentVal >= star ? 0.5 : 1.5}
                                                                            />
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Bottom Floating Submit Bar */}
            <AnimatePresence>
                {pendingTeachers.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 50 }}
                        className="fixed bottom-16 md:bottom-8 left-0 right-0 z-40 flex justify-center px-4"
                    >
                        <button
                            onClick={handleSubmitAll}
                            disabled={submitting}
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white px-8 sm:px-10 py-3.5 sm:py-4 rounded-2xl font-bold text-sm sm:text-base shadow-[0_16px_40px_-8px_rgba(37,99,235,0.45)] flex items-center gap-3 transition-all active:scale-95 group cursor-pointer w-full max-w-sm sm:w-auto justify-center"
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="animate-spin" size={18} />
                                    Submitting...
                                </>
                            ) : (
                                <>
                                    Submit All Feedback
                                    <Send size={18} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
