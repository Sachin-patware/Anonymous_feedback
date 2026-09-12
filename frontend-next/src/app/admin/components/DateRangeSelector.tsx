import React, { useState } from 'react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select';
import { Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

const RANGE_LABELS: Record<string, string> = {
    'last_6_months': 'Last 6 Months',
    'last_1_year': 'Last 1 Year',
    'last_2_years': 'Last 2 Years',
    'last_3_years': 'Last 3 Years',
    'last_5_years': 'Last 5 Years',
    'all_time': 'All Time',
    'custom': 'Custom Range'
};

export interface DateRangeSelectorProps {
    value: string;
    onChange: (rangeKey: string, startDate?: string, endDate?: string) => void;
    allowedRanges: string[];
    startDate?: string | null;
    endDate?: string | null;
    variant?: 'default' | 'compact';
}

export default function DateRangeSelector({
    value,
    onChange,
    allowedRanges,
    startDate,
    endDate,
    variant = 'default'
}: DateRangeSelectorProps) {
    const [customStart, setCustomStart] = useState(startDate || '');
    const [customEnd, setCustomEnd] = useState(endDate || '');

    const handleApplyCustom = () => {
        if (customStart && customEnd) {
            onChange('custom', customStart, customEnd);
        }
    };
    
    // A simple format date function to avoid importing date-fns
    const formatDate = (isoString: string) => {
        if (!isoString) return '';
        try {
            const d = new Date(isoString);
            return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch {
            return isoString;
        }
    };

    return (
        <div className={cn("flex", variant === 'default' ? "flex-col gap-2" : "items-center gap-2")}>
            {variant === 'default' && (
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Calendar size={14} />
                    Data Period
                </div>
            )}
            
            <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                <div className={variant === 'default' ? "w-56" : "w-48"}>
                    <Select
                        value={value}
                        onValueChange={(val) => {
                            if (val !== 'custom') {
                                onChange(val);
                            } else {
                                onChange('custom', customStart, customEnd);
                            }
                        }}
                    >
                        <SelectTrigger className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-sm font-semibold shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500">
                            <SelectValue placeholder="Select period" />
                        </SelectTrigger>
                        <SelectContent>
                            {allowedRanges.map((range) => (
                                <SelectItem key={range} value={range} className="font-medium">
                                    {RANGE_LABELS[range] || range}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                
                {value === 'custom' && (
                    <div className="flex items-center gap-2">
                        <input 
                            type="date" 
                            value={customStart}
                            onChange={(e) => setCustomStart(e.target.value)}
                            className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-indigo-500/20"
                        />
                        <span className="text-slate-400">to</span>
                        <input 
                            type="date" 
                            value={customEnd}
                            onChange={(e) => setCustomEnd(e.target.value)}
                            className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-indigo-500/20"
                        />
                        <button 
                            onClick={handleApplyCustom}
                            disabled={!customStart || !customEnd}
                            className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-50"
                        >
                            Apply
                        </button>
                    </div>
                )}
            </div>

            {/* Displaying actual applied dates if available */}
            {variant === 'default' && startDate && endDate && value !== 'all_time' && (
                <div className="text-xs text-slate-500 font-medium">
                    Showing: {formatDate(startDate)} &rarr; {formatDate(endDate)}
                </div>
            )}
            {variant === 'default' && value === 'all_time' && (
                <div className="text-xs text-slate-500 font-medium">
                    Showing: All historical data
                </div>
            )}
        </div>
    );
}
