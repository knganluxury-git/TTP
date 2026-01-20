
import React, { useState, useEffect, useRef } from 'react';
import { Stage, StageStatus, Role } from '../types';
import { formatCurrency, formatDate } from '../utils/finance';
import { CheckCircle2, Circle, Clock, Trash2, Plus, Coins, Pencil, PiggyBank, Bell, BellRing, Check, X } from 'lucide-react';

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

// --- SUB-COMPONENTS FOR EXPLICIT SAVE INPUTS ---

const StageNameInput = ({ value, onUpdate, placeholder }: { value: string, onUpdate: (val: string) => void, placeholder?: string }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [tempValue, setTempValue] = useState(value);
    const inputRef = useRef<HTMLInputElement>(null);

    // Sync temp value when prop changes (external update)
    useEffect(() => {
        setTempValue(value);
    }, [value]);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isEditing]);

    const handleSave = () => {
        if (tempValue.trim() !== value) {
            onUpdate(tempValue);
        }
        setIsEditing(false);
    };

    const handleCancel = () => {
        setTempValue(value);
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') handleCancel();
    };

    if (isEditing) {
        return (
            <div className="flex-1 flex items-center gap-1 min-w-0 animate-in fade-in zoom-in-95 duration-200">
                <input 
                    ref={inputRef}
                    type="text" 
                    value={tempValue} 
                    onChange={(e) => setTempValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="flex-1 min-w-0 font-bold text-slate-900 text-lg bg-white border border-blue-300 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder={placeholder}
                />
                <button 
                    onClick={handleSave} 
                    className="p-1.5 bg-green-100 text-green-700 hover:bg-green-200 rounded-md transition-colors shadow-sm"
                    title="Lưu"
                >
                    <Check size={18} strokeWidth={3} />
                </button>
                <button 
                    onClick={handleCancel} 
                    className="p-1.5 bg-red-100 text-red-700 hover:bg-red-200 rounded-md transition-colors shadow-sm"
                    title="Hủy"
                >
                    <X size={18} strokeWidth={3} />
                </button>
            </div>
        );
    }

    return (
        <div 
            onClick={() => setIsEditing(true)} 
            className="flex-1 min-w-0 group flex items-center gap-2 cursor-pointer py-1 px-1 -ml-1 border border-transparent hover:border-slate-200 hover:bg-slate-50/80 rounded transition-all"
        >
            <h3 className="font-bold text-slate-900 text-lg truncate">{value || placeholder}</h3>
            <Pencil className="w-3.5 h-3.5 text-slate-400 opacity-50 group-hover:text-blue-500 group-hover:opacity-100 transition-all flex-shrink-0" />
        </div>
    );
};

const BudgetInput = ({ value, onUpdate }: { value: number, onUpdate: (val: number) => void }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [tempStr, setTempStr] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Format number helper
    const format = (num: number) => num > 0 ? new Intl.NumberFormat('vi-VN').format(num) : '';

    useEffect(() => {
        setTempStr(format(value));
    }, [value]);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isEditing]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/\D/g, '');
        if (!raw) {
            setTempStr('');
            return;
        }
        const num = parseInt(raw);
        setTempStr(new Intl.NumberFormat('vi-VN').format(num));
    };

    const handleSave = () => {
        const num = parseInt(tempStr.replace(/\D/g, '') || '0');
        if (num !== value) {
            onUpdate(num);
        }
        setIsEditing(false);
    };

    const handleCancel = () => {
        setTempStr(format(value));
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') handleCancel();
    };

    if (isEditing) {
        return (
            <div className="flex items-center gap-1 mt-1 justify-end animate-in fade-in zoom-in-95 duration-200">
                <input 
                    ref={inputRef}
                    type="text"
                    inputMode="numeric"
                    value={tempStr}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    placeholder="0"
                    className="w-32 font-bold text-slate-900 text-right bg-white border border-blue-300 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-blue-100 text-sm"
                />
                <button 
                    onClick={handleSave} 
                    className="p-1 bg-green-100 text-green-700 hover:bg-green-200 rounded shadow-sm"
                >
                    <Check size={14} strokeWidth={3} />
                </button>
                <button 
                    onClick={handleCancel} 
                    className="p-1 bg-red-100 text-red-700 hover:bg-red-200 rounded shadow-sm"
                >
                    <X size={14} strokeWidth={3} />
                </button>
            </div>
        );
    }

    return (
        <div 
            onClick={() => setIsEditing(true)}
            className="group cursor-pointer flex items-center justify-end gap-2 p-1 -mr-1 rounded hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all"
        >
            <div className="font-bold text-slate-600 text-right">
                 {formatCurrency(value)}
            </div>
            <Pencil className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 text-blue-500 transition-opacity" />
        </div>
    );
};

const StageDateRangeInput = ({ startDate, endDate, onUpdate }: { startDate: string, endDate: string, onUpdate: (start: string, end: string) => void }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [tempStart, setTempStart] = useState(startDate);
    const [tempEnd, setTempEnd] = useState(endDate);

    useEffect(() => {
        setTempStart(startDate);
        setTempEnd(endDate);
    }, [startDate, endDate]);

    const handleSave = () => {
        if (tempStart !== startDate || tempEnd !== endDate) {
            onUpdate(tempStart, tempEnd);
        }
        setIsEditing(false);
    };

    const handleCancel = () => {
        setTempStart(startDate);
        setTempEnd(endDate);
        setIsEditing(false);
    };

    if (isEditing) {
        return (
            <div className="flex flex-wrap items-center gap-2 mb-3 animate-in fade-in zoom-in-95 duration-200">
                <input 
                    type="date" 
                    value={tempStart}
                    onChange={(e) => setTempStart(e.target.value)}
                    className="border border-blue-300 rounded px-2 py-1 text-xs text-slate-800 bg-white focus:ring-2 focus:ring-blue-100 outline-none"
                />
                <span className="text-slate-400">→</span>
                <input 
                    type="date" 
                    value={tempEnd}
                    onChange={(e) => setTempEnd(e.target.value)}
                    className="border border-blue-300 rounded px-2 py-1 text-xs text-slate-800 bg-white focus:ring-2 focus:ring-blue-100 outline-none"
                />
                <div className="flex gap-1 ml-1">
                    <button 
                        onClick={handleSave} 
                        className="p-1 bg-green-100 text-green-700 hover:bg-green-200 rounded shadow-sm"
                        title="Lưu ngày"
                    >
                        <Check size={14} strokeWidth={3} />
                    </button>
                    <button 
                        onClick={handleCancel} 
                        className="p-1 bg-red-100 text-red-700 hover:bg-red-200 rounded shadow-sm"
                        title="Hủy"
                    >
                        <X size={14} strokeWidth={3} />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div 
            onClick={() => setIsEditing(true)}
            className="group flex items-center gap-3 mb-3 text-sm text-slate-500 cursor-pointer w-fit p-1 -ml-1 rounded hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all"
        >
            <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
            <span className={!startDate ? "text-slate-300 italic" : ""}>{formatDate(startDate) || "Bắt đầu"}</span>
            <span className="text-slate-300">→</span>
            <span className={!endDate ? "text-slate-300 italic" : ""}>{formatDate(endDate) || "Kết thúc"}</span>
            <Pencil className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 text-blue-500 transition-opacity" />
        </div>
    );
};


export const Timeline: React.FC<TimelineProps> = ({ 
  stages, 
  role, 
  onUpdateStatus, 
  onUpdateStageDates, 
  onUpdateStageName, 
  onUpdateStageBudget,
  onTogglePaymentCall,
  onDeleteStage, 
  onAddStage 
}) => {

  const getStatusColor = (status: StageStatus) => {
    switch (status) {
      case StageStatus.COMPLETED: return 'text-green-600 bg-green-50 border-green-200';
      case StageStatus.IN_PROGRESS: return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-slate-500 bg-slate-50 border-slate-200';
    }
  };

  const getIcon = (status: StageStatus) => {
    switch (status) {
      case StageStatus.COMPLETED: return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case StageStatus.IN_PROGRESS: return <Clock className="w-5 h-5 text-blue-500" />;
      default: return <Circle className="w-5 h-5 text-slate-300" />;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
            <h2 className="text-xl font-bold text-slate-800">Tiến độ Dự án</h2>
            <p className="text-xs text-slate-500 mt-1">Theo dõi tiến độ và ngân sách từng giai đoạn</p>
        </div>
        {role === Role.ADMIN && (
          <button onClick={onAddStage} className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg transition-colors">
            <Plus className="w-4 h-4" /> Thêm giai đoạn
          </button>
        )}
      </div>

      <div className="relative border-l-2 border-slate-100 ml-3 space-y-8">
        {stages.length === 0 && (
             <div className="pl-8 text-sm text-slate-400 italic py-4">Chưa có giai đoạn nào. Hãy thêm mới.</div>
        )}
        {stages.map((stage) => {
          const percentUsed = stage.budget > 0 ? (stage.totalCost / stage.budget) * 100 : 0;
          let progressColor = 'bg-green-500';
          if (percentUsed > 100) progressColor = 'bg-red-500';
          else if (percentUsed > 80) progressColor = 'bg-amber-500';

          return (
            <div key={stage.id} className="relative pl-8 animate-in slide-in-from-bottom-2 duration-300">
                {/* Timeline Dot */}
                <div className="absolute -left-[9px] top-1 bg-white p-0.5 z-10">
                {getIcon(stage.status)}
                </div>

                {/* Content Card */}
                <div className="group flex flex-col lg:flex-row gap-6 p-5 rounded-xl border border-slate-100 hover:border-blue-100 hover:shadow-md transition-all bg-slate-50/50">
                    {/* Left: Info & Dates */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                            {role === Role.ADMIN ? (
                                <StageNameInput 
                                    value={stage.name}
                                    onUpdate={(val) => onUpdateStageName(stage.id, val)}
                                    placeholder="Nhập tên giai đoạn..."
                                />
                            ) : (
                                <h3 className="font-bold text-slate-900 text-lg truncate">{stage.name}</h3>
                            )}
                            
                            <div className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${getStatusColor(stage.status)} whitespace-nowrap flex-shrink-0`}>
                                {stage.status}
                            </div>
                        </div>
                        
                        {role === Role.ADMIN ? (
                            <StageDateRangeInput 
                                startDate={stage.startDate}
                                endDate={stage.endDate}
                                onUpdate={(start, end) => onUpdateStageDates(stage.id, start, end)}
                            />
                        ) : (
                            <div className="flex items-center gap-3 mb-3 text-sm text-slate-500">
                                <CalendarIcon className="w-3.5 h-3.5" />
                                <span>{formatDate(stage.startDate)}</span>
                                <span>→</span>
                                <span>{formatDate(stage.endDate)}</span>
                            </div>
                        )}

                        <div className="flex items-center gap-3 pt-2">
                             {role === Role.ADMIN && (
                                <div className="flex items-center gap-2 transition-opacity">
                                    <select 
                                        value={stage.status}
                                        onChange={(e) => onUpdateStatus(stage.id, e.target.value as StageStatus)}
                                        className="text-xs border rounded px-2 py-1 bg-white cursor-pointer shadow-sm hover:border-blue-300 focus:ring-2 focus:ring-blue-100 outline-none"
                                    >
                                    {Object.values(StageStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                    <button 
                                        onClick={() => onDeleteStage(stage.id)} 
                                        className="text-red-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 transition-colors"
                                        title="Xóa giai đoạn"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                            
                            {/* Payment Call Button */}
                            {role === Role.ADMIN && (
                                <button 
                                    onClick={() => onTogglePaymentCall(stage.id)}
                                    title={stage.paymentCallAmount ? "Tắt thông báo đóng tiền" : "Gửi thông báo đóng tiền"}
                                    className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${stage.paymentCallAmount ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'}`}
                                >
                                    {stage.paymentCallAmount ? <BellRing className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
                                    {stage.paymentCallAmount ? 'Đang nhắc nhở' : 'Nhắc đóng tiền'}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Right: Budget & Actual Cost Management */}
                    <div className="flex-shrink-0 flex flex-col sm:flex-row gap-4">
                         {/* Budget Box */}
                         <div className="bg-white p-4 rounded-lg border border-slate-100 shadow-sm min-w-[160px] flex flex-col justify-center relative">
                             <div className="text-xs text-slate-500 font-medium uppercase tracking-wider flex items-center gap-1 mb-1">
                                 <PiggyBank className="w-3.5 h-3.5" /> Ngân sách
                             </div>
                             {role === Role.ADMIN ? (
                                 <BudgetInput 
                                     value={stage.budget}
                                     onUpdate={(val) => onUpdateStageBudget(stage.id, val)}
                                 />
                             ) : (
                                 <div className="font-bold text-slate-600 text-right">
                                     {formatCurrency(stage.budget)}
                                 </div>
                             )}
                         </div>

                         {/* Actual Cost Box */}
                         <div className="bg-white p-4 rounded-lg border border-slate-100 shadow-sm min-w-[160px] flex flex-col justify-center">
                             <div className="text-xs text-slate-500 font-medium uppercase tracking-wider flex items-center gap-1 mb-1">
                                 <Coins className="w-3.5 h-3.5" /> Thực chi
                             </div>
                             <div className={`text-xl font-bold text-right ${percentUsed > 100 ? 'text-red-600' : 'text-slate-800'}`}>
                                 {formatCurrency(stage.totalCost)}
                             </div>
                             
                             {/* Progress Bar */}
                             {stage.budget > 0 && (
                                 <div className="mt-2 w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                     <div 
                                        className={`h-full rounded-full transition-all duration-500 ${progressColor}`} 
                                        style={{ width: `${Math.min(percentUsed, 100)}%` }}
                                     />
                                 </div>
                             )}
                             {stage.budget > 0 && (
                                 <div className="text-[10px] text-right mt-1 text-slate-400">
                                     {percentUsed.toFixed(1)}% ngân sách
                                 </div>
                             )}
                         </div>
                    </div>
                </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

function CalendarIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
  )
}
