
import React, { useMemo } from 'react';
import { User, Cost, DebtRecord } from '../types';
import { formatCurrency, formatDate } from '../utils/finance';
import { X, Wallet, PiggyBank, Scale, Percent, TrendingUp } from 'lucide-react';

interface PersonalReportProps {
  user: User;
  users: User[];
  costs: Cost[];
  debts: DebtRecord[];
  onClose: () => void;
}

export const PersonalReport: React.FC<PersonalReportProps> = ({ user, users, costs, debts, onClose }) => {
  // 1. Calculate Summary Metrics
  const summary = useMemo(() => {
    // Total Share: Sum of amounts allocated to this user in APPROVED costs
    const totalShare = costs
      .filter(c => c.status === 'APPROVED')
      .reduce((acc, c) => {
        const alloc = c.allocations.find(a => a.userId === user.id);
        return acc + (alloc ? alloc.amount : 0);
      }, 0);

    // Total Paid Calculation (Net Cash Outflow)
    // Part A: Money paid to external parties (Direct Project Costs)
    const directProjectPayments = costs
      .filter(c => c.status === 'APPROVED' && c.payerId === user.id)
      .reduce((acc, c) => acc + c.amount, 0);

    // Part B: Money paid to friends (Internal Debt Repayment)
    const internalRepayments = costs
      .filter(c => c.status === 'APPROVED')
      .reduce((acc, c) => {
        // If I am the payer of the cost, I don't repay myself here.
        if (c.payerId === user.id) return acc;

        const myAlloc = c.allocations.find(a => a.userId === user.id);
        if (myAlloc && myAlloc.payments) {
            const sumPayments = myAlloc.payments.reduce((sum, p) => sum + p.amount, 0);
            return acc + sumPayments;
        }
        return acc;
      }, 0);

    // Part C: Money received from friends (Repayment In)
    const repaymentReceived = costs
      .filter(c => c.status === 'APPROVED' && c.payerId === user.id)
      .reduce((acc, c) => {
         const receivedFromOthers = c.allocations
            .filter(a => a.userId !== user.id)
            .reduce((sumAlloc, a) => {
                const paymentsSum = (a.payments || []).reduce((sumP, p) => sumP + p.amount, 0);
                return sumAlloc + paymentsSum;
            }, 0);
         return acc + receivedFromOthers;
      }, 0);

    // Net Cash Outflow = (Money Out) - (Money In)
    const totalPaid = (directProjectPayments + internalRepayments) - repaymentReceived;

    // Receivables (People owe me)
    const receivables = debts
      .filter(d => d.creditorId === user.id)
      .reduce((acc, d) => acc + d.totalDebt, 0);

    // Payables (I owe people)
    const payables = debts
      .filter(d => d.debtorId === user.id)
      .reduce((acc, d) => acc + d.totalDebt, 0);

    return { totalShare, totalPaid, receivables, payables };
  }, [costs, debts, user.id]);

  // 2. Get Personal Transaction History
  const history = useMemo(() => {
    let items: any[] = [];

    // Filter ONLY APPROVED costs for history
    costs.filter(c => c.status === 'APPROVED').forEach(c => {
        // A. I paid for this cost
        if (c.payerId === user.id) {
            items.push({
                id: `paid-${c.id}`,
                date: c.date,
                description: c.description,
                type: 'PAID', // Chi tiền
                amount: c.amount,
                detail: 'Đã chi cho dự án'
            });
        }

        // B. I was allocated a share (My responsibility)
        const myAlloc = c.allocations.find(a => a.userId === user.id);
        if (myAlloc) {
             items.push({
                id: `share-${c.id}`,
                date: c.date,
                description: c.description,
                type: 'SHARE', // Ghi nhận nợ/trách nhiệm
                amount: myAlloc.amount,
                detail: `Phần đóng góp của bạn (${myAlloc.percentage.toFixed(0)}%)`
            });
        }

        // C. Repayments logic (based on allocations)
        c.allocations.forEach(a => {
            if (a.payments) {
                a.payments.forEach(p => {
                    const principal = p.amount;
                    // Interest ignored

                    // I paid someone back
                    if (a.userId === user.id) {
                        const receiver = users.find(u => u.id === c.payerId)?.name;
                        items.push({
                             id: `repay-out-${p.id}`,
                             date: p.date,
                             description: `Trả nợ: ${c.description}`,
                             type: 'REPAY_OUT',
                             amount: principal,
                             detail: `Đã trả cho ${receiver}`
                        });
                    }
                    // Someone paid me back
                    if (c.payerId === user.id && a.userId !== user.id) {
                        const sender = users.find(u => u.id === a.userId)?.name;
                        items.push({
                             id: `repay-in-${p.id}`,
                             date: p.date,
                             description: `Nhận trả nợ: ${c.description}`,
                             type: 'REPAY_IN',
                             amount: principal,
                             detail: `Nhận từ ${sender}`
                        });
                    }
                });
            }
        });
    });

    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [costs, user.id, users]);

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex justify-end" onClick={onClose}>
       <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold shadow-lg shadow-blue-200">
                    {user.avatar}
                </div>
                <div>
                    <h2 className="text-lg font-bold text-slate-800">{user.name}</h2>
                    <p className="text-xs text-slate-500 uppercase tracking-wider">Báo cáo tài chính cá nhân</p>
                </div>
             </div>
             <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors">
                 <X className="w-5 h-5" />
             </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8">
             
             {/* 1. Summary Cards */}
             <div className="space-y-3">
                 <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
                        <div className="flex items-center gap-2 text-blue-600 mb-1">
                            <PiggyBank className="w-4 h-4" />
                            <span className="text-[10px] font-bold uppercase">Tổng trách nhiệm</span>
                        </div>
                        <div className="text-lg font-bold text-slate-800">{formatCurrency(summary.totalShare)}</div>
                        <p className="text-[10px] text-slate-500">Số tiền bạn phải đóng góp</p>
                    </div>
                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-100">
                        <div className="flex items-center gap-2 text-amber-600 mb-1">
                            <Wallet className="w-4 h-4" />
                            <span className="text-[10px] font-bold uppercase">Tổng thực chi</span>
                        </div>
                        <div className="text-lg font-bold text-slate-800">{formatCurrency(summary.totalPaid)}</div>
                        <p className="text-[10px] text-slate-500">Thực chi (Dự án + Gốc đã trả - Gốc thu hồi)</p>
                    </div>
                 </div>

                 {/* Interest Row REMOVED */}

                 <div className="p-4 rounded-xl bg-slate-800 text-white shadow-lg">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-slate-300">
                            <Scale className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase">Dư nợ ròng hiện tại</span>
                        </div>
                    </div>
                    <div className={`text-2xl font-bold ${summary.receivables - summary.payables >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {summary.receivables - summary.payables >= 0 ? '+' : ''}{formatCurrency(summary.receivables - summary.payables)}
                    </div>
                    <div className="flex gap-4 mt-3 pt-3 border-t border-slate-700">
                         <div className="flex-1">
                            <span className="text-[10px] text-slate-400 block mb-0.5">Phải thu (Bạn bè nợ)</span>
                            <span className="text-sm font-bold text-emerald-400">{formatCurrency(summary.receivables)}</span>
                         </div>
                         <div className="flex-1 text-right">
                            <span className="text-[10px] text-slate-400 block mb-0.5">Phải trả (Nợ bạn bè)</span>
                            <span className="text-sm font-bold text-rose-400">{formatCurrency(summary.payables)}</span>
                         </div>
                    </div>
                 </div>
             </div>

             {/* 2. Debt Details (Who owes whom) */}
             {(summary.receivables > 0 || summary.payables > 0) && (
                 <div>
                    <h3 className="text-sm font-bold text-slate-800 mb-3 uppercase">Chi tiết nợ nần</h3>
                    <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100 text-sm">
                        {debts.filter(d => d.debtorId === user.id).map(d => (
                            <div key={d.creditorId} className="p-3 flex justify-between items-center">
                                <span className="text-slate-600">Nợ <strong className="text-slate-800">{users.find(u => u.id === d.creditorId)?.name}</strong></span>
                                <span className="font-bold text-rose-600">-{formatCurrency(d.totalDebt)}</span>
                            </div>
                        ))}
                        {debts.filter(d => d.creditorId === user.id).map(d => (
                            <div key={d.debtorId} className="p-3 flex justify-between items-center">
                                <span className="text-slate-600"><strong className="text-slate-800">{users.find(u => u.id === d.debtorId)?.name}</strong> nợ</span>
                                <span className="font-bold text-emerald-600">+{formatCurrency(d.totalDebt)}</span>
                            </div>
                        ))}
                    </div>
                 </div>
             )}

             {/* 3. Transaction History */}
             <div>
                <h3 className="text-sm font-bold text-slate-800 mb-3 uppercase">Lịch sử dòng tiền của bạn</h3>
                <div className="relative border-l-2 border-slate-100 ml-2 space-y-6 pl-5">
                    {history.length === 0 && <p className="text-sm text-slate-400 italic">Chưa có giao dịch liên quan.</p>}
                    {history.map(item => (
                        <div key={item.id} className="relative">
                            <div className={`absolute -left-[27px] top-1 w-3 h-3 rounded-full border-2 border-white 
                                ${item.type === 'PAID' ? 'bg-amber-500' : 
                                  item.type === 'SHARE' ? 'bg-slate-300' :
                                  item.type === 'REPAY_OUT' ? 'bg-rose-500' : 'bg-emerald-500'}`} 
                            />
                            <div className="flex justify-between items-start">
                                <div className="pr-4">
                                    <div className="text-[10px] font-bold text-slate-400 mb-0.5">{formatDate(item.date)}</div>
                                    <div className="font-medium text-slate-800 text-sm">{item.description}</div>
                                    <div className="text-xs text-slate-500 mt-0.5">{item.detail}</div>
                                </div>
                                <div className={`text-sm font-bold whitespace-nowrap
                                    ${item.type === 'PAID' ? 'text-amber-600' : 
                                      item.type === 'SHARE' ? 'text-slate-400' :
                                      item.type === 'REPAY_OUT' ? 'text-rose-600' : 'text-emerald-600'}`}>
                                    {item.type === 'PAID' ? '-' : 
                                     item.type === 'SHARE' ? '' :
                                     item.type === 'REPAY_OUT' ? '-' : '+'}{formatCurrency(item.amount)}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
             </div>

          </div>
       </div>
    </div>
  );
};
