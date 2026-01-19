
import React, { useMemo } from 'react';
import { Cost, User, Stage } from '../types';
import { formatCurrency, formatDate } from '../utils/finance';
import { ArrowRight, CalendarDays, CheckCircle2, Wallet } from 'lucide-react';

interface ActivityLogProps {
  costs: Cost[];
  users: User[];
  stages: Stage[];
}

type ActivityItem = {
  id: string;
  type: 'SPEND' | 'REPAY';
  date: Date;
  actorId: string; // Người thực hiện hành động (Người chi hoặc Người trả nợ)
  targetId?: string; // Người nhận (đối với trả nợ)
  amount: number;
  description: string;
  subDescription?: string;
};

export const ActivityLog: React.FC<ActivityLogProps> = ({ costs, users, stages }) => {
  
  const activities = useMemo(() => {
    const items: ActivityItem[] = [];

    costs.forEach(cost => {
      // 1. Thêm hoạt động chi tiêu (Spending)
      // Sử dụng createdAt nếu có, hoặc parse ngày từ chuỗi date
      const costDate = cost.createdAt ? new Date(cost.createdAt) : new Date(cost.date);
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

      // 2. Thêm hoạt động trả nợ (Repayment)
      cost.allocations.forEach(allocation => {
        // Iterate through all payments in history
        if (allocation.payments && allocation.payments.length > 0) {
             allocation.payments.forEach(payment => {
                const payDate = new Date(payment.date);
                // Set giờ là cuối ngày để nếu trùng ngày với cost thì nó hiện sau
                payDate.setHours(23, 59, 59);

                const principal = payment.amount;
                // Interest ignored

                items.push({
                    id: `repay-${cost.id}-${allocation.userId}-${payment.id}`,
                    type: 'REPAY',
                    date: payDate,
                    actorId: allocation.userId, // Người trả (Con nợ)
                    targetId: cost.payerId, // Người nhận (Chủ nợ)
                    amount: principal,
                    description: `Hoàn trả: ${cost.description}`,
                    subDescription: `Đã trả nợ gốc`
                });
             });
        }
      });
    });

    // Sắp xếp mới nhất lên đầu
    return items.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [costs, users, stages]);

  const getUser = (id: string) => users.find(u => u.id === id);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
        <CalendarDays className="w-6 h-6 text-indigo-600" />
        Nhật ký hoạt động
      </h2>

      <div className="relative border-l-2 border-slate-100 ml-3 space-y-8">
        {activities.length === 0 && (
          <p className="pl-8 text-slate-500 italic">Chưa có hoạt động nào được ghi nhận.</p>
        )}
        
        {activities.map((item) => {
          const actor = getUser(item.actorId);
          const target = item.targetId ? getUser(item.targetId) : null;
          const isSpend = item.type === 'SPEND';

          return (
            <div key={item.id} className="relative pl-8 animate-in slide-in-from-bottom-2 duration-300">
              {/* Icon Dot */}
              <div className={`absolute -left-[9px] top-1 p-1 rounded-full border-2 bg-white ${isSpend ? 'border-amber-200 text-amber-600' : 'border-green-200 text-green-600'}`}>
                 {isSpend ? <Wallet className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
              </div>

              {/* Card */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-slate-50 border border-slate-100 hover:shadow-md transition-shadow">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-slate-400">{formatDate(item.date)}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${isSpend ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                      {isSpend ? 'Chi tiêu' : 'Trả nợ'}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-slate-900 font-medium mb-1">
                    <div className="flex items-center gap-1.5">
                       <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px]">{actor?.avatar}</span>
                       <span className="font-bold">{actor?.name}</span>
                    </div>
                    {isSpend ? (
                      <span className="text-slate-500 font-normal">đã chi tiền</span>
                    ) : (
                      <>
                        <span className="text-slate-400"><ArrowRight className="w-3 h-3" /></span>
                        <div className="flex items-center gap-1.5">
                           <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px]">{target?.avatar}</span>
                           <span className="font-bold">{target?.name}</span>
                        </div>
                      </>
                    )}
                  </div>
                  
                  <h3 className="text-base font-semibold text-slate-800">{item.description}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{item.subDescription}</p>
                </div>

                <div className="text-right">
                  <span className={`text-lg font-bold ${isSpend ? 'text-amber-600' : 'text-green-600'}`}>
                    {isSpend ? '-' : '+'}{formatCurrency(item.amount)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
