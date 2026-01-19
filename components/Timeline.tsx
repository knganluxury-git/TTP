import React from 'react';
import { Stage, StageStatus, Role } from '../types';
import { formatCurrency, formatDate } from '../utils/finance';
import { CheckCircle2, Circle, Clock, Trash2, Plus, Coins, Pencil, PiggyBank, Bell, BellRing } from 'lucide-react';

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

  const parseInputMoney = (val: string) => {
      return parseInt(val.replace(/\D/g, '') || '0');
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
        {stages.map((stage) => {
          const percentUsed = stage.budget > 0 ? (stage.totalCost / stage.budget) * 100 : 0;
          let progressColor = 'bg-green-500';
          if (percentUsed > 100) progressColor = 'bg-red-500';
          else if (percentUsed > 80) progressColor = 'bg-amber-500';

          return (
            <div key={stage.id} className="relative pl-8">
                {/* Timeline Dot */}
                <div className="absolute -left-[9px] top-1 bg-white p-0.5">
                {getIcon(stage.status)}
                </div>

                {/* Content Card */}
                <div className="group flex flex-col lg:flex-row gap-6 p-5 rounded-xl border border-slate-100 hover:border-blue-100 hover:shadow-md transition-all bg-slate-50/50">
                    {/* Left: Info & Dates */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                            {role === Role.ADMIN ? (
                                <div className="flex-1 relative max-w-md">
                                    <input 
                                        type="text" 
                                        value={stage.name} 
                                        onChange={(e) => onUpdateStageName(stage.id, e.target.value)}
                                        className="font-bold text-slate-900 text-lg truncate bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none w-full transition-colors placeholder:text-slate-300 pr-6"
                                        placeholder="Nhập tên giai đoạn..."
                                    />
                                    <Pencil className="w-3 h-3 text-slate-400 absolute right-0 top-1.5 opacity-0 group-hover:opacity-100 pointer-events-none" />
                                </div>
                            ) : (
                                <h3 className="font-bold text-slate-900 text-lg truncate">{stage.name}</h3>
                            )}
                            
                            <div className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${getStatusColor(stage.status)} whitespace-nowrap flex-shrink-0`}>
                                {stage.status}
                            </div>
                        </div>
                        
                        {role === Role.ADMIN ? (
                            <div className="flex items-center gap-2 mb-3">
                                <input 
                                type="date" 
                                value={stage.startDate}
                                onChange={(e) => onUpdateStageDates(stage.id, e.target.value, stage.endDate)}
                                className="border border-slate-200 rounded px-2 py-1 text-xs text-slate-600 bg-white focus:ring-2 focus:ring-blue-100 outline-none cursor-pointer"
                                />
                                <span className="text-slate-400">→</span>
                                <input 
                                type="date" 
                                value={stage.endDate}
                                onChange={(e) => onUpdateStageDates(stage.id, stage.startDate, e.target.value)}
                                className="border border-slate-200 rounded px-2 py-1 text-xs text-slate-600 bg-white focus:ring-2 focus:ring-blue-100 outline-none cursor-pointer"
                                />
                            </div>
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
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <select 
                                        value={stage.status}
                                        onChange={(e) => onUpdateStatus(stage.id, e.target.value as StageStatus)}
                                        className="text-xs border rounded px-2 py-1 bg-white cursor-pointer shadow-sm"
                                    >
                                    {Object.values(StageStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                    <button onClick={() => onDeleteStage(stage.id)} className="text-red-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 transition-colors">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                            
                            {/* Payment Call Button */}
                            {role === Role.ADMIN && (
                                <button 
                                    onClick={() => onTogglePaymentCall(stage.id)}
                                    title={stage.paymentCallAmount ? "Tắt thông báo đóng tiền" : "Gửi thông báo đóng tiền"}
                                    className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${stage.paymentCallAmount ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
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
                                 <div className="relative group/edit">
                                    <input 
                                        type="text"
                                        inputMode="numeric"
                                        value={stage.budget > 0 ? new Intl.NumberFormat('vi-VN').format(stage.budget) : ''}
                                        onChange={(e) => onUpdateStageBudget(stage.id, parseInputMoney(e.target.value))}
                                        placeholder="0"
                                        className="w-full font-bold text-slate-600 bg-transparent border-b border-dashed border-slate-300 hover:border-indigo-400 focus:border-indigo-600 focus:ring-0 outline-none transition-colors text-right"
                                    />
                                    <Pencil className="w-3 h-3 text-slate-300 absolute left-0 top-1/2 -translate-y-1/2 opacity-0 group-hover/edit:opacity-100 pointer-events-none" />
                                 </div>
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