"use client"

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Lock, Calendar, ShieldCheck, ArrowRight, Laptop, GraduationCap, Loader2, Eye, EyeOff, BarChart3, Sparkles, BookOpen, Link as LinkIcon, LogIn, Star, CheckCircle2, X } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { Toast, ToastType } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';
import { Suspense } from 'react';

// ─── AcademicSession helpers ──────────────────────────────────────────────────
const LOGIN_MONTHS_FULL = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const LOGIN_MONTH_ABBR: Record<string, string> = {
  January:'Jan', February:'Feb', March:'Mar', April:'Apr',
  May:'May', June:'Jun', July:'Jul', August:'Aug',
  September:'Sep', October:'Oct', November:'Nov', December:'Dec',
};
const LOGIN_FULL_FROM_ABBR: Record<string, string> = Object.fromEntries(
  Object.entries(LOGIN_MONTH_ABBR).map(([k,v]) => [v,k])
);
function loginBuildSession(sf: string, ef: string, yr: string) {
  if (!sf || !ef || !yr) return '';
  return `${LOGIN_MONTH_ABBR[sf]}-${LOGIN_MONTH_ABBR[ef]} ${yr}`;
}
function loginParseSession(raw: string) {
  const m = raw.match(/^([A-Z][a-z]{2})-([A-Z][a-z]{2}) (\d{4})$/);
  if (!m) return { sf: 'June', ef: 'December', yr: String(new Date().getFullYear()) };
  return { sf: LOGIN_FULL_FROM_ABBR[m[1]] || 'June', ef: LOGIN_FULL_FROM_ABBR[m[2]] || 'December', yr: m[3] };
}
function loginYearOptions() {
  const now = new Date().getFullYear();
  return Array.from({ length: 8 }, (_, i) => String(now - 2 + i));
}

/** Compact 3-part AcademicSession selector for the student login form */
function LoginSessionSelector({
  value,
  onChange,
  locked,
}: {
  value: string;
  onChange: (v: string) => void;
  locked: boolean;
}) {
  const init = loginParseSession(value);
  const [sf, setSf] = React.useState(init.sf);
  const [ef, setEf] = React.useState(init.ef);
  const [yr, setYr] = React.useState(init.yr);
  const [err, setErr] = React.useState('');

  React.useEffect(() => {
    const p = loginParseSession(value);
    setSf(p.sf); setEf(p.ef); setYr(p.yr);
  }, [value]);

  const commit = (a: string, b: string, c: string) => {
    const si = LOGIN_MONTHS_FULL.indexOf(a);
    const ei = LOGIN_MONTHS_FULL.indexOf(b);
    if (si >= ei) { setErr('End month must be after the start month.'); return; }
    setErr('');
    onChange(loginBuildSession(a, b, c));
  };

  const preview = loginBuildSession(sf, ef, yr);
  const valid   = LOGIN_MONTHS_FULL.indexOf(sf) < LOGIN_MONTHS_FULL.indexOf(ef);
  const triggerCls = "bg-white/5 border-white/20 text-white focus:ring-blue-500/50 text-sm h-10";
  const years = loginYearOptions();

  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-1.5">
        <Select value={sf} onValueChange={v => { setSf(v); commit(v, ef, yr); }} disabled={locked}>
          <SelectTrigger className={triggerCls}><SelectValue placeholder="Start" /></SelectTrigger>
          <SelectContent>
            {LOGIN_MONTHS_FULL.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-slate-400 text-xs font-bold text-center">–</span>
        <Select value={ef} onValueChange={v => { setEf(v); commit(sf, v, yr); }} disabled={locked}>
          <SelectTrigger className={triggerCls}><SelectValue placeholder="End" /></SelectTrigger>
          <SelectContent>
            {LOGIN_MONTHS_FULL.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-slate-400 text-xs"></span>
        <Select value={yr} onValueChange={v => { setYr(v); commit(sf, ef, v); }} disabled={locked}>
          <SelectTrigger className={triggerCls}><SelectValue placeholder="Year" /></SelectTrigger>
          <SelectContent>
            {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {err && <p className="text-xs font-semibold text-red-400">⚠ {err}</p>}
      {preview && valid && (
        <p className="text-xs font-bold text-blue-300 mt-1">
          Session: <span className="text-white">{preview}</span>
        </p>
      )}
    </div>
  );
}

function LoginContent() {
  const router = useRouter();
  const [role, setRole] = useState<'student' | 'admin'>('student');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  // Student Fields
  const [session, setSession] = useState('Jun-Dec 2026');
  const [branch, setBranch] = useState('');
  const [year, setYear] = useState('');
  const [semester, setSemester] = useState('');
  const [section, setSection] = useState('');

  // Year to Semester mapping
  const YEAR_SEMESTER_MAP: Record<string, number[]> = {
    '1': [1, 2],
    '2': [3, 4],
    '3': [5, 6],
    '4': [7, 8]
  };

  const handleYearChange = (val: string) => {
    setYear(val);
    // If current semester is not in the new year's semesters, reset it
    const validSems = YEAR_SEMESTER_MAP[val] || [];
    if (!validSems.includes(parseInt(semester))) {
      setSemester('');
    }
  };

  const handleSemesterChange = (val: string) => {
    setSemester(val);
    const sem = parseInt(val);
    // Automatically set logical year
    if ([1, 2].includes(sem)) setYear('1');
    else if ([3, 4].includes(sem)) setYear('2');
    else if ([5, 6].includes(sem)) setYear('3');
    else if ([7, 8].includes(sem)) setYear('4');
  };

  // Admin Fields
  const [email, setEmail] = useState('');
  const [dob, setDob] = useState('');

  const [mounted, setMounted] = useState(false);
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get('token') || '';

  // URL Pre-set Parameters
  const sessionFromUrl = searchParams.get('session');
  const branchFromUrl = searchParams.get('branch');
  const yearFromUrl = searchParams.get('year');
  const semesterFromUrl = searchParams.get('semester');
  const sectionFromUrl = searchParams.get('section');

  // Persistent Device Fingerprinting
  const [fingerprint, setFingerprint] = useState('');

  useEffect(() => {
    setMounted(true);

    if (tokenFromUrl || searchParams.get('admin') === 'true') {
      setShowLogin(true);
    }

    // Auto-fill from URL if present
    if (sessionFromUrl) setSession(sessionFromUrl);
    if (branchFromUrl) setBranch(branchFromUrl);
    if (yearFromUrl) setYear(yearFromUrl);
    if (semesterFromUrl) setSemester(semesterFromUrl);
    if (sectionFromUrl) setSection(sectionFromUrl);

    // Persistent Student ID (Fingerprint) with 15-minute expiry
    if (typeof window !== 'undefined') {
      let stuId = localStorage.getItem('persistent_stu_id');
      let timestamp = localStorage.getItem('persistent_stu_timestamp');
      const now = Date.now();
      const expiryTime = 15 * 60 * 1000; // 15 minutes

      if (!stuId || !timestamp || (now - parseInt(timestamp) > expiryTime)) {
        // Generate new ID if missing or expired (older than 15 mins)
        stuId = 'STU-' + Math.random().toString(36).substring(2, 11).toUpperCase() +
          Date.now().toString(36).toUpperCase();
        localStorage.setItem('persistent_stu_id', stuId);
        localStorage.setItem('persistent_stu_timestamp', now.toString());
      }
      setFingerprint(stuId);
    }
  }, []);

  const [toast, setToast] = useState<{ msg: string; type: ToastType; visible: boolean }>({
    msg: '',
    type: 'info',
    visible: false,
  });

  const showToast = (msg: string, type: ToastType) => {
    setToast({ msg, type, visible: true });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    // Admin login
    if (role === 'admin') {
      if (!email || !dob) {
        showToast("Please fill in all fields.", "error");
        return;
      }
      setLoading(true);
      try {
        const res = await apiFetch('/dashboard-admin/login/', {
          method: "POST",
          body: JSON.stringify({ username: email, password: dob }),
        });
        const data = await res.json();
        if (data.status === "ok") {
          if (typeof window !== 'undefined') {
            localStorage.setItem("access_token", data.access);
            localStorage.setItem("admin_username", data.username);
            localStorage.setItem("username", data.username);
            if (data.user_id) {
              localStorage.setItem("user_id", String(data.user_id));
            }
            localStorage.setItem("user_role", data.role);
            localStorage.setItem("user_branches", JSON.stringify(data.branches || []));
            localStorage.setItem("is_admin", "true");
            if (data.is_first_login) {
              localStorage.setItem("is_first_login", "true");
            } else {
              localStorage.removeItem("is_first_login");
            }
          }
          showToast("Admin Login Successful! Redirecting...", "success");
          setTimeout(() => router.push('/admin'), 1500);
        } else {
          showToast(data.error || "Invalid credentials.", "error");
        }
      } catch (error) {
        showToast("Server connection failed. Is backend running?", "error");
      } finally {
        setLoading(false);
      }
      return;
    }

    // Student login
    const sigFromUrl = searchParams.get('sig') || '';
    if (!tokenFromUrl || !sigFromUrl) {
      showToast("Please use the complete authorized signed feedback link provided to you.", "error");
      return;
    }

    if (!session || !branch || !year || !semester || !section) {
      showToast("Please select all class details.", "error");
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch('/login/', {
        method: "POST",
        body: JSON.stringify({
          session,
          branch,
          year: parseInt(year),
          semester: parseInt(semester),
          section: parseInt(section),
          token: tokenFromUrl,
          sig: searchParams.get('sig') || '',
          fingerprint: fingerprint
        }),
      });
      const data = await res.json();
      if (data.status === "ok") {
        if (typeof window !== 'undefined') {
          localStorage.setItem("student_token", data.access);
          localStorage.setItem("enrollment", data.EnrollmentNo);
          localStorage.setItem("fullName", data.FullName);
          localStorage.setItem("session", data.session);
          localStorage.setItem("branch", data.branch);
          localStorage.setItem("year", data.year.toString());
          localStorage.setItem("semester", data.semester.toString());
          localStorage.setItem("section", data.section.toString());
        }
        showToast("Welcome! Redirecting to dashboard...", "success");
        setTimeout(() => router.push('/dashboard'), 1500);
      } else {
        const firstError = data.errors ? Object.values(data.errors).flat()[0] as string : data.error;
        showToast(firstError || "Could not verify class details.", "error");
      }
    } catch (error) {
      showToast("Server connection failed. Is backend running?", "error");
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen w-full flex flex-col bg-[#020617] text-slate-50 overflow-hidden font-sans">
      <Toast
        message={toast.msg}
        type={toast.type}
        isVisible={toast.visible}
        onClose={() => setToast(prev => ({ ...prev, visible: false }))}
      />

      {/* Decorative Background Elements */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse delay-700" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03]" />
      </div>

      <AnimatePresence mode="wait">
        {!showLogin ? (
          <motion.div
            key="landing"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50, scale: 0.95 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            className="flex-1 flex flex-col items-center justify-center relative z-10 px-4 sm:px-6 py-12 sm:py-20 text-center w-full max-w-7xl mx-auto min-h-screen"
          >
            <div className="bg-white/10 p-2 sm:p-3 rounded-2xl sm:rounded-[2rem] backdrop-blur-md border border-white/20 shadow-2xl mb-6 sm:mb-12">
              <Image src="/images/AITR-logo.jpg" alt="AITR Logo" width={180} height={50} className="object-contain rounded-xl sm:rounded-2xl bg-white p-2 w-[140px] sm:w-[180px]" />
            </div>

            <h1 className="text-3xl sm:text-6xl md:text-8xl font-black mb-4 sm:mb-8 tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 drop-shadow-lg leading-tight">
              Elevate the Future of Learning.
            </h1>

            <p className="text-sm sm:text-xl md:text-2xl text-slate-300 max-w-3xl mb-8 sm:mb-14 leading-relaxed font-medium px-2">
              The centralized <strong className="text-white">AITR Feedback Portal</strong> empowers students to provide secure, anonymous insights to actively shape academic excellence across all departments.
            </p>

            <div className="flex flex-col items-center gap-4 sm:gap-6 mb-12 sm:mb-24 z-20 w-full max-w-2xl mx-auto">
              <div className="flex flex-col sm:flex-row gap-3.5 sm:gap-6 w-full">
                <button
                  onClick={() => { setRole('student'); setShowLogin(true); }}
                  className="flex-1 py-4 sm:py-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl sm:rounded-2xl font-black text-base sm:text-lg shadow-[0_0_40px_-10px_rgba(79,70,229,0.7)] hover:shadow-[0_0_60px_-10px_rgba(79,70,229,0.9)] transition-all duration-300 transform active:scale-[0.98] sm:hover:-translate-y-2 flex items-center justify-center gap-3 border border-indigo-400/30 w-full cursor-pointer"
                >
                  <GraduationCap size={22} />
                  Give Feedback / Login
                  <ArrowRight size={18} className="animate-pulse" />
                </button>

                <button
                  onClick={() => { setRole('admin'); setShowLogin(true); }}
                  className="flex-1 py-4 sm:py-5 bg-white/5 hover:bg-white/10 rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg backdrop-blur-md border border-white/10 transition-all duration-300 transform active:scale-[0.98] sm:hover:-translate-y-2 flex items-center justify-center gap-3 text-slate-300 hover:text-white w-full cursor-pointer"
                >
                  <ShieldCheck size={22} />
                  Admin Portal
                </button>
              </div>
              <button
                onClick={() => setShowInstructions(true)}
                className="px-6 sm:px-8 py-3.5 sm:py-4 w-full sm:w-auto bg-white/5 hover:bg-slate-800/50 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base backdrop-blur-md border border-white/10 transition-all duration-300 flex items-center justify-center gap-3 text-slate-400 hover:text-white cursor-pointer"
              >
                <BookOpen size={20} className="text-indigo-400" />
                Instructions for Feedback
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-8 w-full max-w-6xl mb-10">
              {[
                { title: "100% Anonymous", desc: "Your identity is heavily encrypted and structurally decoupled from your feedback.", icon: User, color: "text-blue-400", bg: "bg-blue-500/10" },
                { title: "Data Science Driven", desc: "Employs statistical variance penalties and population outlier detection to threshold teacher performance.", icon: BarChart3, color: "text-indigo-400", bg: "bg-indigo-500/10" },
                { title: "Bias Reduction", desc: "Utilizes trimmed-mean algorithms to mathematically eliminate troll spam and rating biases.", icon: Sparkles, color: "text-purple-400", bg: "bg-purple-500/10" }
              ].map((feature, i) => (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 + (i * 0.2) }}
                  key={i}
                  className="p-6 sm:p-8 rounded-2xl sm:rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl hover:bg-white/10 transition-colors text-left group"
                >
                  <div className={`p-3.5 sm:p-4 rounded-xl sm:rounded-2xl w-fit mb-4 sm:mb-6 ${feature.bg} ${feature.color} border border-white/5 group-hover:scale-110 transition-transform`}>
                    <feature.icon size={24} className="sm:w-7 sm:h-7" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 sm:mb-3">{feature.title}</h3>
                  <p className="text-slate-400 font-medium text-sm sm:text-base leading-relaxed">{feature.desc}</p>
                </motion.div>
              ))}
            </div>

            <div className="mt-auto pt-6 sm:pt-10 text-center text-slate-500 text-xs sm:text-sm opacity-70">
              &copy; {new Date().getFullYear()} AITR feedback Portal. All rights reserved.
            </div>

            {/* Instructions Modal */}
            <AnimatePresence>
              {showInstructions && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm">
                  <motion.div
                    initial={{ y: 50, opacity: 0, scale: 0.9 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={{ y: 20, opacity: 0, scale: 0.95 }}
                    transition={{ type: "spring", duration: 0.5 }}
                    className="bg-[#0f172a] border border-slate-700 w-full max-w-4xl p-5 sm:p-8 rounded-2xl sm:rounded-[2rem] shadow-2xl relative text-left overflow-y-auto max-h-[90vh]"
                  >
                    <button
                      onClick={() => setShowInstructions(false)}
                      className="absolute top-4 sm:top-6 right-4 sm:right-6 p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-full transition-colors cursor-pointer"
                    >
                      <X size={20} className="sm:w-6 sm:h-6" />
                    </button>

                    <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 flex items-center gap-2.5 sm:gap-3 pr-8">
                      <BookOpen className="text-indigo-400 shrink-0" size={26} />
                      How to Give Feedback
                    </h2>
                    <p className="text-slate-400 text-xs sm:text-sm mb-6 border-b border-slate-800 pb-4 sm:pb-6">Follow these simple steps to successfully submit your anonymous review.</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-6 mb-6 sm:mb-8">
                      {[
                        { step: 1, title: "Access Your Link", desc: "Open the unique feedback link shared by your staff or faculty.", icon: LinkIcon, color: "text-blue-400", bg: "bg-blue-400/10" },
                        { step: 2, title: "Sign In as Student", desc: "Click the 'Give Feedback' button on the homepage and log in securely.", icon: LogIn, color: "text-indigo-400", bg: "bg-indigo-400/10" },
                        { step: 3, title: "Review Questions", desc: "A dashboard will appear featuring 10 distinct questions evaluating your teacher's performance.", icon: Star, color: "text-purple-400", bg: "bg-purple-400/10" },
                        { step: 4, title: "Rate & Submit", desc: "Rate each question on a Star scale where 5 is Highest and 1 is Lowest. Attempt all questions.", icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-400/10" }
                      ].map((item, i) => (
                        <div key={i} className="flex gap-4 p-4 sm:p-5 bg-white/5 border border-white/5 rounded-xl sm:rounded-2xl hover:bg-white/10 transition-colors">
                          <div className={`shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center font-bold text-lg sm:text-xl ${item.bg} ${item.color}`}>
                            {item.step}
                          </div>
                          <div>
                            <h3 className="text-base sm:text-lg font-bold text-slate-200 mb-1">{item.title}</h3>
                            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">{item.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end pt-4 sm:pt-6 border-t border-slate-800">
                      <button
                        onClick={() => setShowInstructions(false)}
                        className="w-full sm:w-auto px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-colors shadow-lg shadow-indigo-600/30 cursor-pointer text-sm sm:text-base"
                      >
                        Understood!
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.div
            key="login"
            initial={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="flex-1 flex flex-col lg:flex-row w-full h-full min-h-screen relative z-10"
          >
            {/* Mobile Header (Shown on mobile/tablet, hidden on laptop/desktop) */}
            <div className="lg:hidden flex items-center justify-between p-4 pt-6 pb-2 z-20">
              <button onClick={() => setShowLogin(false)} className="bg-white/10 hover:bg-white/20 text-white inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl backdrop-blur-md transition-all font-bold border border-white/10 text-xs cursor-pointer">
                ← Home
              </button>
              <div className="bg-white px-3 py-1.5 rounded-xl shadow-md">
                <Image src="/images/AITR-logo.jpg" alt="AITR Logo" width={110} height={32} className="object-contain" />
              </div>
            </div>

            {/* Left Section - Hero/Branding (Laptop/Desktop only - 100% untouched for laptops) */}
            <div className="hidden lg:flex relative lg:w-1/2 flex-col justify-center px-8 lg:px-24 pb-24 pt-20 z-10">
              <div className="flex flex-col items-start gap-6 mb-14">
                <button onClick={() => setShowLogin(false)} className="bg-white/10 hover:bg-white/20 text-white inline-flex items-center gap-2 px-4 py-2 rounded-xl backdrop-blur-md transition-all font-bold border border-white/10 text-sm cursor-pointer">
                  ← Back to Home
                </button>
                <div className="bg-white inline-block px-6 py-4 rounded-3xl shadow-xl shadow-white/5 ring-1 ring-white/10">
                  <Image src="/images/AITR-logo.jpg" alt="AITR Logo" width={200} height={60} className="object-contain" />
                </div>
              </div>

              <h1 className="text-5xl lg:text-7xl font-extrabold mb-8 leading-tight">
                Shape the <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Future</span> of Education.
              </h1>
              <p className="text-xl text-slate-400 mb-12 max-w-lg leading-relaxed">
                The Teacher Feedback System empowers students to provide constructive insights, helping our institution achieve excellence in teaching and learning.
              </p>

              <div className="grid grid-cols-2 gap-6 max-w-md">
                <div className="p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-colors">
                  <ShieldCheck className="text-blue-400 mb-4" size={28} />
                  <h4 className="font-bold text-white mb-2 text-lg">Secure</h4>
                  <p className="text-sm text-slate-400">Your feedback is anonymous and safely encrypted.</p>
                </div>
                <div className="p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-colors">
                  <Laptop className="text-indigo-400 mb-4" size={28} />
                  <h4 className="font-bold text-white mb-2 text-lg">Easy Access</h4>
                  <p className="text-sm text-slate-400">Provide your valuable insights anytime, anywhere.</p>
                </div>
              </div>
            </div>

            {/* Right Section - Login Card (Fully Responsive for Phone & Laptop) */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8 lg:p-12 lg:pb-28 pt-4 sm:pt-8 lg:pt-24 z-10">
              <div className="w-full max-w-md bg-white/5 border border-white/10 backdrop-blur-2xl rounded-2xl sm:rounded-3xl p-5 sm:p-8 lg:p-10 shadow-2xl relative">
                {/* Subtle reflection effect */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                <div className="mb-6 sm:mb-8 text-center">
                  <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1 sm:mb-2">Welcome Login</h2>
                  {role === 'student' && (!tokenFromUrl || !searchParams.get('sig')) ? (
                    <p className="text-red-400 text-xs sm:text-sm font-medium">Signed access link required. Please use the link provided by admin.</p>
                  ) : (
                    <p className="text-slate-400 text-xs sm:text-sm">Sign in to share your valuable feedback</p>
                  )}
                </div>

                <div className="flex mb-6 sm:mb-8 p-1 bg-white/5 rounded-xl sm:rounded-2xl border border-white/10">
                  <button
                    onClick={() => setRole('student')}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-2.5 sm:py-3 text-xs sm:text-sm font-bold rounded-lg sm:rounded-xl transition-all duration-300 cursor-pointer",
                      role === 'student'
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                        : "text-slate-400 hover:text-slate-200"
                    )}
                  >
                    <GraduationCap size={18} />
                    Student
                  </button>
                  <button
                    onClick={() => setRole('admin')}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-2.5 sm:py-3 text-xs sm:text-sm font-bold rounded-lg sm:rounded-xl transition-all duration-300 cursor-pointer",
                      role === 'admin'
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                        : "text-slate-400 hover:text-slate-200"
                    )}
                  >
                    <ShieldCheck size={18} />
                    Admin
                  </button>
                </div>

                <AnimatePresence mode="wait">
                  <motion.form
                    key={role}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    onSubmit={handleLogin}
                    className="space-y-4 sm:space-y-6"
                  >
                    <div className="space-y-4 sm:space-y-5">
                      {role === 'student' ? (
                        <>
                          <div className="space-y-1.5 mb-2 sm:mb-4">
                            <label className="text-xs sm:text-sm font-semibold text-slate-300 ml-1">Feedback Conducting Session</label>
                            <LoginSessionSelector
                              value={session}
                              onChange={setSession}
                              locked={!!sessionFromUrl}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3 sm:gap-4">
                            <div className="space-y-1.5">
                              <label className="text-xs sm:text-sm font-semibold text-slate-300 ml-1">Branch</label>
                              <Select value={branch} onValueChange={setBranch} disabled={!!branchFromUrl}>
                                <SelectTrigger className="bg-white/5 border-white/12 text-white focus:ring-blue-500/50 text-xs sm:text-sm h-10 sm:h-11">
                                  <SelectValue placeholder="Branch" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="CSE">CSE</SelectItem>
                                  <SelectItem value="CSE(RL)">CSE(RL)</SelectItem>
                                  <SelectItem value="IT">IT</SelectItem>
                                  <SelectItem value="CSE(DS)">CSE(DS)</SelectItem>
                                  <SelectItem value="CSE(CY)">CSE(CY)</SelectItem>
                                  <SelectItem value="CSIT">CSIT</SelectItem>
                                  <SelectItem value="CSE(AIML)">CSE(AIML)</SelectItem>
                                  <SelectItem value="ME">ME</SelectItem>
                                  <SelectItem value="CE">CE</SelectItem>
                                  <SelectItem value="EC">EC</SelectItem>
                                  <SelectItem value="EC-ACT">EC-ACT</SelectItem>
                                  <SelectItem value="EC-VLSI">EC-VLSI</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-xs sm:text-sm font-semibold text-slate-300 ml-1">Year</label>
                              <Select value={year} onValueChange={handleYearChange} disabled={!!yearFromUrl}>
                                <SelectTrigger className="bg-white/5 border-white/10 text-white focus:ring-blue-500/50 text-xs sm:text-sm h-10 sm:h-11">
                                  <SelectValue placeholder="Year" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="1">1st Year</SelectItem>
                                  <SelectItem value="2">2nd Year</SelectItem>
                                  <SelectItem value="3">3rd Year</SelectItem>
                                  <SelectItem value="4">4th Year</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 sm:gap-4">
                            <div className="space-y-1.5">
                              <label className="text-xs sm:text-sm font-semibold text-slate-300 ml-1">Semester</label>
                              <Select value={semester} onValueChange={handleSemesterChange} disabled={!!semesterFromUrl}>
                                <SelectTrigger className="bg-white/5 border-white/10 text-white focus:ring-blue-500/50 text-xs sm:text-sm h-10 sm:h-11">
                                  <SelectValue placeholder="Semester" />
                                </SelectTrigger>
                                <SelectContent>
                                  {(year ? YEAR_SEMESTER_MAP[year] : [1, 2, 3, 4, 5, 6, 7, 8]).map(s => (
                                    <SelectItem key={s} value={s.toString()}>{s}th Sem</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-xs sm:text-sm font-semibold text-slate-300 ml-1">Section</label>
                              <Select value={section} onValueChange={setSection} disabled={!!sectionFromUrl}>
                                <SelectTrigger className="bg-white/5 border-white/10 text-white focus:ring-blue-500/50 text-xs sm:text-sm h-10 sm:h-11">
                                  <SelectValue placeholder="Section" />
                                </SelectTrigger>
                                <SelectContent>
                                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(s => (
                                    <SelectItem key={s} value={s.toString()}>Section {s}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="space-y-1.5">
                            <label className="text-xs sm:text-sm font-semibold text-slate-300 ml-1">Admin Username</label>
                            <Input
                              type="text"
                              placeholder="Enter Admin Username"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              icon={<ShieldCheck size={18} />}
                              className="focus:border-blue-500/50 h-11 text-sm"
                              required
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs sm:text-sm font-semibold text-slate-300 ml-1">Password</label>
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder="Enter Password"
                              value={dob}
                              onChange={(e) => setDob(e.target.value)}
                              icon={<Lock size={18} />}
                              rightElement={
                                <button
                                  type="button"
                                  onClick={() => setShowPassword(!showPassword)}
                                  className="p-1 focus:outline-none flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity cursor-pointer"
                                >
                                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                              }
                              className="focus:border-blue-500/50 h-11 text-sm"
                              required
                            />
                          </div>
                        </>
                      )}
                    </div>

                    <Button
                      type="submit"
                      variant="primary"
                      size="lg"
                      className="w-full h-12 sm:h-14 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 border-none group cursor-pointer text-sm sm:text-base font-bold shadow-lg shadow-blue-600/30 active:scale-[0.98]"
                      isLoading={loading}
                    >
                      <span className="flex items-center justify-center gap-2">
                        {role === 'student' ? 'Sign In as Student' : 'Sign In as Admin'}
                        {!loading && <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />}
                      </span>
                    </Button>
                  </motion.form>
                </AnimatePresence>

                <p className="text-center text-slate-500 text-[11px] sm:text-xs mt-6 sm:mt-8">
                  &copy; {new Date().getFullYear()} AITR feedback Portal. All rights reserved.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
