
import React, { useMemo, useState } from 'react';
import { Cost, User, Stage } from '../types';
import { formatCurrency, formatDate } from '../utils/finance';
import { ArrowRight, CalendarDays, CheckCircle2, Wallet, Filter, X, Search } from 'lucide-react';

interface ActivityLogProps {
  costs: Cost[];
  users: User[];
  stages: Stage[];
}

type ActivityItem = {
  id: string;
  type: 'SPEND' | 'REPAY';
  date: Date;
  actorId: string;
  targetId?: string;
  amount: number;
  description: string;
  subDescription?: string;
};

// Helper to check relative dates
const isSameDay = (d1: Date, d2: Date) => {
  return d1.getDate() === d2.getDate() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getFullYear() === d2.getFullYear();
};

export const ActivityLog: React.FC<ActivityLogProps> = ({ costs, users, stages }) => {
  const [filterType, setFilterType] = useState<'ALL' | 'SPEND' | 'REPAY'>('ALL');
  const [filterUser, setFilterUser] = useState<string>('ALL');

  // 1. Parse & Flatten Data
  const rawActivities = useMemo(() => {
    const items: ActivityItem[] = [];

    costs.forEach(cost => {
      // Date Parsing Logic (Prioritize Transaction Date)
      let costDate: Date;
      if (cost.date && /^\d{4}-\d{2}-\d{2}$/.test(cost.date)) {
          const [y, m, d] = cost.date.split('-').map(Number);
          costDate = new Date(y, m - 1, d);
      } else {
          costDate = new Date(cost.date || Date.now());
      }
      
      // Preserve time from createdAt for sorting if same day
      if (cost.createdAt) {
          const createdTime = new Date(cost.createdAt);
          costDate.setHours(createdTime.getHours(), createdTime.getMinutes(), createdTime.getSeconds());
      } else {
          costDate.setHours(12, 0, 0);
      }

      const stage = stages.find(s => s.id === cost.stageId);

      items.push({
        id: `spend-${cost.id}`,
        type: 'SPEND',
        date: costDate,
        actorId: cost.payerId,
        amount: cost.amount,
        description: cost.description,
        subDescription: `Chi cho: ${stage?.name || 'Chưa phân loại'}`
      });

      cost.allocations.forEach(allocation => {
        if (allocation.payments && allocation.payments.length > 0) {
             allocation.payments.forEach(payment => {
                let payDate: Date;
                if (payment.date && /^\d{4}-\d{2}-\d{2}$/.test(payment.date)) {
                    const [py, pm, pd] = payment.date.split('-').map(Number);
                    payDate = new Date(py, pm - 1, pd);
                } else {
                    payDate = new Date(payment.date);
                }
                payDate.setHours(23, 59, 59); // Repayments usually happen after costs

                items.push({
                    id: `repay-${cost.id}-${allocation.userId}-${payment.id}`,
                    type: 'REPAY',
                    date: payDate,
                    actorId: allocation.userId, 
                    targetId: cost.payerId,
                    amount: payment.amount,
                    description: `Hoàn trả: ${cost.description}`,
                    subDescription: `Đã trả nợ gốc`
                });
             });
        }
      });
    });

    return items.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [costs, users, stages]);

  // 2. Filter Data
  const filteredActivities = useMemo(() => {
      return rawActivities.filter(item => {
          // Filter Type
          if (filterType !== 'ALL' && item.type !== filterType) return false;
          
          // Filter User (Check if user is Actor OR Target)
          if (filterUser !== 'ALL') {
              const isActor = item.actorId === filterUser;
              const isTarget = item.targetId === filterUser;
              if (!isActor && !isTarget) return false;
          }
          return true;
      });
  }, [rawActivities, filterType, filterUser]);

  // 3. Group by Date
  const groupedActivities = useMemo<Record<string, ActivityItem[]>>(() => {
      const groups: Record<string, ActivityItem[]> = {};
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      filteredActivities.forEach(item => {
          let dateKey = formatDate(item.date); // Default DD/MM/YYYY
          
          if (isSameDay(item.date, today)) dateKey = 'Hôm nay';
          else if (isSameDay(item.date, yesterday)) dateKey = 'Hôm qua';
          
          if (!groups[dateKey]) {
              groups[dateKey] = [];
          }
          groups[dateKey].push(item);
      });

      // Keys are already roughly sorted because source array is sorted, 
      // but "Today"/"Yesterday" need to stay at top if they exist.
      // Since we iterate strictly, the insertion order preserves sort.
      return groups;
  }, [filteredActivities]);

  const getUser = (id: string) => users.find(u => u.id === id);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-full flex flex-col">
      {/* Header & Filters */}
      <div className="p-4 border-b border-slate-100 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-blue-600" />
                Nhật ký
            </h2>
            <div className="text-xs text-slate-400 font-medium">
                {filteredActivities.length} hoạt động
            </div>
          </div>

          {/* Horizontal Scrollable Filter Bar */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4 mask-fade-right">
              {/* Reset Filter */}
              {(filterType !== 'ALL' || filterUser !== 'ALL') && (
                  <button 
                    onClick={() => { setFilterType('ALL'); setFilterUser('ALL'); }}
                    className="flex-shrink-0 p-1.5 bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200"
                  >
                      <X className="w-4 h-4" />
                  </button>
              )}

              {/* Type Filters */}
              <button 
                  onClick={() => setFilterType('ALL')}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors border ${filterType === 'ALL' && filterUser === 'ALL' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200'}`}
              >
                  Tất cả
              </button>
              <button 
                  onClick={() => setFilterType('SPEND')}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors border flex items-center gap-1 ${filterType === 'SPEND' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-white text-slate-600 border-slate-200'}`}
              >
                  <Wallet className="w-3 h-3" /> Chi tiêu
              </button>
              <button 
                  onClick={() => setFilterType('REPAY')}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors border flex items-center gap-1 ${filterType === 'REPAY' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-white text-slate-600 border-slate-200'}`}
              >
                  <CheckCircle2 className="w-3 h-3" /> Trả nợ
              </button>

              <div className="w-[1px] h-6 bg-slate-200 mx-1 flex-shrink-0"></div>

              {/* User Filters */}
              {users.map(u => (
                  <button
                    key={u.id}
                    onClick={() => setFilterUser(filterUser === u.id ? 'ALL' : u.id)}
                    className={`flex-shrink-0 pl-1 pr-3 py-1 rounded-full text-xs font-bold transition-colors border flex items-center gap-1.5 ${filterUser === u.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200'}`}
                  >
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] ${filterUser === u.id ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>
                          {u.avatar}
                      </div>
                      {u.name}
                  </button>
              ))}
          </div>
      </div>

      {/* Timeline Content */}
      <div className="flex-1 overflow-y-auto p-0 sm:p-4 bg-slate-50/50">
        {Object.keys(groupedActivities).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <Search className="w-10 h-10 mb-2 opacity-20" />
                <p className="text-sm">Không tìm thấy hoạt động nào.</p>
            </div>
        ) : (
            <div className="space-y-6 sm:space-y-8 pb-8 pt-4 sm:pt-0">
                {(Object.entries(groupedActivities) as [string, ActivityItem[]][]).map(([dateKey, items]) => (
                    <div key={dateKey} className="relative animate-in slide-in-from-bottom-2 duration-300">
                        {/* Date Header (Sticky on Mobile) */}
                        <div className="sticky top-0 z-10 px-4 sm:px-0 mb-3 flex items-center">
                            <div className="bg-slate-800 text-white text-xs font-bold px-3 py-1 rounded-r-full shadow-sm">
                                {dateKey}
                            </div>
                            <div className="h-[1px] bg-slate-200 flex-1 ml-2"></div>
                        </div>

                        {/* Items List */}
                        <div className="space-y-3 px-4 sm:px-2">
                            {items.map((item) => {
                                const actor = getUser(item.actorId);
                                const target = item.targetId ? getUser(item.targetId) : null;
                                const isSpend = item.type === 'SPEND';
                                
                                return (
                                    <div key={item.id} className="relative flex gap-3">
                                        {/* Timeline Line (Visual Only) */}
                                        <div className="flex flex-col items-center">
                                            <div className={`w-2 h-2 rounded-full mt-2 ring-4 ring-slate-50 ${isSpend ? 'bg-amber-400' : 'bg-green-400'}`}></div>
                                            <div className="w-[2px] bg-slate-200 flex-1 my-1"></div>
                                        </div>

                                        {/* Content Card */}
                                        <div className="flex-1 bg-white border border-slate-100 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex justify-between items-start mb-1">
                                                <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                                                    <div className="flex items-center gap-1.5">
                                                       <span className="w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center text-[8px] font-bold text-slate-600">{actor?.avatar}</span>
                                                       <span className="text-slate-900">{actor?.name}</span>
                                                    </div>
                                                    {target && (
                                                        <>
                                                            <ArrowRight className="w-3 h-3 text-slate-300" />
                                                            <div className="flex items-center gap-1.5">
                                                               <span className="w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center text-[8px] font-bold text-slate-600">{target?.avatar}</span>
                                                               <span className="text-slate-900">{target?.name}</span>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                                <span className={`text-sm font-bold whitespace-nowrap ${isSpend ? 'text-amber-600' : 'text-green-600'}`}>
                                                    {isSpend ? '-' : '+'}{formatCurrency(item.amount)}
                                                </span>
                                            </div>

                                            <h4 className="text-sm font-semibold text-slate-800 leading-tight">{item.description}</h4>
                                            {item.subDescription && (
                                                <p className="text-[11px] text-slate-400 mt-1 truncate">{item.subDescription}</p>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
};
