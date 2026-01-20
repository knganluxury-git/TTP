
import React, { useState, useEffect, useRef } from 'react';
import { Stage, StageStatus, Role } from '../types';
import { formatCurrency, formatDate } from '../utils/finance';
import { CheckCircle2, Circle, Clock, Trash2, Plus, Coins, Pencil, PiggyBank, Bell, BellRing, Check, X, Calendar } from 'lucide-react';

interface TimelineProps {
  stages: Stage[];
  role: Role;
  onUpdateStatus: (id: string, status: StageStatus) => void;
  onUpdateStageDates: (id: string, startDate: string, endDate: string) => void;
  onUpdateStageName: (id: string, name: string) => void;
  onUpdateStageBudget: (id: string, budget: number) => void;
  onTogglePaymentCall: (id: string) => void;
  onDeleteStage: (id: string) => void;
  onAddStage: () => void;
}

const StageNameInput = ({ value, onUpdate, placeholder }: { value: string, onUpdate: (val: string) => void, placeholder?: string }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [tempValue, setTempValue] = useState(value);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { setTempValue(value); }, [value]);
    useEffect(() => { if (isEditing && inputRef.current) inputRef.current.focus(); }, [isEditing]);

    const handleSave = () => { if (tempValue.trim() !== value) onUpdate(tempValue); setIsEditing(false); };
    const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setIsEditing(false); };

    if (isEditing) {
        return (
            <div className="flex-1 flex items-center gap-1 min-w-0">
                <input ref={inputRef} type="text" value={tempValue} onChange={(e) => setTempValue(e.target.value)} onKeyDown={handleKeyDown} className="flex-1 font-bold text-lg bg-white border border-primary-300 rounded px-2 py-0.5 outline-none" placeholder={placeholder} />
                <button onClick={handleSave} className="p-1 bg-green-100 text-green-700 rounded"><Check size={16} /></button>
            </div>
        );
    }
    return (
        <div onClick={() => setIsEditing(true)} className="flex-1 group flex items-center gap-2 cursor-pointer">
            <h3 className="font-bold text-slate-800 text-lg truncate">{value || placeholder}</h3>
            <Pencil className="w-3.5 h-3.5 text-slate-300 opacity-0 group-hover:opacity-100" />
        </div>
    );
};

const BudgetInput = ({ value, onUpdate }: { value: number, onUpdate: (val: number) => void }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [tempStr, setTempStr] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const format = (num: number) => num > 0 ? new Intl.NumberFormat('vi-VN').format(num) : '';

    useEffect(() => { setTempStr(format(value)); }, [value]);
    useEffect(() => { if (isEditing && inputRef.current) inputRef.current.focus(); }, [isEditing]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/\D/g, '');
        setTempStr(raw ? new Intl.NumberFormat('vi-VN').format(parseInt(raw)) : '');
    };
    const handleSave = () => {
        const num = parseInt(tempStr.replace(/\D/g, '') || '0');
        if (num !== value) onUpdate(num);
        setIsEditing(false);
    };

    if (isEditing) {
        return (
            <div className="flex items-center gap-1 justify-end">
                <input ref={inputRef} type="text" inputMode="numeric" value={tempStr} onChange={handleChange} onKeyDown={(e) => e.key === 'Enter' && handleSave()} placeholder="0" className="w-32 font-bold text-right bg-white border border-primary-300 rounded px-1 py-0.5 text-sm outline-none" />
                <button onClick={handleSave} className="p-0.5 bg-green-100 text-green-700 rounded"><Check size={12} /></button>
            </div>
        );
    }
    return (
        <div onClick={() => setIsEditing(true)} className="group cursor-pointer flex items-center justify-end gap-1">
            <div className="font-bold text-slate-600 text-right text-base">{value > 0 ? formatCurrency(value) : '---'}</div>
            <Pencil className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100" />
        </div>
    );
};

const StageDateRangeInput = ({ startDate, endDate, onUpdate }: { startDate: string, endDate: string, onUpdate: (start: string, end: string) => void }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [tempStart, setTempStart] = useState(startDate);
    const [tempEnd, setTempEnd] = useState(endDate);

    useEffect(() => { setTempStart(startDate); setTempEnd(endDate); }, [startDate, endDate]);
    const handleSave = () => { onUpdate(tempStart, tempEnd); setIsEditing(false); };

    if (isEditing) {
        return (
            <div className="flex items-center gap-1 mb-2">
                <input type="date" value={tempStart} onChange={(e) => setTempStart(e.target.value)} className="border rounded px-1 py-0.5 text-xs" />
                <span>-</span>
                <input type="date" value={tempEnd} onChange={(e) => setTempEnd(e.target.value)} className="border rounded px-1 py-0.5 text-xs" />
                <button onClick={handleSave} className="ml-1 text-green-600"><Check size={14}/></button>
            </div>
        );
    }
    return (
        <div onClick={() => setIsEditing(true)} className="flex items-center gap-2 mb-2 text-xs text-slate-500 cursor-pointer hover:text-primary-600 transition-colors">
            <Calendar className="w-3.5 h-3.5" />
            <span>{formatDate(startDate)}</span>
            <span>→</span>
            <span>{formatDate(endDate)}</span>
        </div>
    );
};

export const Timeline: React.FC<TimelineProps> = ({ 
  stages, role, onUpdateStatus, onUpdateStageDates, onUpdateStageName, onUpdateStageBudget, onTogglePaymentCall, onDeleteStage, onAddStage 
}) => {
  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex justify-between items-end px-2">
        <div>
            <h2 className="text-2xl font-bold text-slate-800">Lộ trình xây dựng</h2>
            <p className="text-slate-500 text-sm">Quản lý tiến độ và dòng tiền từng hạng mục</p>
        </div>
        {role === Role.ADMIN && (
          <button onClick={onAddStage} className="flex items-center gap-2 text-sm font-bold text-white bg-slate-800 px-4 py-2 rounded-xl shadow-lg hover:bg-slate-700 transition-all">
            <Plus className="w-4 h-4" /> Thêm giai đoạn
          </button>
        )}
      </div>

      <div className="relative pl-4 md:pl-8 py-2">
        {/* Continuous Line */}
        <div className="absolute left-[27px] md:left-[43px] top-4 bottom-4 w-0.5 bg-slate-200"></div>

        <div className="space-y-8 relative">
            {stages.length === 0 && <div className="p-8 text-center text-slate-400 italic bg-white rounded-2xl border border-dashed border-slate-200">Chưa có dữ liệu. Hãy thêm giai đoạn đầu tiên.</div>}
            
            {stages.map((stage, idx) => {
                const percentUsed = stage.budget > 0 ? (stage.totalCost / stage.budget) * 100 : 0;
                const isCompleted = stage.status === StageStatus.COMPLETED;
                const isInProgress = stage.status === StageStatus.IN_PROGRESS;
                const isNotStarted = stage.status === StageStatus.NOT_STARTED;

                return (
                    <div key={stage.id} className="relative flex gap-4 md:gap-6 animate-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
                        {/* Timeline Node */}
                        <div className={`w-6 h-6 md:w-8 md:h-8 rounded-full border-4 flex-shrink-0 z-10 bg-white flex items-center justify-center transition-all duration-300 mt-5
                            ${isCompleted ? 'border-emerald-500 text-emerald-500' : 
                              isInProgress ? 'border-primary-500 ring-4 ring-primary-100 scale-110' : 'border-slate-300'}`}
                        >
                            {isCompleted && <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />}
                            {isInProgress && <div className="w-2.5 h-2.5 bg-primary-500 rounded-full animate-pulse" />}
                        </div>

                        {/* Card Content */}
                        <div className={`flex-1 rounded-2xl p-5 border transition-all duration-300 group
                            ${isInProgress ? 'bg-white border-primary-200 shadow-xl shadow-primary-500/10 translate-x-1' : 
                              isCompleted ? 'bg-slate-50 border-slate-200 opacity-90' : 'bg-white border-slate-200 opacity-80 hover:opacity-100'}`}
                        >
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 border-b border-slate-50 pb-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-1">
                                        {role === Role.ADMIN ? (
                                            <StageNameInput value={stage.name} onUpdate={(val) => onUpdateStageName(stage.id, val)} placeholder="Tên giai đoạn" />
                                        ) : (
                                            <h3 className={`font-bold text-lg truncate ${isInProgress ? 'text-primary-700' : 'text-slate-700'}`}>{stage.name}</h3>
                                        )}
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${
                                            isCompleted ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                            isInProgress ? 'bg-primary-50 text-primary-600 border-primary-100' : 'bg-slate-100 text-slate-500 border-slate-200'
                                        }`}>
                                            {stage.status}
                                        </span>
                                    </div>
                                    
                                    {role === Role.ADMIN ? (
                                        <StageDateRangeInput startDate={stage.startDate} endDate={stage.endDate} onUpdate={(s, e) => onUpdateStageDates(stage.id, s, e)} />
                                    ) : (
                                        <div className="text-xs text-slate-500 flex gap-2 items-center mb-2">
                                            <Calendar className="w-3.5 h-3.5" /> {formatDate(stage.startDate)} - {formatDate(stage.endDate)}
                                        </div>
                                    )}
                                </div>

                                {role === Role.ADMIN && (
                                    <div className="flex gap-2">
                                        <select 
                                            value={stage.status}
                                            onChange={(e) => onUpdateStatus(stage.id, e.target.value as StageStatus)}
                                            className="bg-slate-50 border border-slate-200 text-xs rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-primary-500 outline-none"
                                        >
                                            {Object.values(StageStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                        <button 
                                            onClick={() => onTogglePaymentCall(stage.id)}
                                            className={`p-1.5 rounded-lg transition-colors ${stage.paymentCallAmount ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                                            title="Gọi vốn"
                                        >
                                            {stage.paymentCallAmount ? <BellRing size={16} /> : <Bell size={16} />}
                                        </button>
                                        <button 
                                            onClick={() => onDeleteStage(stage.id)}
                                            className="p-1.5 bg-red-50 text-red-400 rounded-lg hover:bg-red-100 transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Stats Grid - Vertical Stack for Better Visibility */}
                            <div className="flex flex-col gap-3">
                                {/* Budget Row */}
                                <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase">
                                        <PiggyBank size={16} className="text-slate-400" /> 
                                        <span>Ngân sách</span>
                                    </div>
                                    {role === Role.ADMIN ? (
                                        <BudgetInput value={stage.budget} onUpdate={(v) => onUpdateStageBudget(stage.id, v)} />
                                    ) : (
                                        <div className="font-bold text-slate-700 text-right text-base">{formatCurrency(stage.budget)}</div>
                                    )}
                                </div>

                                {/* Actual Cost Row */}
                                <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-200 relative overflow-hidden">
                                    <div className="relative z-10 flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase">
                                            <Coins size={16} className="text-slate-400" />
                                            <span>Thực chi</span>
                                        </div>
                                        <div className={`font-mono font-bold text-right text-base relative z-10 ${percentUsed > 100 ? 'text-rose-600' : 'text-slate-800'}`}>
                                            {formatCurrency(stage.totalCost)}
                                        </div>
                                    </div>
                                    {/* Progress Bar Background */}
                                    <div className="absolute bottom-0 left-0 h-1 bg-slate-200 w-full opacity-60">
                                        <div 
                                            className={`h-full transition-all duration-1000 ${percentUsed > 100 ? 'bg-rose-500' : percentUsed > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                                            style={{ width: `${Math.min(percentUsed, 100)}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
      </div>
    </div>
  );
};
