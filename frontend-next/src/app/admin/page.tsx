"use client"
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Database, Loader2, AlertCircle, Edit, Trash2, ChevronLeft, ChevronRight, Search, X, Save, ArrowUpDown, ArrowUp, ArrowDown, Copy, RefreshCw, Key, Link, BarChart3, TableProperties, Plus, Minus, Shield, User, BookText, Briefcase, Calendar, School, Hash, GraduationCap, ClipboardEdit, Eye, EyeOff, Lock, ShieldCheck, Download, CheckCircle2, Clock, Users, Ban, Power, ExternalLink, QrCode, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import API_BASE_URL from '@/config';
import { apiFetch } from '@/lib/api';
import { Toast, ToastType } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import PerformanceReport from './components/PerformanceReport';
import DateRangeSelector from './components/DateRangeSelector';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/Select";

export interface AccessGrantItem {
    id: number;
    grant_token: string;
    access: string;
    session: string;
    branch: string;
    year: number;
    semester: number;
    section: number;
    created_at: string | null;
    expires_at: string | null;
    is_active: boolean;
    is_expired: boolean;
    max_responses: number;
    response_count: number;
    created_by: string;
}

interface Table {
    table_name: string;
    model_name: string;
    row_count: number;
}

interface TableData {
    model_name: string;
    table_name: string;
    pk_field: string;
    fields: string[];
    field_meta?: Record<string, { type: string; required: boolean; is_auto?: boolean; choices?: { value: any; label: string }[] }>;
    data: any[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
}

const formatLabel = (label: string) => {
    return label
        .replace(/_/g, ' ')
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (str) => str.toUpperCase())
        .trim()
        .replace(/\s+/g, ' ');
};

const formatDurationLabel = (minsStr: string) => {
    const mins = parseInt(minsStr) || 0;
    if (mins <= 0) return 'Custom Time';
    if (mins < 60) return `${mins} Mins`;
    const hours = Math.floor(mins / 60);
    const rem = mins % 60;
    if (rem === 0) return hours === 1 ? '1 Hour' : `${hours} Hours`;
    return `${hours}h ${rem}m`;
};

const MASKED_PASSWORD_VALUE = '********';

// ─── Month helpers ────────────────────────────────────────────────────────────
const MONTHS_FULL = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
];
const MONTH_ABBR: Record<string, string> = {
    January:'Jan', February:'Feb', March:'Mar', April:'Apr',
    May:'May', June:'Jun', July:'Jul', August:'Aug',
    September:'Sep', October:'Oct', November:'Nov', December:'Dec',
};
const FULL_FROM_ABBR: Record<string, string> = Object.fromEntries(
    Object.entries(MONTH_ABBR).map(([k, v]) => [v, k])
);

function buildSessionString(startFull: string, endFull: string, year: string): string {
    if (!startFull || !endFull || !year) return '';
    return `${MONTH_ABBR[startFull]}-${MONTH_ABBR[endFull]} ${year}`;
}

function parseSessionString(raw: string): { startFull: string; endFull: string; year: string } {
    // e.g. "Jun-Dec 2026"
    const m = raw.match(/^([A-Z][a-z]{2})-([A-Z][a-z]{2}) (\d{4})$/);
    if (!m) return { startFull: '', endFull: '', year: '' };
    return {
        startFull: FULL_FROM_ABBR[m[1]] || '',
        endFull:   FULL_FROM_ABBR[m[2]] || '',
        year:      m[3],
    };
}

function generateYearOptions(): string[] {
    const now = new Date().getFullYear();
    const years: string[] = [];
    for (let y = now - 2; y <= now + 5; y++) years.push(String(y));
    return years;
}

// ─── AcademicSessionInput ─────────────────────────────────────────────────────
const AcademicSessionInput = ({
    value,
    onChange,
}: {
    value: string;
    onChange: (val: string) => void;
}) => {
    const parsed = parseSessionString(value || '');
    const [startFull, setStartFull] = React.useState(parsed.startFull || 'June');
    const [endFull,   setEndFull]   = React.useState(parsed.endFull   || 'December');
    const [year,      setYear]      = React.useState(parsed.year      || String(new Date().getFullYear()));
    const [error,     setError]     = React.useState('');

    // Sync internal state when external value changes (e.g. when editing an existing row)
    React.useEffect(() => {
        const p = parseSessionString(value || '');
        if (p.startFull) setStartFull(p.startFull);
        if (p.endFull)   setEndFull(p.endFull);
        if (p.year)      setYear(p.year);
    }, [value]);

    const commit = (sf: string, ef: string, yr: string) => {
        const startIdx = MONTHS_FULL.indexOf(sf);
        const endIdx   = MONTHS_FULL.indexOf(ef);
        if (startIdx >= endIdx) {
            setError('End month must be after the start month.');
            // Still write partial so user can see it; don't propagate
            return;
        }
        setError('');
        onChange(buildSessionString(sf, ef, yr));
    };

    const yearOptions = generateYearOptions();
    const sessionPreview = buildSessionString(startFull, endFull, year);
    const isValid = MONTHS_FULL.indexOf(startFull) < MONTHS_FULL.indexOf(endFull);

    const selectClass = "w-full pl-3 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-semibold text-sm shadow-sm hover:border-slate-300 h-auto";

    return (
        <div className="space-y-2">
            <div className="grid grid-cols-[1fr_auto_1fr_1fr] items-center gap-2">
                {/* Start Month */}
                <Select value={startFull} onValueChange={(v) => { setStartFull(v); commit(v, endFull, year); }}>
                    <SelectTrigger className={selectClass}>
                        <SelectValue placeholder="Start Month" />
                    </SelectTrigger>
                    <SelectContent>
                        {MONTHS_FULL.map(m => (
                            <SelectItem key={m} value={m} className="font-medium text-slate-700 focus:bg-indigo-50 focus:text-indigo-700 cursor-pointer">{m}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <span className="text-slate-400 font-bold text-center select-none">—</span>

                {/* End Month */}
                <Select value={endFull} onValueChange={(v) => { setEndFull(v); commit(startFull, v, year); }}>
                    <SelectTrigger className={selectClass}>
                        <SelectValue placeholder="End Month" />
                    </SelectTrigger>
                    <SelectContent>
                        {MONTHS_FULL.map(m => (
                            <SelectItem key={m} value={m} className="font-medium text-slate-700 focus:bg-indigo-50 focus:text-indigo-700 cursor-pointer">{m}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Year */}
                <Select value={year} onValueChange={(v) => { setYear(v); commit(startFull, endFull, v); }}>
                    <SelectTrigger className={selectClass}>
                        <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                        {yearOptions.map(y => (
                            <SelectItem key={y} value={y} className="font-medium text-slate-700 focus:bg-indigo-50 focus:text-indigo-700 cursor-pointer">{y}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Validation error */}
            {error && (
                <p className="text-xs font-semibold text-rose-500 flex items-center gap-1">
                    <span>⚠</span> {error}
                </p>
            )}

            {/* Preview */}
            {sessionPreview && isValid && (
                <p className="text-xs font-bold text-indigo-600 bg-indigo-50 rounded-lg px-3 py-1.5 inline-block">
                    Selected Session: <span className="font-extrabold">{sessionPreview}</span>
                </p>
            )}
        </div>
    );
};

// ─── ForeignKeySearchSelect ───────────────────────────────────────────────────
const ForeignKeySearchSelect = ({
    field,
    value,
    onChange,
    targetTable,
    placeholder,
}: {
    field: string;
    value: string;
    onChange: (val: string) => void;
    targetTable: 'faculty_teacher' | 'academic_subject';
    placeholder?: string;
}) => {
    const isTeacher = targetTable === 'faculty_teacher';
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<any[]>([]);
    const [selectedDetail, setSelectedDetail] = useState<any | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Fetch initial details if value is present
    useEffect(() => {
        if (!value) {
            setSelectedDetail(null);
            return;
        }

        const currentCode = isTeacher ? selectedDetail?.TeacherID : selectedDetail?.SubjectCode;
        if (currentCode === value) return;

        let isMounted = true;
        const pkField = isTeacher ? 'TeacherID' : 'SubjectCode';
        apiFetch(`/dashboard-admin/table/${targetTable}/?q=${encodeURIComponent(value)}&page_size=5`)
            .then(res => res.json())
            .then(data => {
                if (!isMounted) return;
                if (data.status === 'ok' && Array.isArray(data.data)) {
                    const match = data.data.find((item: any) => String(item[pkField]).toUpperCase() === String(value).toUpperCase());
                    if (match) {
                        setSelectedDetail(match);
                    }
                }
            })
            .catch(() => {});

        return () => {
            isMounted = false;
        };
    }, [value, targetTable, isTeacher]);

    // Handle search-as-you-type with debouncing
    const fetchResults = useCallback((searchTerm: string) => {
        setLoading(true);
        const searchParam = searchTerm.trim();
        const url = searchParam
            ? `/dashboard-admin/table/${targetTable}/?q=${encodeURIComponent(searchParam)}&page_size=15`
            : `/dashboard-admin/table/${targetTable}/?page_size=15`;

        apiFetch(url)
            .then(res => res.json())
            .then(data => {
                if (data.status === 'ok' && Array.isArray(data.data)) {
                    setResults(data.data);
                } else {
                    setResults([]);
                }
            })
            .catch(() => {
                setResults([]);
            })
            .finally(() => {
                setLoading(false);
            });
    }, [targetTable]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setQuery(val);
        setIsOpen(true);

        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
            fetchResults(val);
        }, 250);
    };

    const handleFocus = () => {
        setIsOpen(true);
        if (results.length === 0) {
            fetchResults(query);
        }
    };

    const handleSelect = (item: any) => {
        const selectedCode = isTeacher ? item.TeacherID : item.SubjectCode;
        setSelectedDetail(item);
        onChange(selectedCode);
        setQuery('');
        setIsOpen(false);
    };

    const handleClear = () => {
        setSelectedDetail(null);
        onChange('');
        setQuery('');
        setIsOpen(true);
        fetchResults('');
    };

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        };
    }, []);

    // ── When a value is selected ──────────────────────────────────────────
    if (value) {
        return (
            <div className="relative group">
                <div className="w-full flex items-center justify-between p-2.5 px-3.5 bg-gradient-to-r from-indigo-50/70 to-slate-50 border border-indigo-200/80 rounded-xl shadow-sm transition-all hover:border-indigo-300">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className={cn(
                            "p-2 rounded-lg flex-shrink-0",
                            isTeacher ? "bg-indigo-100 text-indigo-700" : "bg-violet-100 text-violet-700"
                        )}>
                            {isTeacher ? <User size={18} /> : <BookText size={18} />}
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <span className={cn(
                                    "font-mono font-black text-xs px-2 py-0.5 rounded-md",
                                    isTeacher ? "bg-indigo-600 text-white" : "bg-violet-600 text-white"
                                )}>
                                    {value}
                                </span>
                                {selectedDetail && (
                                    <span className="text-xs font-bold text-slate-800 truncate">
                                        {isTeacher ? selectedDetail.FullName : selectedDetail.SubjectName}
                                    </span>
                                )}
                            </div>
                            {selectedDetail && (
                                <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                                    {isTeacher
                                        ? (selectedDetail.Designation || 'Faculty')
                                        : `${selectedDetail.Branch || ''}${selectedDetail.Semester ? ` • Sem ${selectedDetail.Semester}` : ''}`}
                                </p>
                            )}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleClear}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all ml-2 flex-shrink-0"
                        title="Change selection"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>
        );
    }

    // ── When searching (no value selected) ─────────────────────────────────
    return (
        <div ref={containerRef} className="relative">
            <div className="relative group">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors group-focus-within:text-indigo-600 z-10 text-slate-400">
                    {loading ? (
                        <Loader2 size={16} className="animate-spin text-indigo-500" />
                    ) : isTeacher ? (
                        <User size={16} />
                    ) : (
                        <BookText size={16} />
                    )}
                </div>
                <input
                    type="text"
                    value={query}
                    onChange={handleInputChange}
                    onFocus={handleFocus}
                    placeholder={placeholder || (isTeacher ? "Search Teacher ID or Name..." : "Search Subject Code or Name...")}
                    className="w-full pl-10 pr-10 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-semibold text-sm placeholder:text-slate-400 placeholder:font-normal shadow-sm hover:border-slate-300"
                />
                {query && (
                    <button
                        type="button"
                        onClick={() => { setQuery(''); fetchResults(''); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md"
                    >
                        <X size={14} />
                    </button>
                )}
            </div>

            {/* Dropdown Results */}
            {isOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto custom-scrollbar divide-y divide-slate-100">
                    {loading && results.length === 0 ? (
                        <div className="p-4 flex items-center justify-center gap-2 text-xs font-semibold text-slate-500">
                            <Loader2 size={16} className="animate-spin text-indigo-600" />
                            <span>Searching {isTeacher ? 'teachers' : 'subjects'}...</span>
                        </div>
                    ) : results.length > 0 ? (
                        results.map((item) => {
                            const code = isTeacher ? item.TeacherID : item.SubjectCode;
                            const title = isTeacher ? item.FullName : item.SubjectName;
                            const subtitle = isTeacher
                                ? item.Designation
                                : `${item.Branch || ''}${item.Semester ? ` • Semester ${item.Semester}` : ''}`;

                            return (
                                <button
                                    key={code}
                                    type="button"
                                    onClick={() => handleSelect(item)}
                                    className="w-full px-3.5 py-2.5 text-left hover:bg-indigo-50/70 transition-colors flex items-center justify-between group cursor-pointer"
                                >
                                    <div className="min-w-0 pr-2">
                                        <div className="flex items-center gap-2">
                                            <span className={cn(
                                                "font-mono font-extrabold text-xs px-2 py-0.5 rounded border transition-colors",
                                                isTeacher 
                                                    ? "bg-indigo-50 border-indigo-200 text-indigo-700 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600" 
                                                    : "bg-violet-50 border-violet-200 text-violet-700 group-hover:bg-violet-600 group-hover:text-white group-hover:border-violet-600"
                                            )}>
                                                {code}
                                            </span>
                                            <span className="text-xs font-bold text-slate-800 truncate">
                                                {title}
                                            </span>
                                        </div>
                                        {subtitle && (
                                            <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5 pl-0.5">
                                                {subtitle}
                                            </p>
                                        )}
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400 group-hover:text-indigo-600 uppercase tracking-wider flex-shrink-0">
                                        Select
                                    </span>
                                </button>
                            );
                        })
                    ) : (
                        <div className="p-4 text-center text-xs font-semibold text-slate-400">
                            {query ? (isTeacher ? 'No teachers found' : 'No subjects found') : (isTeacher ? 'Type to search teachers...' : 'Type to search subjects...')}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const getFieldIcon = (field: string) => {
    const f = field.toLowerCase();
    if (f.includes('teacher') || f.includes('faculty')) return <User size={16} className="text-indigo-500" />;
    if (f.includes('subject') || f.includes('code')) return <BookText size={16} className="text-violet-500" />;
    if (f.includes('branch')) return <Briefcase size={16} className="text-blue-500" />;
    if (f.includes('year')) return <Calendar size={16} className="text-amber-500" />;
    if (f.includes('semester')) return <School size={16} className="text-emerald-500" />;
    if (f.includes('section')) return <Hash size={16} className="text-rose-500" />;
    if (f.includes('name')) return <GraduationCap size={16} className="text-cyan-500" />;
    return <ClipboardEdit size={16} className="text-slate-400" />;
};

const RenderInputInner = ({
    field,
    value,
    onChange,
    isPk,
    tableData,
    allData = {},
    disabled = false
}: {
    field: string,
    value: any,
    onChange: (val: any) => void,
    isPk: boolean,
    tableData: TableData | null,
    allData?: any,
    disabled?: boolean
}) => {
    const [showPassword, setShowPassword] = useState(false);
    if (!tableData) return null;

    const meta = tableData.field_meta?.[field] || { type: 'text', required: false, is_auto: false, choices: [] };

    // ── AcademicSession: dynamic 3-part selector ─────────────────────────────
    if (meta.type === 'academicsession') {
        return <AcademicSessionInput value={value ?? ''} onChange={onChange} />;
    }

    // ── Teacher Autocomplete Search (Foreign Key) ─────────────────────────────
    if (!isPk && (meta.type === 'teacher_search' || field.toLowerCase() === 'teacherid' || field.toLowerCase() === 'teacher_id')) {
        return (
            <ForeignKeySearchSelect
                field={field}
                value={String(value ?? '')}
                onChange={onChange}
                targetTable="faculty_teacher"
                placeholder="Search Teacher ID or Name..."
            />
        );
    }

    // ── Subject Autocomplete Search (Foreign Key) ─────────────────────────────
    if (!isPk && (meta.type === 'subject_search' || field.toLowerCase() === 'subjectcode' || field.toLowerCase() === 'subject_code')) {
        return (
            <ForeignKeySearchSelect
                field={field}
                value={String(value ?? '')}
                onChange={onChange}
                targetTable="academic_subject"
                placeholder="Search Subject Code or Name..."
            />
        );
    }

    // Smart Year/Semester Filtering
    let choices = meta.choices || [];
    if (field.toLowerCase().includes('semester')) {
        const yearField = tableData.fields.find(f => f.toLowerCase().includes('year'));
        if (yearField) {
            const currentYear = Number(allData[yearField]);
            if (currentYear) {
                const startSem = (currentYear - 1) * 2 + 1;
                const endSem = currentYear * 2;
                choices = (meta.choices || []).filter(c => {
                    const v = Number(c.value);
                    return v >= startSem && v <= endSem;
                });
            }
        }
    }

    if (meta.type === 'select' && choices.length > 0) {
        return (
            <Select
                value={String(value ?? '')}
                onValueChange={(val) => {
                    const choice = meta.choices?.find(c => String(c.value) === val);
                    onChange(choice ? choice.value : val);
                }}
                disabled={disabled}
            >
                <div className="relative group">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10 transition-colors group-focus-within:text-indigo-600">
                        {getFieldIcon(field)}
                    </div>
                    <SelectTrigger className={cn(
                        "w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-semibold text-sm shadow-sm hover:border-slate-300 h-auto",
                        disabled && "opacity-60 cursor-not-allowed bg-slate-50"
                    )}>
                        <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                </div>
                <SelectContent>
                    {choices.map((c: any) => (
                        <SelectItem
                            key={String(c.value)}
                            value={String(c.value)}
                            className="font-medium text-slate-700 focus:bg-indigo-50 focus:text-indigo-700 cursor-pointer"
                        >
                            {c.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        );
    }

    if (meta.type === 'boolean') {
        const boolChoices = [
            { value: 'true', label: 'True' },
            { value: 'false', label: 'False' }
        ];
        return (
            <Select
                value={value === true ? 'true' : value === false ? 'false' : ''}
                onValueChange={(val) => onChange(val === 'true')}
                disabled={disabled}
            >
                <div className="relative group">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10 transition-colors group-focus-within:text-indigo-600">
                        <Shield size={16} className="text-emerald-500" />
                    </div>
                    <SelectTrigger className={cn(
                        "w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-semibold text-sm shadow-sm hover:border-slate-300 h-auto",
                        disabled && "opacity-60 cursor-not-allowed bg-slate-50"
                    )}>
                        <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                </div>
                <SelectContent>
                    {boolChoices.map((c) => (
                        <SelectItem
                            key={c.value}
                            value={c.value}
                            className="font-medium text-slate-700 focus:bg-indigo-50 focus:text-indigo-700 cursor-pointer"
                        >
                            {c.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        );
    }

    if (meta.type === 'multi-select' || field === 'branches') {
        const selectedValues = Array.isArray(value) ? value : [];
        return (
            <div className="border border-slate-200 rounded-xl bg-white p-4 max-h-48 overflow-y-auto custom-scrollbar shadow-sm">
                <div className="grid grid-cols-2 gap-y-3 gap-x-6">
                    {choices.map((c: any) => {
                        const isChecked = selectedValues.includes(c.value);
                        return (
                            <label 
                                key={c.value} 
                                className="flex items-center gap-3 cursor-pointer group"
                            >
                                <div className={cn(
                                    "w-5 h-5 rounded border flex items-center justify-center transition-all",
                                    isChecked ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-slate-300 group-hover:border-slate-400"
                                )}>
                                    <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={(e) => {
                                            let next;
                                            if (e.target.checked) {
                                                next = [...selectedValues, c.value];
                                            } else {
                                                next = selectedValues.filter((v: any) => v !== c.value);
                                            }
                                            onChange(next);
                                        }}
                                        className="sr-only"
                                    />
                                    {isChecked && (
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                    )}
                                </div>
                                <span className={cn(
                                    "text-xs font-bold transition-colors",
                                    isChecked ? "text-indigo-700 font-extrabold" : "text-slate-600"
                                )}>
                                    {c.label}
                                </span>
                            </label>
                        );
                    })}
                </div>
            </div>
        );
    }

    const isPasswordField = field.toLowerCase() === 'password';
    const isMaskedPasswordPlaceholder = isPasswordField && value === MASKED_PASSWORD_VALUE;
    const inputValue = isMaskedPasswordPlaceholder ? '' : (value ?? '');

    return (
        <div className="relative group">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none transition-colors group-focus-within:text-indigo-600 z-10">
                {isPasswordField ? <Key size={16} className="text-amber-500" /> : getFieldIcon(field)}
            </div>
            <input
                type={isPasswordField ? (showPassword ? 'text' : 'password') : (meta.type === 'number' ? 'number' : meta.type === 'date' ? 'date' : 'text')}
                value={inputValue}
                onChange={(e) => {
                    const val = e.target.value;
                    onChange(meta.type === 'number' ? (val === '' ? '' : Number(val)) : val);
                }}
                disabled={isPk && (meta.is_auto ?? false)}
                placeholder={isPasswordField ? 'Enter new password to change' : isPk && (meta.is_auto ?? false) ? '(Auto)' : meta.type === 'date' ? "YYYY-MM-DD" : `Enter ${formatLabel(field)}...`}
                className="w-full pl-10 pr-12 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-400 transition-all font-semibold text-sm placeholder:text-slate-400 placeholder:font-medium shadow-sm hover:border-slate-300"
            />
            {isPasswordField && (
                <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all z-20"
                    title={showPassword ? 'Hide password' : 'Show password'}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
            )}
        </div>
    );
};

export default function AdminDashboard() {
    const router = useRouter();
    const [tables, setTables] = useState<Table[]>([]);
    const [selectedTable, setSelectedTable] = useState<string>('');
    const [tableData, setTableData] = useState<TableData | null>(null);
    const [loading, setLoading] = useState(false);

    // Pagination & Sorting State
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [sortBy, setSortBy] = useState<string>('');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchColumn, setSearchColumn] = useState('all');
    const [isPaginated, setIsPaginated] = useState(true);
    const [userRole, setUserRole] = useState<string>('admin');
    const [userBranches, setUserBranches] = useState<string[]>([]);
    
    // Date Filtering for Tables
    const [tableDateRange, setTableDateRange] = useState('last_6_months');
    const [tableAllowedRanges, setTableAllowedRanges] = useState<string[]>(['last_6_months']);
    const [tableCustomStart, setTableCustomStart] = useState('');
    const [tableCustomEnd, setTableCustomEnd] = useState('');
    
    // Multiple Column Filters
    const [tableFilters, setTableFilters] = useState<Record<string, string>>({});


    // Horizontal scroll shadow indicators
    const tableScrollRef = useRef<HTMLDivElement>(null);
    const [scrollShadow, setScrollShadow] = useState({ left: false, right: false });

    const updateScrollShadow = useCallback(() => {
        const el = tableScrollRef.current;
        if (!el) return;
        const { scrollLeft, scrollWidth, clientWidth } = el;
        setScrollShadow({
            left: scrollLeft > 5,
            right: scrollLeft + clientWidth < scrollWidth - 5,
        });
    }, []);

    useEffect(() => {
        const el = tableScrollRef.current;
        if (!el) return;
        updateScrollShadow();
        el.addEventListener('scroll', updateScrollShadow, { passive: true });
        const ro = new ResizeObserver(updateScrollShadow);
        ro.observe(el);
        return () => {
            el.removeEventListener('scroll', updateScrollShadow);
            ro.disconnect();
        };
    }, [updateScrollShadow, tableData]);

    const READ_ONLY_TABLES = ['feedback_response', 'feedback_submissionlog'];

    const [editingRow, setEditingRow] = useState<any | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<any | null>(null);
    const [addModalOpen, setAddModalOpen] = useState(false);
    const [newRowData, setNewRowData] = useState<any>({});
    const [filterTables, setFilterTables] = useState('');
    const [activeTab, setActiveTab] = useState<'access' | 'tables' | 'reports'>('tables');

    // Live Access Grants Management State
    const [accessGrants, setAccessGrants] = useState<AccessGrantItem[]>([]);
    const [isLoadingGrants, setIsLoadingGrants] = useState(false);
    const [grantsSearchQuery, setGrantsSearchQuery] = useState('');
    const [selectedGrantForQr, setSelectedGrantForQr] = useState<AccessGrantItem | null>(null);

    // Advanced Link Gen & Policy Settings
    const [genSession, setGenSession] = useState('Jun-Dec 2026');
    const [genBranch, setGenBranch] = useState('');
    const [genYear, setGenYear] = useState('');
    const [genSem, setGenSem] = useState('');
    const [genSection, setGenSection] = useState('');
    const [genMaxResponses, setGenMaxResponses] = useState<string>('60');
    const [genDuration, setGenDuration] = useState<string>('15');
    const [advancedLinkUrl, setAdvancedLinkUrl] = useState('');
    const [isGeneratingLink, setIsGeneratingLink] = useState(false);
    const qrRef = useRef<SVGSVGElement>(null);
    const modalQrRef = useRef<SVGSVGElement>(null);

    const YEAR_SEMESTER_MAP: Record<string, number[]> = {
        '1': [1, 2],
        '2': [3, 4],
        '3': [5, 6],
        '4': [7, 8]
    };

    const handleGenYearChange = (val: string) => {
        setGenYear(val);
        const validSems = YEAR_SEMESTER_MAP[val] || [];
        if (!validSems.includes(parseInt(genSem))) {
            setGenSem('');
        }
    };

    const handleGenSemChange = (val: string) => {
        setGenSem(val);
        const sem = parseInt(val);
        if ([1, 2].includes(sem)) setGenYear('1');
        else if ([3, 4].includes(sem)) setGenYear('2');
        else if ([5, 6].includes(sem)) setGenYear('3');
        else if ([7, 8].includes(sem)) setGenYear('4');
    };

    const [toast, setToast] = useState<{ msg: string; type: ToastType; visible: boolean }>({
        msg: '', type: 'info', visible: false
    });

    // First Login Modal States
    const [showFirstLoginModal, setShowFirstLoginModal] = useState(false);
    const [firstLoginPassword, setFirstLoginPassword] = useState('');
    const [firstLoginConfirmPassword, setFirstLoginConfirmPassword] = useState('');
    const [firstLoginSubmitting, setFirstLoginSubmitting] = useState(false);
    const [showFirstLoginPassword, setShowFirstLoginPassword] = useState(false);

    // Current User identification
    const [currentUserId, setCurrentUserId] = useState<string>('');
    const [currentUsername, setCurrentUsername] = useState<string>('');

    const fetchAccessGrants = useCallback(async () => {
        setIsLoadingGrants(true);
        try {
            const res = await apiFetch('/dashboard-admin/access-grants/');
            const data = await res.json();
            if (data.status === 'ok') {
                setAccessGrants(data.grants || []);
            }
        } catch (error) {
            console.error("Failed to fetch access grants:", error);
        } finally {
            setIsLoadingGrants(false);
        }
    }, []);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const token = localStorage.getItem('access_token');
            const role = localStorage.getItem('user_role');
            const branches = localStorage.getItem('user_branches');
            const isFirstLogin = localStorage.getItem('is_first_login');
            const storedUserId = localStorage.getItem('user_id');
            const storedUsername = localStorage.getItem('admin_username') || localStorage.getItem('username');

            if (storedUserId) setCurrentUserId(storedUserId);
            if (storedUsername) setCurrentUsername(storedUsername);

            if (!token) {
                router.push('/');
            } else {
                setUserRole(role || 'admin');
                if (branches) {
                    try {
                        setUserBranches(JSON.parse(branches));
                    } catch { }
                }
                
                if (isFirstLogin === 'true') {
                    setShowFirstLoginModal(true);
                } else {
                    fetchDateRanges();
                    fetchTables();
                    fetchAccessGrants();
                }
            }
        }
    }, [router, fetchAccessGrants]);

    useEffect(() => {
        if (activeTab === 'access') {
            fetchAccessGrants();
            const interval = setInterval(() => {
                fetchAccessGrants();
            }, 10000);
            return () => clearInterval(interval);
        }
    }, [activeTab, fetchAccessGrants]);

    const fetchDateRanges = async () => {
        try {
            const res = await apiFetch('/dashboard-admin/date-ranges/');
            const data = await res.json();
            if (data.status === 'ok' && data.allowed_ranges) {
                setTableAllowedRanges(data.allowed_ranges);
            }
        } catch (error) {
            console.error("Failed to fetch date ranges:", error);
        }
    };

    const showToast = (msg: string, type: ToastType) => {
        setToast({ msg, type, visible: true });
    };

    const handleFirstLoginChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (firstLoginPassword !== firstLoginConfirmPassword) {
            showToast("Passwords do not match.", "error");
            return;
        }
        if (firstLoginPassword.length < 6) {
            showToast("Password must be at least 6 characters.", "error");
            return;
        }
        setFirstLoginSubmitting(true);
        try {
            const res = await apiFetch('/dashboard-admin/change-first-password/', {
                method: 'POST',
                body: JSON.stringify({
                    new_password: firstLoginPassword,
                    confirm_password: firstLoginConfirmPassword
                })
            });
            const data = await res.json();
            if (data.status === 'ok') {
                localStorage.setItem('is_first_login', 'false');
                setShowFirstLoginModal(false);
                showToast("Password changed successfully!", "success");
                fetchDateRanges();
                fetchTables();
                fetchAccessGrants();
            } else {
                showToast(data.error || "Failed to change password", "error");
            }
        } catch (error) {
            showToast("Network error. Try again.", "error");
        } finally {
            setFirstLoginSubmitting(false);
        }
    };

    const revokeGrant = async (grantId: number) => {
        if (!confirm("Are you sure you want to revoke this student access link? Submissions will stop immediately and the record will be removed.")) return;
        try {
            const res = await apiFetch(`/dashboard-admin/access-grants/${grantId}/delete/`, {
                method: 'POST'
            });
            const data = await res.json();
            if (data.status === 'ok') {
                showToast("Access revoked and grant record deleted successfully", "info");
                fetchAccessGrants();
            } else {
                showToast(data.error || "Failed to revoke grant", "error");
            }
        } catch {
            showToast("Network error revoking grant", "error");
        }
    };

    const toggleGrantActive = async (grantId: number) => {
        return revokeGrant(grantId);
    };

    const deleteGrant = async (grantId: number) => {
        if (!confirm("Are you sure you want to delete this access grant record?")) return;
        try {
            const res = await apiFetch(`/dashboard-admin/access-grants/${grantId}/delete/`, {
                method: 'POST'
            });
            const data = await res.json();
            if (data.status === 'ok') {
                showToast("Access grant deleted successfully", "info");
                fetchAccessGrants();
            } else {
                showToast(data.error || "Failed to delete grant", "error");
            }
        } catch {
            showToast("Network error deleting grant", "error");
        }
    };

    const copyAdvancedLink = async () => {
        if (isGeneratingLink) return;

        if (!genSession || !genBranch || !genYear || !genSem || !genSection) {
            showToast("Please select all class fields first", "error");
            return;
        }
        if (!/^[A-Z][a-z]{2}-[A-Z][a-z]{2} \d{4}$/.test(genSession)) {
            showToast("Invalid feedback session. End month must be after start month.", "error");
            return;
        }

        const maxResp = parseInt(genMaxResponses) || 60;
        const durMins = parseInt(genDuration) || 15;

        setIsGeneratingLink(true);
        try {
            const res = await apiFetch('/dashboard-admin/generate-access-grant/', {
                method: 'POST',
                body: JSON.stringify({
                    session: genSession,
                    branch: genBranch,
                    year: parseInt(genYear),
                    semester: parseInt(genSem),
                    section: parseInt(genSection),
                    max_responses: maxResp,
                    duration_minutes: durMins
                })
            });
            const data = await res.json();

            if (data.status === 'ok') {
                const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
                const link = `${baseUrl}/?access=${encodeURIComponent(data.access)}`;

                navigator.clipboard.writeText(link);
                setAdvancedLinkUrl(link);
                showToast("Secure feedback link generated & copied! QR code generated below.", "success");
                fetchAccessGrants();
            } else {
                showToast(data.error || "Failed to generate access link", "error");
            }
        } catch (error) {
            showToast("Server error generating access link", "error");
        } finally {
            setIsGeneratingLink(false);
        }
    };


    // Debounce search query & table filters
    useEffect(() => {
        const timer = setTimeout(() => {
            if (selectedTable) {
                fetchTableData(1); // Reset to page 1 on search
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery, tableFilters]);

    useEffect(() => {
        if (selectedTable) {
            // Reset filters when switching tables
            setSearchQuery('');
            setSearchColumn('all');
            setTableFilters({});
            fetchTableData(1);
        }
    }, [selectedTable]);
    
    useEffect(() => {
        if (selectedTable) {
            fetchTableData(currentPage);
        }
    }, [currentPage, pageSize, sortBy, sortOrder, isPaginated, tableDateRange, tableCustomStart, tableCustomEnd]);

    const fetchTables = async () => {
        try {
            const res = await apiFetch('/dashboard-admin/tables/');
            const data = await res.json();
            if (data.status === 'ok') {
                setTables(data.tables);
            } else {
                showToast('Failed to load tables', 'error');
            }
        } catch (error) {
            showToast('Error connecting to server', 'error');
        }
    };

    const fetchTableData = async (page: number) => {
        setLoading(true);
        try {
            let url = `${API_BASE_URL}/dashboard-admin/table/${selectedTable}/?`;

            if (isPaginated) {
                url += `page=${page}&page_size=${pageSize}`;
            } else {
                url += `nopaginate=true`;
            }

            if (sortBy) {
                url += `&sort_by=${sortBy}&order=${sortOrder}`;
            }

            const currentFilters: Record<string, string> = { ...tableFilters };
            if (searchQuery) {
                currentFilters[searchColumn || 'all'] = searchQuery;
            }
            
            if (Object.keys(currentFilters).length > 0) {
                url += `&filters=${encodeURIComponent(JSON.stringify(currentFilters))}`;
            }
            
            // Only add date filter for relevant tables
            if (selectedTable.toLowerCase() === 'feedback_response' || selectedTable.toLowerCase() === 'feedback_submissionlog') {
                url += `&range=${tableDateRange}`;
                if (tableDateRange === 'custom' && tableCustomStart && tableCustomEnd) {
                    url += `&start_date=${tableCustomStart}&end_date=${tableCustomEnd}`;
                }
            }

            const res = await apiFetch(url.replace(API_BASE_URL || '', ''));
            const data = await res.json();
            if (data.status === 'ok') {
                setTableData(data);
                setCurrentPage(data.page); // Update current page from server response
            } else {
                setTableData(null);
                
                // If the error strictly resembles a token validation failure (401/SimpleJWT error object), force a logout.
                if (data.code === 'token_not_valid' || (data.detail && String(data.detail).includes('token'))) {
                    showToast('Session expired. Please log in again.', 'error');
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('user_role');
                    router.push('/admin/login');
                    return;
                }
                
                showToast(data.error || 'Failed to load table data', 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('Error loading table data', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSort = (field: string) => {
        if (sortBy === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortOrder('asc');
        }
        setCurrentPage(1);
    };

    const handleEdit = (row: any) => {
        setEditingRow({ ...row });
    };

    const handleAddRow = async () => {
        if (!tableData) return;

        try {
            const res = await apiFetch(`/dashboard-admin/table/${selectedTable}/add/`, {
                method: 'POST',
                body: JSON.stringify(newRowData),
            });
            const data = await res.json();
            if (data.status === 'ok') {
                showToast('Record added successfully', 'success');
                setAddModalOpen(false);
                setNewRowData({});
                fetchTableData(currentPage);
            } else {
                showToast(data.error || 'Failed to add record', 'error');
            }
        } catch (error) {
            showToast('Error adding record', 'error');
        }
    };

    const isStaffUser = tableData?.model_name?.toLowerCase() === 'staffuser' || selectedTable.toLowerCase().includes('staffuser');

    const isSelfRow = (row: any) => {
        if (!isStaffUser || !row) return false;
        const matchesId = currentUserId && String(row.id) === String(currentUserId);
        const matchesUsername = currentUsername && String(row.username).toLowerCase() === String(currentUsername).toLowerCase();
        return Boolean(matchesId || matchesUsername);
    };

    const handleToggleActive = async (row: any) => {
        if (!tableData) return;
        if (isSelfRow(row)) {
            showToast('You cannot deactivate your own account.', 'error');
            return;
        }
        const pkValue = row[tableData.pk_field];
        const payload = { ...row, is_active: !row.is_active };
        try {
            const res = await apiFetch(`/dashboard-admin/table/${selectedTable}/${pkValue}/update/`, {
                method: 'POST',
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (data.status === 'ok') {
                showToast(`Status updated successfully`, 'success');
                fetchTableData(currentPage);
            } else {
                showToast(data.error || 'Failed to update status', 'error');
            }
        } catch (error) {
            showToast('Error updating status', 'error');
        }
    };

    const handleSaveEdit = async () => {
        if (!editingRow || !tableData) return;

        if (isSelfRow(editingRow) && (editingRow.is_active === false || editingRow.is_active === 'false' || editingRow.is_active === 0)) {
            showToast('You cannot deactivate your own account.', 'error');
            return;
        }

        try {
            const pkValue = editingRow[tableData.pk_field];
            const payload = { ...editingRow };
            if (typeof payload.password === 'string' && (payload.password === MASKED_PASSWORD_VALUE || payload.password.trim() === '')) {
                delete payload.password;
            }
            const res = await apiFetch(`/dashboard-admin/table/${selectedTable}/${pkValue}/update/`, {
                method: 'POST',
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (data.status === 'ok') {
                showToast('Row updated successfully', 'success');
                setEditingRow(null);
                fetchTableData(currentPage);
            } else {
                showToast(data.error || 'Failed to update row', 'error');
            }
        } catch (error) {
            showToast('Error updating row', 'error');
        }
    };

    const handleDelete = async (row: any) => {
        if (!tableData) return;

        if (isSelfRow(row)) {
            showToast('You cannot delete your own account.', 'error');
            return;
        }

        try {
            const pkValue = row[tableData.pk_field];
            const res = await apiFetch(`/dashboard-admin/table/${selectedTable}/${pkValue}/delete/`, {
                method: 'POST',
            });
            const data = await res.json();
            if (data.status === 'ok') {
                showToast('Row deleted successfully', 'success');
                setDeleteConfirm(null);
                fetchTableData(currentPage);
            } else {
                showToast(data.error || 'Failed to delete row', 'error');
            }
        } catch (error) {
            showToast('Error deleting row', 'error');
        }
    };

    const filteredTableList = tables.filter(t =>
        t.model_name.toLowerCase().includes(filterTables.toLowerCase()) ||
        t.table_name.toLowerCase().includes(filterTables.toLowerCase())
    );

    const staffUserVisible = ['id', 'username', 'role', 'department', 'branches', 'is_active'];
    const visibleFields = tableData ? tableData.fields.filter(field => 
        !isStaffUser || staffUserVisible.includes(field.toLowerCase())
    ) : [];

    return (
        <div className="min-h-screen text-slate-900 font-sans">
            <Toast
                message={toast.msg}
                type={toast.type}
                isVisible={toast.visible}
                onClose={() => setToast(prev => ({ ...prev, visible: false }))}
            />

            {/* First Login Password Change Modal */}
            {showFirstLoginModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-white/20 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-violet-500" />
                        
                        <div className="flex flex-col items-center mb-8">
                            <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mb-4">
                                <Lock size={32} className="text-indigo-600" />
                            </div>
                            <h2 className="text-2xl font-black text-slate-900 text-center">Action Required</h2>
                            <p className="text-sm text-slate-500 text-center mt-2">
                                For security reasons, you must change your default password before accessing the dashboard.
                            </p>
                        </div>
                        
                        <form onSubmit={handleFirstLoginChangePassword} className="space-y-5">
                            <div className="space-y-1.5">
                                <label className="text-sm font-bold text-slate-700">New Password</label>
                                <div className="relative">
                                    <input
                                        type={showFirstLoginPassword ? 'text' : 'password'}
                                        value={firstLoginPassword}
                                        onChange={(e) => setFirstLoginPassword(e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-medium pr-12"
                                        placeholder="••••••••"
                                        required
                                        minLength={6}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowFirstLoginPassword(!showFirstLoginPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                                    >
                                        {showFirstLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>
                            
                            <div className="space-y-1.5">
                                <label className="text-sm font-bold text-slate-700">Confirm Password</label>
                                <div className="relative">
                                    <input
                                        type={showFirstLoginPassword ? 'text' : 'password'}
                                        value={firstLoginConfirmPassword}
                                        onChange={(e) => setFirstLoginConfirmPassword(e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-medium pr-12"
                                        placeholder="••••••••"
                                        required
                                        minLength={6}
                                    />
                                </div>
                            </div>
                            
                            <button
                                type="submit"
                                disabled={firstLoginSubmitting}
                                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6"
                            >
                                {firstLoginSubmitting ? (
                                    <Loader2 size={20} className="animate-spin" />
                                ) : (
                                    <>
                                        <ShieldCheck size={20} />
                                        Update Password & Continue
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            )}


            {/* Top Navigation / Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 sm:mb-8">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                        Admin <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">Console</span>
                    </h1>
                    <p className="text-slate-500 mt-1 text-xs sm:text-sm">
                        {activeTab === 'access' ? 'Manage tokens and generate student links' : activeTab === 'tables' ? 'Manage system database and records' : 'Analyze faculty performance and ratings'}
                    </p>
                </div>
                <div className="flex bg-white p-1 sm:p-1.5 rounded-2xl border border-slate-200 shadow-sm w-full md:w-auto overflow-x-auto custom-scrollbar flex-nowrap">
                    <button
                        onClick={() => setActiveTab('access')}
                        className={cn(
                            "flex-1 md:flex-none flex items-center justify-center gap-2 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 whitespace-nowrap",
                            activeTab === 'access' ? "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-200/60" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                        )}
                    >
                        <Shield size={16} className="sm:w-[18px] sm:h-[18px]" />
                        Access Control
                    </button>
                    <button
                        onClick={() => setActiveTab('tables')}
                        className={cn(
                            "flex-1 md:flex-none flex items-center justify-center gap-2 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 whitespace-nowrap",
                            activeTab === 'tables' ? "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-200/60" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                        )}
                    >
                        <TableProperties size={16} className="sm:w-[18px] sm:h-[18px]" />
                        Tables
                    </button>
                    <button
                        onClick={() => setActiveTab('reports')}
                        className={cn(
                            "flex-1 md:flex-none flex items-center justify-center gap-2 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 whitespace-nowrap",
                            activeTab === 'reports' ? "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-200/60" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                        )}
                    >
                        <BarChart3 size={16} className="sm:w-[18px] sm:h-[18px]" />
                        Analytics
                    </button>
                </div>
            </div>

            {/* ── Access Control Tab ── */}
            {activeTab === 'access' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* ── Left Column: Live Access Grants & Links Manager (7 cols on lg) ── */}
                    <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                        <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-indigo-50/70 to-violet-50/50 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl shadow-sm">
                                    <Shield size={20} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="font-bold text-slate-800 text-base">Active Feedback Grants</h2>
                                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-black rounded-full border border-emerald-200">
                                            {accessGrants.filter(g => g.is_active && !g.is_expired && (!g.expires_at || new Date(g.expires_at).getTime() > Date.now())).length} Live
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500">Manage live access links, monitor submissions &amp; revoke access</p>
                                </div>
                            </div>
                            <button
                                onClick={fetchAccessGrants}
                                disabled={isLoadingGrants}
                                className="p-2.5 bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-50"
                                title="Refresh Grants"
                            >
                                <RefreshCw size={16} className={cn(isLoadingGrants && "animate-spin text-indigo-600")} />
                            </button>
                        </div>

                        {/* Search & Stats Bar */}
                        <div className="p-4 border-b border-slate-100 bg-slate-50/60 flex items-center gap-3">
                            <div className="relative flex-1">
                                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Filter by branch, section, or session..."
                                    value={grantsSearchQuery}
                                    onChange={(e) => setGrantsSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                />
                                {grantsSearchQuery && (
                                    <button
                                        onClick={() => setGrantsSearchQuery('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                                    >
                                        <X size={13} />
                                    </button>
                                )}
                            </div>
                            <span className="text-[11px] font-bold text-slate-400 whitespace-nowrap">
                                Total: <strong className="text-slate-700">{accessGrants.filter(g => g.is_active && !g.is_expired && (!g.expires_at || new Date(g.expires_at).getTime() > Date.now())).length}</strong>
                            </span>
                        </div>

                        {/* Grants List Content */}
                        <div className="p-4 space-y-3.5 overflow-y-auto max-h-[640px] custom-scrollbar flex-1">
                            {isLoadingGrants && accessGrants.length === 0 ? (
                                <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-3">
                                    <Loader2 size={28} className="animate-spin text-indigo-600" />
                                    <p className="text-xs font-medium">Loading feedback grants...</p>
                                </div>
                            ) : (() => {
                                const validActiveGrants = accessGrants.filter(g => {
                                    if (!g.is_active || g.is_expired) return false;
                                    if (g.expires_at) {
                                        const expTime = new Date(g.expires_at).getTime();
                                        if (!isNaN(expTime) && expTime <= Date.now()) return false;
                                    }
                                    return true;
                                });

                                const filtered = validActiveGrants.filter(g => {
                                    if (!grantsSearchQuery) return true;
                                    const q = grantsSearchQuery.toLowerCase();
                                    return (
                                        g.branch.toLowerCase().includes(q) ||
                                        g.session.toLowerCase().includes(q) ||
                                        `sec ${g.section}`.includes(q) ||
                                        `sem ${g.semester}`.includes(q) ||
                                        `year ${g.year}`.includes(q)
                                    );
                                });

                                if (filtered.length === 0) {
                                    return (
                                        <div className="py-16 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-slate-200 rounded-2xl">
                                            <div className="w-14 h-14 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center mb-3">
                                                <Link size={24} />
                                            </div>
                                            <h4 className="font-bold text-slate-800 text-sm mb-1">
                                                {grantsSearchQuery ? "No matching active feedback links found" : "No Active Feedback Links"}
                                            </h4>
                                            <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                                                {grantsSearchQuery ? "Try a different search term or clear the filter." : "Expired and revoked links are automatically removed. Use the Link & QR Builder on the right to create a new session."}
                                            </p>
                                        </div>
                                    );
                                }

                                return filtered.map(grant => {
                                    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
                                    const grantLink = `${baseUrl}/?access=${encodeURIComponent(grant.access)}`;
                                    const isLimitReached = grant.response_count >= grant.max_responses;
                                    const percent = Math.min(100, Math.round((grant.response_count / grant.max_responses) * 100));

                                    const statusPill = isLimitReached ? (
                                        <span className="px-2.5 py-0.5 bg-purple-50 text-purple-600 border border-purple-200/80 font-extrabold text-[10px] rounded-full uppercase tracking-wider">
                                            Limit Full
                                        </span>
                                    ) : (
                                        <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-200/80 font-extrabold text-[10px] rounded-full uppercase tracking-wider flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                            Live Active
                                        </span>
                                    );

                                    return (
                                        <div
                                            key={grant.id}
                                            className="p-4 rounded-2xl border border-slate-200 hover:border-indigo-200 transition-all duration-200 bg-white hover:shadow-md"
                                        >
                                            {/* Top Line: Badges & Status */}
                                            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="px-2.5 py-1 bg-indigo-50 border border-indigo-100/80 text-indigo-700 font-black rounded-lg text-xs tracking-tight">
                                                        {grant.branch} · Y{grant.year} · Sem {grant.semester} · Sec {grant.section}
                                                    </span>
                                                    <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                                        {grant.session}
                                                    </span>
                                                </div>
                                                {statusPill}
                                            </div>

                                            {/* Middle Line: Submissions Progress & Expiry Info */}
                                            <div className="space-y-1.5 mb-3 bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="font-bold text-slate-600 flex items-center gap-1.5">
                                                        <Users size={13} className="text-indigo-500" />
                                                        Submissions: <strong className="text-slate-900">{grant.response_count}</strong> / <span className="text-slate-500">{grant.max_responses}</span>
                                                    </span>
                                                    <span className="font-bold text-indigo-600 text-[11px]">{percent}%</span>
                                                </div>
                                                <div className="w-full bg-slate-200/80 rounded-full h-1.5 overflow-hidden">
                                                    <div
                                                        className={cn(
                                                            "h-full rounded-full transition-all duration-500",
                                                            isLimitReached ? "bg-purple-600" : percent > 80 ? "bg-amber-500" : "bg-gradient-to-r from-indigo-500 to-violet-500"
                                                        )}
                                                        style={{ width: `${percent}%` }}
                                                    />
                                                </div>
                                                <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium pt-0.5">
                                                    <span>Created by: {grant.created_by}</span>
                                                    {grant.expires_at && (
                                                        <span className="flex items-center gap-1">
                                                            <Clock size={10} />
                                                            {grant.is_expired ? "Expired at" : "Valid until"}: {new Date(grant.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Bottom Line: Actions */}
                                            <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(grantLink);
                                                        showToast("Student feedback link copied to clipboard!", "success");
                                                    }}
                                                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 font-bold text-xs rounded-xl transition-all"
                                                >
                                                    <Copy size={13} /> Copy Link
                                                </button>
                                                <button
                                                    onClick={() => setSelectedGrantForQr(grant)}
                                                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-violet-50 hover:text-violet-600 text-slate-700 font-bold text-xs rounded-xl transition-all"
                                                    title="View QR Code"
                                                >
                                                    <QrCode size={13} /> QR Code
                                                </button>
                                                <button
                                                    onClick={() => revokeGrant(grant.id)}
                                                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs rounded-xl transition-all"
                                                    title="Revoke access and remove grant immediately"
                                                >
                                                    <Power size={13} /> Revoke
                                                </button>
                                                <button
                                                    onClick={() => deleteGrant(grant.id)}
                                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                                    title="Delete grant record"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    </div>

                    {/* ── Right Column: Link & QR Code Builder (5 cols on lg) ── */}
                    <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                        <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-violet-50 to-indigo-50/50 flex items-center gap-3">
                            <div className="p-2.5 bg-violet-100 rounded-xl text-violet-600 shadow-sm">
                                <Link size={20} />
                            </div>
                            <div>
                                <h2 className="font-bold text-slate-800 text-base">Link &amp; QR Code Builder</h2>
                                <p className="text-xs text-slate-500">Create locked student access links with limits</p>
                            </div>
                        </div>

                        <div className="p-6 space-y-5 flex-1">
                            {/* Academic Session */}
                            <div className="space-y-1.5">
                                <span className="text-[11px] font-black text-slate-400 ml-1 uppercase">Feedback Conducting Session</span>
                                <AcademicSessionInput
                                    value={genSession}
                                    onChange={setGenSession}
                                />
                            </div>

                            {/* Branch & Year */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <span className="text-[11px] font-black text-slate-400 ml-1 uppercase">Branch</span>
                                    <Select value={genBranch} onValueChange={setGenBranch}>
                                        <SelectTrigger className="h-11 text-sm font-bold bg-slate-50 border-slate-200 text-slate-600 rounded-xl">
                                            <SelectValue placeholder="Branch" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-white border-slate-200 shadow-xl">
                                            {[
                                                'CSE', 'CSE(RL)', 'IT', 'CSE(DS)', 'CSE(CY)', 'CSIT', 'CSE(AIML)', 'ME', 'CE', 'EC', 'EC-ACT', 'EC-VLSI'
                                            ].filter(b => userRole === 'admin' || userBranches.includes(b)).map(b => (
                                                <SelectItem key={b} value={b}>{b}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <span className="text-[11px] font-black text-slate-400 ml-1 uppercase">Year</span>
                                    <Select value={genYear} onValueChange={handleGenYearChange}>
                                        <SelectTrigger className="h-11 text-sm font-bold bg-slate-50 border-slate-200 text-slate-600 rounded-xl">
                                            <SelectValue placeholder="Year" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-white border-slate-200 shadow-xl">
                                            <SelectItem value="1">1st Year</SelectItem>
                                            <SelectItem value="2">2nd Year</SelectItem>
                                            <SelectItem value="3">3rd Year</SelectItem>
                                            <SelectItem value="4">4th Year</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Semester & Section */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <span className="text-[11px] font-black text-slate-400 ml-1 uppercase">Semester</span>
                                    <Select value={genSem} onValueChange={handleGenSemChange}>
                                        <SelectTrigger className="h-11 text-sm font-bold bg-slate-50 border-slate-200 text-slate-600 rounded-xl">
                                            <SelectValue placeholder="Semester" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-white border-slate-200 shadow-xl">
                                            {(genYear ? YEAR_SEMESTER_MAP[genYear] : [1, 2, 3, 4, 5, 6, 7, 8]).map(s => (
                                                <SelectItem key={s} value={s.toString()}>{s}th Sem</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <span className="text-[11px] font-black text-slate-400 ml-1 uppercase">Section</span>
                                    <Select value={genSection} onValueChange={setGenSection}>
                                        <SelectTrigger className="h-11 text-sm font-bold bg-slate-50 border-slate-200 text-slate-600 rounded-xl">
                                            <SelectValue placeholder="Section" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-white border-slate-200 shadow-xl">
                                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(s => (
                                                <SelectItem key={s} value={s.toString()}>Sec {s}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Max Responses Limit UI */}
                            <div className="space-y-2.5 p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                        <Users size={14} className="text-indigo-600" />
                                        Max Feedback Responses
                                    </span>
                                    <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                                        {parseInt(genMaxResponses) > 0 ? `${genMaxResponses} Students` : 'Enter Limit'}
                                    </span>
                                </div>

                                {/* Custom Counter & Input Control */}
                                <div className="flex items-center rounded-xl bg-white border border-slate-200 shadow-sm p-1">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const cur = parseInt(genMaxResponses) || 60;
                                            const step = cur > 10 ? (cur % 5 !== 0 ? cur % 5 : 5) : 1;
                                            setGenMaxResponses(String(Math.max(1, cur - step)));
                                        }}
                                        className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 active:scale-95 transition-all"
                                        title="Decrease responses"
                                    >
                                        <Minus size={16} className="stroke-[2.5]" />
                                    </button>

                                    <div className="flex-1 flex items-center justify-center px-2">
                                        <input
                                            type="number"
                                            min="1"
                                            max="9999"
                                            value={genMaxResponses}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (val === '' || /^\d+$/.test(val)) {
                                                    setGenMaxResponses(val);
                                                }
                                            }}
                                            placeholder="e.g. 60"
                                            className="w-full text-center text-sm font-black text-slate-800 bg-transparent outline-none focus:ring-0 placeholder:text-slate-300"
                                        />
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            const cur = parseInt(genMaxResponses) || 0;
                                            const step = cur >= 10 && cur % 5 === 0 ? 5 : (cur < 10 ? 1 : 5 - (cur % 5));
                                            setGenMaxResponses(String(Math.min(9999, cur + step)));
                                        }}
                                        className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 active:scale-95 transition-all"
                                        title="Increase responses"
                                    >
                                        <Plus size={16} className="stroke-[2.5]" />
                                    </button>
                                </div>

                                {/* Quick Presets Shortcut Chips */}
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quick Presets:</span>
                                    </div>
                                    <div className="grid grid-cols-6 gap-1">
                                        {['30', '60', '75', '90', '120', '200'].map(preset => (
                                            <button
                                                key={preset}
                                                type="button"
                                                onClick={() => setGenMaxResponses(preset)}
                                                className={cn(
                                                    "py-1 text-[11px] font-bold rounded-lg border transition-all text-center",
                                                    genMaxResponses === preset
                                                        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                                                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100 hover:border-slate-300"
                                                )}
                                            >
                                                {preset}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <p className="text-[10px] text-slate-400 font-medium">Enter any custom number or use +/- counter. Submissions stop automatically when limit is reached.</p>
                            </div>

                            {/* Validity Duration UI */}
                            <div className="space-y-2.5 p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                        <Clock size={14} className="text-violet-600" />
                                        Link Expiration Time
                                    </span>
                                    <span className="text-xs font-black text-violet-600 bg-violet-50 px-2.5 py-0.5 rounded-full border border-violet-100">
                                        {formatDurationLabel(genDuration)}
                                    </span>
                                </div>

                                {/* Custom Duration Stepper & Input */}
                                <div className="flex items-center rounded-xl bg-white border border-slate-200 shadow-sm p-1">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const cur = parseInt(genDuration) || 15;
                                            const step = cur > 60 ? 15 : (cur > 15 ? 5 : 5);
                                            setGenDuration(String(Math.max(1, cur - step)));
                                        }}
                                        className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-50 hover:bg-violet-50 text-slate-600 hover:text-violet-600 active:scale-95 transition-all"
                                        title="Decrease time"
                                    >
                                        <Minus size={16} className="stroke-[2.5]" />
                                    </button>

                                    <div className="flex-1 flex items-center justify-center px-2">
                                        <input
                                            type="number"
                                            min="1"
                                            max="10080"
                                            value={genDuration}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (val === '' || /^\d+$/.test(val)) {
                                                    setGenDuration(val);
                                                }
                                            }}
                                            placeholder="Minutes (e.g. 15)"
                                            className="w-full text-center text-sm font-black text-slate-800 bg-transparent outline-none focus:ring-0 placeholder:text-slate-300"
                                        />
                                        <span className="text-xs font-bold text-slate-400 mr-2">mins</span>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            const cur = parseInt(genDuration) || 0;
                                            const step = cur >= 60 ? 15 : 5;
                                            setGenDuration(String(Math.min(10080, cur + step)));
                                        }}
                                        className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-50 hover:bg-violet-50 text-slate-600 hover:text-violet-600 active:scale-95 transition-all"
                                        title="Increase time"
                                    >
                                        <Plus size={16} className="stroke-[2.5]" />
                                    </button>
                                </div>

                                {/* Quick Presets Shortcut Chips */}
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quick Presets:</span>
                                    </div>
                                    <div className="grid grid-cols-4 gap-1">
                                        {[
                                            { val: '15', label: '15 Mins' },
                                            { val: '30', label: '30 Mins' },
                                            { val: '45', label: '45 Mins' },
                                            { val: '60', label: '1 Hour' },
                                            { val: '120', label: '2 Hours' },
                                            { val: '240', label: '4 Hours' },
                                            { val: '480', label: '8 Hours' },
                                            { val: '1440', label: '24 Hours' },
                                        ].map(item => (
                                            <button
                                                key={item.val}
                                                type="button"
                                                onClick={() => setGenDuration(item.val)}
                                                className={cn(
                                                    "py-1 text-[11px] font-bold rounded-lg border transition-all text-center",
                                                    genDuration === item.val
                                                        ? "bg-violet-600 text-white border-violet-600 shadow-sm"
                                                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100 hover:border-slate-300"
                                                )}
                                            >
                                                {item.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <p className="text-[10px] text-slate-400 font-medium">Link automatically expires and is removed from active grants once time is reached.</p>
                            </div>

                            {/* Generate Button */}
                            <button
                                onClick={copyAdvancedLink}
                                disabled={isGeneratingLink}
                                className="w-full flex items-center justify-center gap-2.5 px-4 py-3.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-bold uppercase tracking-wider rounded-xl hover:from-violet-700 hover:to-indigo-700 shadow-lg shadow-violet-200/50 active:scale-[0.98] transition-all group disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                            >
                                {isGeneratingLink ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" />
                                        Generating Secure Link...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles size={18} className="group-hover:scale-110 transition-transform" />
                                        Generate Link &amp; QR Code
                                    </>
                                )}
                            </button>

                            {/* ── Generated QR Code Preview ── */}
                            {advancedLinkUrl && (
                                <div className="mt-4 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50 p-5 flex flex-col items-center gap-4 animate-in fade-in duration-300">
                                    <p className="text-[11px] font-black text-violet-600 uppercase tracking-wider">Latest Generated Student Link</p>

                                    <div className="p-3 bg-white rounded-2xl shadow-md border border-violet-100">
                                        <QRCodeSVG
                                            ref={qrRef}
                                            value={advancedLinkUrl}
                                            size={160}
                                            bgColor="#ffffff"
                                            fgColor="#4f46e5"
                                            level="M"
                                            includeMargin={false}
                                        />
                                    </div>

                                    <div className="text-center space-y-0.5">
                                        <p className="text-xs font-extrabold text-slate-800">{genSession}</p>
                                        <p className="text-[11px] text-slate-500 font-medium">
                                            {genBranch} · Year {genYear} · Sem {genSem} · Sec {genSection} · Max {genMaxResponses} Submissions
                                        </p>
                                    </div>

                                    <div className="flex gap-2 w-full">
                                        <button
                                            onClick={() => { navigator.clipboard.writeText(advancedLinkUrl); showToast('Feedback link copied!', 'success'); }}
                                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-violet-200 text-violet-700 text-xs font-bold rounded-xl hover:bg-violet-50 transition-all shadow-sm"
                                        >
                                            <Copy size={13} /> Copy Link
                                        </button>
                                        <button
                                            onClick={() => {
                                                const svg = qrRef.current;
                                                if (!svg) return;
                                                const serializer = new XMLSerializer();
                                                const svgStr = serializer.serializeToString(svg);
                                                const blob = new Blob([svgStr], { type: 'image/svg+xml' });
                                                const url = URL.createObjectURL(blob);
                                                const a = document.createElement('a');
                                                a.href = url;
                                                a.download = `QR_${genSession.replace(/ /g,'_')}_${genBranch}_Y${genYear}S${genSem}Sec${genSection}.svg`;
                                                a.click();
                                                URL.revokeObjectURL(url);
                                            }}
                                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-violet-600 text-white text-xs font-bold rounded-xl hover:bg-violet-700 transition-all shadow-sm"
                                        >
                                            <Download size={13} /> Download QR
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Grant QR Code Viewer Modal ── */}
                    {selectedGrantForQr && (
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 flex flex-col items-center gap-4 relative"
                            >
                                <button
                                    onClick={() => setSelectedGrantForQr(null)}
                                    className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
                                >
                                    <X size={18} />
                                </button>
                                <div className="text-center pt-2">
                                    <h3 className="font-black text-slate-900 text-lg">Student Access QR Code</h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {selectedGrantForQr.branch} · Year {selectedGrantForQr.year} · Sem {selectedGrantForQr.semester} · Sec {selectedGrantForQr.section}
                                    </p>
                                </div>

                                <div className="p-4 bg-white rounded-2xl shadow-md border border-slate-100">
                                    <QRCodeSVG
                                        ref={modalQrRef}
                                        value={typeof window !== 'undefined' ? `${window.location.origin}/?access=${encodeURIComponent(selectedGrantForQr.access)}` : ''}
                                        size={200}
                                        bgColor="#ffffff"
                                        fgColor="#4f46e5"
                                        level="M"
                                        includeMargin={false}
                                    />
                                </div>

                                <div className="text-center bg-slate-50 p-2.5 rounded-xl w-full text-xs font-medium text-slate-600">
                                    <p>{selectedGrantForQr.session}</p>
                                    <p className="text-[11px] text-slate-400">Submissions: {selectedGrantForQr.response_count} / {selectedGrantForQr.max_responses}</p>
                                </div>

                                <div className="flex gap-2 w-full">
                                    <button
                                        onClick={() => {
                                            const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
                                            navigator.clipboard.writeText(`${baseUrl}/?access=${encodeURIComponent(selectedGrantForQr.access)}`);
                                            showToast("Feedback link copied!", "success");
                                        }}
                                        className="flex-1 py-2.5 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5"
                                    >
                                        <Copy size={14} /> Copy Link
                                    </button>
                                    <button
                                        onClick={() => {
                                            const svg = modalQrRef.current;
                                            if (!svg) return;
                                            const serializer = new XMLSerializer();
                                            const svgStr = serializer.serializeToString(svg);
                                            const blob = new Blob([svgStr], { type: 'image/svg+xml' });
                                            const url = URL.createObjectURL(blob);
                                            const a = document.createElement('a');
                                            a.href = url;
                                            a.download = `QR_${selectedGrantForQr.branch}_Y${selectedGrantForQr.year}S${selectedGrantForQr.semester}Sec${selectedGrantForQr.section}.svg`;
                                            a.click();
                                            URL.revokeObjectURL(url);
                                        }}
                                        className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-indigo-200"
                                    >
                                        <Download size={14} /> Download
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Analytics Tab ── */}
            {activeTab === 'reports' && (
                <PerformanceReport />
            )}

            {/* ── Tables Tab ── */}
            {activeTab === 'tables' && (
                <div className="space-y-6 lg:space-y-0">
                    {/* Mobile Table Selector (visible only on mobile lg:hidden) */}
                    <div className="block lg:hidden bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2.5">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                <Database size={14} className="text-indigo-600" />
                                Database Table
                            </label>
                            <span className="text-[11px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-full">
                                {tables.length} tables
                            </span>
                        </div>
                        <Select
                            value={selectedTable}
                            onValueChange={(tbl) => {
                                setSelectedTable(tbl);
                                setCurrentPage(1);
                                setSortBy('');
                                setSearchQuery('');
                            }}
                        >
                            <SelectTrigger className="w-full h-11 bg-slate-50 border-slate-200 text-slate-900 font-bold text-sm rounded-xl">
                                <SelectValue placeholder="Select a table to manage..." />
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px] bg-white border-slate-200 shadow-xl">
                                {tables.map((table) => (
                                    <SelectItem key={table.table_name} value={table.table_name} className="font-semibold text-slate-700 py-2.5">
                                        <div className="flex items-center justify-between w-full gap-4">
                                            <span>{table.model_name}</span>
                                            <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-full ml-auto">
                                                {table.row_count} rows
                                            </span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* Sidebar: Table Selection (hidden on mobile, sticky on lg) */}
                        <div className="hidden lg:block lg:col-span-3 space-y-6 sticky top-24 h-fit">
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-300">
                                <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-slate-100/50 flex items-center gap-2.5">
                                    <div className="p-1.5 bg-slate-200/70 rounded-lg">
                                        <Database size={14} className="text-slate-600" />
                                    </div>
                                    <h2 className="font-bold text-slate-800 text-sm">Database Tables</h2>
                                </div>
                                <div className="p-3">
                                    <div className="relative mb-4 group px-0.5">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                        <input
                                            type="text"
                                            placeholder="Filter tables..."
                                            value={filterTables}
                                            onChange={(e) => setFilterTables(e.target.value)}
                                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-medium placeholder:text-slate-400 shadow-inner h-10"
                                        />
                                    </div>
                                    <div className="space-y-1 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
                                        {filteredTableList.map((table) => (
                                            <button
                                                key={table.table_name}
                                                onClick={() => {
                                                    setSelectedTable(table.table_name);
                                                    setCurrentPage(1);
                                                    setSortBy('');
                                                    setSearchQuery('');
                                                }}
                                                className={cn(
                                                    "w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex justify-between items-center group",
                                                    selectedTable === table.table_name
                                                        ? "bg-indigo-50 text-indigo-700 border-l-[3px] border-l-indigo-500 shadow-sm"
                                                        : "text-slate-600 hover:bg-slate-50 border-l-[3px] border-l-transparent"
                                                )}
                                            >
                                                <span className="truncate">{table.model_name}</span>
                                                <span className={cn(
                                                    "text-[10px] px-2 py-0.5 rounded-full font-bold min-w-[28px] text-center",
                                                    selectedTable === table.table_name ? "bg-indigo-200 text-indigo-800" : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
                                                )}>
                                                    {table.row_count}
                                                </span>
                                            </button>
                                        ))}
                                        {filteredTableList.length === 0 && (
                                            <div className="text-center py-4 text-slate-400 text-sm">No tables found</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Main Content: Table View */}
                        <div className="lg:col-span-9">
                        {selectedTable ? (
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-[600px] overflow-hidden">
                                {/* Toolbar */}
                                <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row justify-between gap-4 bg-gradient-to-r from-slate-50 to-white">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-gradient-to-br from-indigo-100 to-indigo-50 p-2.5 rounded-xl text-indigo-600 shadow-sm">
                                            <Database size={20} />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-black text-slate-900">{tableData?.model_name || 'Loading...'}</h2>
                                            <div className="flex items-center gap-2 text-sm text-slate-500">
                                                <span className="font-medium">{tableData?.total || 0} records</span>
                                                {loading && <Loader2 className="h-3 w-3 animate-spin ml-2 text-indigo-500" />}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3">
                                        {!READ_ONLY_TABLES.some(t => t.toLowerCase() === selectedTable.toLowerCase()) && (
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => {
                                                        setEditingRow(null);
                                                        setNewRowData({});
                                                        setAddModalOpen(true);
                                                    }}
                                                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-95"
                                                >
                                                    <Plus size={18} />
                                                    Add Record
                                                </button>
                                            </div>
                                        )}
                                        
                                        {(selectedTable.toLowerCase() === 'feedback_response' || selectedTable.toLowerCase() === 'feedback_submissionlog') && (
                                            <div className="flex items-center gap-2">
                                                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider hidden xl:block">
                                                    Period:
                                                </div>
                                                <DateRangeSelector 
                                                    value={tableDateRange}
                                                    variant="compact"
                                                    onChange={(rangeKey, start, end) => {
                                                        setTableDateRange(rangeKey);
                                                        if (start) setTableCustomStart(start);
                                                        if (end) setTableCustomEnd(end);
                                                    }}
                                                    allowedRanges={tableAllowedRanges}
                                                />
                                            </div>
                                        )}
                                        <div className="h-8 w-[1px] bg-slate-300 mx-1 hidden md:block"></div>

                                        <div className="flex bg-white border border-slate-300 rounded-lg p-1 shadow-sm">
                                            <button
                                                onClick={() => setIsPaginated(true)}
                                                className={cn(
                                                    "px-3 py-1.5 rounded text-xs font-semibold transition-all",
                                                    isPaginated ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-900"
                                                )}
                                            >
                                                Paged
                                            </button>
                                            <button
                                                onClick={() => setIsPaginated(false)}
                                                className={cn(
                                                    "px-3 py-1.5 rounded text-xs font-semibold transition-all",
                                                    !isPaginated ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-900"
                                                )}
                                            >
                                                All
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Table Data */}
                                <div className="flex-1 w-full relative">
                                    {/* Left fade — hidden columns behind */}
                                    {scrollShadow.left && (
                                        <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-blue-50 via-blue-50/70 to-transparent z-20 pointer-events-none" />
                                    )}
                                    {/* Right fade + scroll hint */}
                                    {scrollShadow.right && (
                                        <div className="absolute right-0 top-0 bottom-0 w-24 z-20 pointer-events-none flex items-center justify-end">
                                            <div className="absolute inset-0 bg-gradient-to-l from-blue-50 via-blue-50/80 to-transparent" />
                                            <span className="relative mr-3 flex items-center gap-1 text-[10px] font-black text-indigo-500 uppercase tracking-widest bg-blue-100/90 border border-blue-200 pl-2.5 pr-1.5 py-1 rounded-lg shadow-[0_4px_12px_-4px_rgba(59,130,246,0.3)]">
                                                scroll <ChevronRight size={14} className="animate-pulse" />
                                            </span>
                                        </div>
                                    )}
                                    <div ref={tableScrollRef} className="overflow-x-auto overflow-y-auto w-full h-full relative">
                                        {loading && (
                                            <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center">
                                                <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
                                            </div>
                                        )}

                                        {tableData ? (
                                            <table className="w-full min-w-max text-left">
                                                <thead>
                                                    <tr className="bg-gradient-to-r from-slate-100 to-slate-50 border-b-2 border-slate-200 sticky top-0 z-10">
                                                        <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 w-12 text-center">#</th>
                                                        {visibleFields.map((field) => (
                                                            <th
                                                                key={field}
                                                                onClick={() => handleSort(field)}
                                                                className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 cursor-pointer hover:text-indigo-600 hover:bg-indigo-50/50 transition-all select-none group whitespace-nowrap"
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    {field.replace(/_/g, ' ')}
                                                                    <span className={cn(
                                                                        "transition-all",
                                                                        sortBy === field ? "opacity-100" : "opacity-0 group-hover:opacity-60"
                                                                    )}>
                                                                        {sortBy === field ? (
                                                                            sortOrder === 'asc' ? <ArrowUp size={11} className="text-indigo-500" /> : <ArrowDown size={11} className="text-indigo-500" />
                                                                        ) : (
                                                                            <ArrowUpDown size={11} className="text-slate-400" />
                                                                        )}
                                                                    </span>
                                                                </div>
                                                            </th>
                                                        ))}
                                                        {!READ_ONLY_TABLES.some(t => t.toLowerCase() === selectedTable.toLowerCase()) && (
                                                            <th className="px-5 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-500 sticky right-0 bg-gradient-to-l from-slate-100 to-slate-50 shadow-[-12px_0_20px_-8px_rgba(0,0,0,0.06)] z-20">
                                                                Actions
                                                            </th>
                                                        )}
                                                    </tr>
                                                    
                                                    {/* Filter Row inside Header */}
                                                    <tr className="bg-slate-50 border-b-2 border-slate-200 sticky top-12 z-10 shadow-sm">
                                                        <td className="px-3 py-2 text-center bg-slate-50">
                                                            <button
                                                                onClick={() => setTableFilters({})}
                                                                title="Clear all filters"
                                                                className="p-1.5 hover:bg-slate-200 rounded-md text-slate-400 hover:text-slate-700 transition-colors"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        </td>
                                                        {visibleFields.map((field) => {
                                                            const isStaffUser = tableData?.model_name?.toLowerCase() === 'staffuser' || selectedTable.toLowerCase().includes('staffuser');
                                                            const staffUserAllowed = ['id', 'username', 'role', 'department'];
                                                            
                                                            if (isStaffUser && !staffUserAllowed.includes(field.toLowerCase())) {
                                                                return <td key={field} className="px-2 py-2 bg-slate-50"></td>;
                                                            }
                                                            
                                                            return (
                                                                <td key={field} className="px-2 py-2 bg-slate-50">
                                                                    <div className="relative">
                                                                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                                                                        <input
                                                                            type="text"
                                                                            value={tableFilters[field] || ''}
                                                                            onChange={(e) => setTableFilters(prev => ({ ...prev, [field]: e.target.value }))}
                                                                            placeholder="Filter..."
                                                                            className="w-full pl-6 pr-2 py-1 bg-white border border-slate-200 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all shadow-sm min-w-[80px]"
                                                                        />
                                                                    </div>
                                                                </td>
                                                            );
                                                        })}
                                                        {!READ_ONLY_TABLES.some(t => t.toLowerCase() === selectedTable.toLowerCase()) && (
                                                            <td className="px-2 py-2 bg-slate-50 sticky right-0 z-20"></td>
                                                        )}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {tableData.data.length > 0 ? (
                                                        tableData.data.map((row, idx) => (
                                                        <tr key={idx} className="hover:bg-blue-50/40 transition-colors duration-100 group">
                                                            <td className="px-5 py-3.5 text-center">
                                                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-slate-100 text-[10px] font-black text-slate-400">
                                                                    {(isPaginated ? (currentPage - 1) * pageSize : 0) + idx + 1}
                                                                </span>
                                                            </td>
                                                            {visibleFields.map((field) => {
                                                                const meta = tableData.field_meta?.[field];
                                                                const value = row[field];
                                                                const isRatingField = field.toLowerCase().includes('rating') || field.toLowerCase().includes('q1') || field.toLowerCase().includes('q2') || field.toLowerCase().includes('q3') || field.toLowerCase().includes('q4') || field.toLowerCase().includes('q5') || field.toLowerCase().includes('q6') || field.toLowerCase().includes('q7') || field.toLowerCase().includes('q8') || field.toLowerCase().includes('q9') || field.toLowerCase().includes('q10');
                                                                const numVal = Number(value);

                                                                let content;
                                                                if (isStaffUser && field.toLowerCase() === 'is_active') {
                                                                    const isSelf = isSelfRow(row);
                                                                    const canToggle = userRole === 'admin' && !isSelf;
                                                                    content = (
                                                                        <div className="flex items-center gap-2">
                                                                            <button 
                                                                                onClick={(e) => { 
                                                                                    e.stopPropagation(); 
                                                                                    if (isSelf) {
                                                                                        showToast('You cannot deactivate your own account.', 'error');
                                                                                        return;
                                                                                    }
                                                                                    if (canToggle) handleToggleActive(row); 
                                                                                }}
                                                                                disabled={!canToggle}
                                                                                title={isSelf ? "You cannot deactivate your own account" : undefined}
                                                                                className={cn(
                                                                                    "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none",
                                                                                    value ? "bg-emerald-500" : "bg-slate-300",
                                                                                    canToggle ? "cursor-pointer hover:opacity-90" : "cursor-not-allowed opacity-60"
                                                                                )}
                                                                            >
                                                                                <span className={cn(
                                                                                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm",
                                                                                    value ? "translate-x-4" : "translate-x-0.5"
                                                                                )} />
                                                                            </button>
                                                                            {isSelf && (
                                                                                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200/60 px-1.5 py-0.5 rounded shadow-xs">
                                                                                    You
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                } else if (meta?.type === 'boolean') {
                                                                    content = value ? (
                                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                                            Yes
                                                                        </span>
                                                                    ) : (
                                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                                                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                                                            No
                                                                        </span>
                                                                    );
                                                                } else if (isRatingField && !isNaN(numVal) && numVal >= 1 && numVal <= 5) {
                                                                    const colors = ['', 'bg-red-100 text-red-700', 'bg-orange-100 text-orange-700', 'bg-yellow-100 text-yellow-700', 'bg-lime-100 text-lime-700', 'bg-emerald-100 text-emerald-700'];
                                                                    content = (
                                                                        <span className={cn("inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-black", colors[numVal] || 'bg-slate-100 text-slate-600')}>
                                                                            {numVal}
                                                                        </span>
                                                                    );
                                                                } else if (field.toLowerCase() === 'password') {
                                                                    content = <span className="text-slate-400 font-mono text-xs select-none">********</span>;
                                                                } else if (field.toLowerCase() === 'branches') {
                                                                    const branchArr = Array.isArray(value) ? value : [];
                                                                    content = (
                                                                        <div className="flex flex-wrap gap-1">
                                                                            {branchArr.map((b: string) => (
                                                                                <span key={b} className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 text-[10px] font-bold border border-blue-100 uppercase">{b}</span>
                                                                            ))}
                                                                            {branchArr.length === 0 && <span className="text-slate-400 text-xs">—</span>}
                                                                        </div>
                                                                    );
                                                                } else if (field === tableData.pk_field || field.toLowerCase().includes('code')) {
                                                                    content = <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">{String(value ?? '—')}</span>;
                                                                } else if (field.toLowerCase().includes('id') && !isNaN(numVal)) {
                                                                    content = <span className="font-mono text-xs font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{String(value ?? '—')}</span>;
                                                                } else {
                                                                    content = <span className="text-slate-700 text-sm font-medium">{String(value ?? '—')}</span>;
                                                                }

                                                                return (
                                                                    <td key={field} className="px-5 py-3.5 align-middle max-w-[220px] truncate">
                                                                        {content}
                                                                    </td>
                                                                );
                                                            })}
                                                            <td className="px-4 py-3 text-right sticky right-0 bg-white group-hover:bg-blue-50/40 shadow-[-12px_0_20px_-10px_rgba(0,0,0,0.05)] align-middle z-10 transition-colors duration-100">
                                                                {!READ_ONLY_TABLES.some(t => t.toLowerCase() === selectedTable.toLowerCase()) && (
                                                                    <div className="flex items-center justify-end gap-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                                                        <button
                                                                            onClick={() => {
                                                                                setEditingRow(row);
                                                                                setNewRowData({ ...row });
                                                                            }}
                                                                            className="p-1.5 sm:p-2 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 bg-slate-100 md:bg-transparent transition-all"
                                                                            title="Edit"
                                                                        >
                                                                            <Edit size={16} />
                                                                        </button>
                                                                        {!isSelfRow(row) && (
                                                                            <button
                                                                                onClick={() => setDeleteConfirm(row)}
                                                                                className="p-1.5 sm:p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 bg-slate-100 md:bg-transparent transition-all"
                                                                                title="Delete"
                                                                            >
                                                                                <Trash2 size={16} />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </td>
                                                        </tr>
                                                        ))
                                                    ) : !loading && (
                                                        <tr>
                                                            <td colSpan={visibleFields.length + (!READ_ONLY_TABLES.some(t => t.toLowerCase() === selectedTable.toLowerCase()) ? 2 : 1)} className="px-5 py-10">
                                                                <div className="flex flex-col items-center justify-center h-64">
                                                                    <div className="h-16 w-16 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mb-4">
                                                                        <Database size={28} className="text-slate-300" />
                                                                    </div>
                                                                    <p className="font-bold text-slate-400">No records found</p>
                                                                    <p className="text-xs text-slate-300 mt-1">Try adjusting your search or filters</p>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        ) : null}
                                    </div>
                                </div>

                                {/* Footer: Pagination */}
                                {isPaginated && tableData && tableData.data.length > 0 && (
                                    <div className="p-4 border-t border-slate-200 bg-gradient-to-r from-slate-50 to-white flex flex-col sm:flex-row justify-between items-center gap-4">
                                        <div className="flex items-center gap-4">
                                            <span className="text-sm text-slate-500 font-medium">Rows per page:</span>
                                            <select
                                                value={pageSize}
                                                onChange={(e) => {
                                                    setPageSize(Number(e.target.value));
                                                    setCurrentPage(1);
                                                }}
                                                className="bg-white border border-slate-300 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2 font-medium"
                                            >
                                                {[10, 25, 50, 100].map(size => (
                                                    <option key={size} value={size}>{size}</option>
                                                ))}
                                            </select>
                                            <span className="text-sm text-slate-500 border-l border-slate-300 pl-4 font-medium">
                                                Page <strong className="text-slate-700">{tableData.page}</strong> of <strong className="text-slate-700">{tableData.total_pages}</strong>
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                disabled={currentPage === 1}
                                                className="inline-flex items-center justify-center p-2 rounded-lg text-slate-500 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                                            >
                                                <ChevronLeft size={18} />
                                            </button>
                                            {(() => {
                                                const total = tableData.total_pages;
                                                const current = tableData.page;
                                                const pages: (number | string)[] = [];
                                                if (total <= 7) {
                                                    for (let i = 1; i <= total; i++) pages.push(i);
                                                } else {
                                                    pages.push(1);
                                                    if (current > 3) pages.push('...');
                                                    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
                                                    if (current < total - 2) pages.push('...');
                                                    pages.push(total);
                                                }
                                                return pages.map((p, i) => (
                                                    typeof p === 'string' ? (
                                                        <span key={`ellipsis-${i}`} className="px-1 text-slate-400 text-sm">…</span>
                                                    ) : (
                                                        <button
                                                            key={p}
                                                            onClick={() => setCurrentPage(p)}
                                                            className={cn(
                                                                "inline-flex items-center justify-center w-9 h-9 rounded-lg text-sm font-bold transition-all",
                                                                current === p
                                                                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-200/60"
                                                                    : "text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:border-indigo-200"
                                                            )}
                                                        >
                                                            {p}
                                                        </button>
                                                    )
                                                ));
                                            })()}
                                            <button
                                                onClick={() => setCurrentPage(p => Math.min(tableData.total_pages, p + 1))}
                                                disabled={currentPage === tableData.total_pages}
                                                className="inline-flex items-center justify-center p-2 rounded-lg text-slate-500 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                                            >
                                                <ChevronRight size={18} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="bg-white rounded-2xl border-2 border-slate-200 border-dashed p-16 flex flex-col items-center justify-center text-center h-full min-h-[400px]">
                                <div className="h-24 w-24 bg-gradient-to-br from-slate-50 to-indigo-50 rounded-2xl flex items-center justify-center mb-6 shadow-sm animate-pulse">
                                    <Database size={40} className="text-indigo-300" />
                                </div>
                                <h3 className="text-xl font-black text-slate-900 mb-2">Select a Table</h3>
                                <p className="text-slate-500 max-w-sm text-sm">
                                    Choose a database table from the sidebar to view, search, and manage records.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
                </div>
            )}

            {/* Modals */}
            {editingRow && tableData && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden"
                    >
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                                    Edit Record 
                                    <span className="text-[10px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded uppercase tracking-tighter">v3.0.4</span>
                                </h3>
                                <p className="text-sm text-slate-500 font-medium">
                                    {tableData.model_name} • {formatLabel(tableData.pk_field)}: <span className="text-indigo-600 font-bold">{editingRow[tableData.pk_field]}</span>
                                </p>
                            </div>
                            <button onClick={() => setEditingRow(null)} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {tableData.fields
                                    .filter(field => !tableData.field_meta?.[field]?.is_auto)
                                    .map((field) => {
                                        const isFieldDisabled = isSelfRow(editingRow) && field.toLowerCase() === 'is_active';
                                        return (
                                            <div key={field} className={cn("space-y-1.5", (tableData.field_meta?.[field]?.type === 'multi-select' || field === 'branches') ? "md:col-span-2" : "")}>
                                                <div className="flex items-center justify-between">
                                                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider pl-1">{formatLabel(field)}</label>
                                                    {isFieldDisabled && (
                                                        <span className="text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200/60 px-1.5 py-0.5 rounded">
                                                            Cannot deactivate own account
                                                        </span>
                                                    )}
                                                </div>
                                                <RenderInputInner
                                                    field={field}
                                                    value={editingRow[field]}
                                                    onChange={(val) => setEditingRow({ ...editingRow, [field]: val })}
                                                    isPk={field === tableData.pk_field}
                                                    tableData={tableData}
                                                    allData={editingRow}
                                                    disabled={isFieldDisabled}
                                                />
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                        <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end gap-3">
                            <button
                                onClick={() => setEditingRow(null)}
                                className="px-5 py-2.5 rounded-lg text-slate-600 font-medium hover:bg-slate-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-bold hover:from-indigo-700 hover:to-indigo-800 shadow-lg shadow-indigo-200/50 transition-all flex items-center gap-2 active:scale-[0.98]"
                            >
                                <Save size={18} />
                                Save Changes
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Add Record Modal */}
            {addModalOpen && tableData && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden"
                    >
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                                    Add New Record
                                    <span className="text-[10px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded uppercase tracking-tighter">v3.0.4</span>
                                </h3>
                                <p className="text-sm text-slate-500 font-medium">Insert row into {tableData.model_name}</p>
                            </div>
                            <button onClick={() => setAddModalOpen(false)} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {tableData.fields
                                    .filter(field => !tableData.field_meta?.[field]?.is_auto)
                                    .map((field) => (
                                        <div key={field} className={cn("space-y-1.5", (tableData.field_meta?.[field]?.type === 'multi-select' || field === 'branches') ? "md:col-span-2" : "")}>
                                            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider pl-1">{formatLabel(field)}</label>
                                            <RenderInputInner
                                                field={field}
                                                value={newRowData[field]}
                                                onChange={(val) => setNewRowData({ ...newRowData, [field]: val })}
                                                isPk={field === tableData.pk_field}
                                                tableData={tableData}
                                                allData={newRowData}
                                            />
                                        </div>
                                    ))}
                            </div>
                        </div>
                        <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end gap-3">
                            <button
                                onClick={() => setAddModalOpen(false)}
                                className="px-5 py-2.5 rounded-lg text-slate-600 font-medium hover:bg-slate-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddRow}
                                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-bold hover:from-indigo-700 hover:to-indigo-800 shadow-lg shadow-indigo-200/50 transition-all flex items-center gap-2 active:scale-[0.98]"
                            >
                                <Save size={18} />
                                Save Record
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

            {deleteConfirm && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center"
                    >
                        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertCircle className="text-red-600 h-8 w-8" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Record?</h3>
                        <p className="text-slate-500 mb-6 text-sm">
                            This action cannot be undone. This will permanently delete the selected record from the database.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteConfirm(null)}
                                className="flex-1 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDelete(deleteConfirm)}
                                className="flex-1 py-2.5 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 shadow-lg shadow-red-100 transition-all"
                            >
                                Delete
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}


            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.2);
                }
            `}</style>
        </div>
    );
}

// Helper Style
const customScrollbarStyle = `
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }
`;
