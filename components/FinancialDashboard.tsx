
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Cost, User, Role, DebtRecord, Stage } from '../types';
import { formatCurrency, calculateLoanStatus, formatDate } from '../utils/finance';
import { chatWithFinancialAssistant } from '../services/geminiService';
import { AlertCircle, Check, Clock, Plus, Wallet, ChevronDown, ChevronUp, Percent, DollarSign, PieChart, TrendingUp, Sparkles, Bell, ThumbsUp, AlertTriangle, X, Send, Bot, User as UserIcon, RefreshCw, MessageSquareText, Minimize2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface FinancialDashboardProps {
  costs: Cost[];
  debts: DebtRecord[];
  users: User[];
  currentUser: User;
  stages: Stage[];
  defaultInterestRate: number;
  onUpdateDefaultSettings: (rate: number) => void;
  onAddCost: (cost: Omit<Cost, 'id' | 'createdAt' | 'approvedBy' | 'status'>) => void;
  onApproveCost: (costId: string) => void;
  onMarkAsPaid: (costId: string, debtorId: string, amount: number, interest: number, paidDate: string) => void;
  onDismissPaymentCall: (stageId: string) => void;
}

interface ChatMessage {
    id: string;
    role: 'user' | 'model';
    text: string;
    timestamp: number;
}

// Helper to render basic Markdown (Bold and Line breaks)
const RenderMessageText = ({ text }: { text: string }) => {
    return (
        <div className="prose prose-sm max-w-none text-sm leading-relaxed">
            {text.split('\n').map((line, lineIdx) => {
                // Basic parsing for **bold** text
                const parts = line.split(/(\*\*.*?\*\*)/g);
                return (
                    <p key={lineIdx} className={`mb-1 ${line.trim().startsWith('-') ? 'pl-2' : ''}`}>
                        {parts.map((part, partIdx) => {
                            if (part.startsWith('**') && part.endsWith('**')) {
                                return <strong key={partIdx} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>;
                            }
                            return <span key={partIdx}>{part}</span>;
                        })}
                    </p>
                );
            })}
        </div>
    );
};

export const FinancialDashboard: React.FC<FinancialDashboardProps> = ({ 
  costs, debts, users, currentUser, stages, defaultInterestRate, onUpdateDefaultSettings, onAddCost, onApproveCost, onMarkAsPaid, onDismissPaymentCall
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedCost, setExpandedCost] = useState<string | null>(null);

  // --- AI Chat State ---
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
      { id: 'init', role: 'model', text: 'Xin chào! Tôi là trợ lý tài chính của TTP Home. \nBạn cần xem **tổng quan công nợ**, **chi phí dự án** hay **tiến độ** không?', timestamp: Date.now() }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Payment Confirmation State
  const [confirmPayment, setConfirmPayment] = useState<{
      costId: string;
      debtorId: string;
      debtorName: string;
      initialPrincipal: number; // needed for recalc
      paymentsHistory: any[]; // needed for recalc
      transactionDate: string;
      interestRate: number;
  } | null>(null);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentAmountInput, setPaymentAmountInput] = useState('');

  // Auto scroll chat
  useEffect(() => {
    if (isChatOpen) {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isTyping, isChatOpen]);

  // --- Payment Call Alerts ---
  const paymentCallStages = useMemo(() => {
    return stages.filter(s => s.paymentCallAmount && s.paymentCallAmount > 0);
  }, [stages]);

  // --- Smart Alerts State (Pendings) ---
  const alerts = useMemo(() => {
    const list = [];
    
    // 1. Pending Approval Alerts
    const myPending = costs.filter(c => c.status === 'PENDING' && !c.approvedBy.includes(currentUser.id)).length;
    if (myPending > 0) {
        list.push({
            type: 'action',
            title: 'Cần duyệt chi phí',
            message: `Bạn có ${myPending} khoản chi phí đang chờ xác nhận.`
        });
    }

    return list;
  }, [costs, currentUser.id]);

  // --- Helpers for Input Formatting ---
  const formatNumberInput = (value: string) => {
    const rawValue = value.replace(/[^0-9]/g, '');
    if (!rawValue) return '';
    return new Intl.NumberFormat('vi-VN').format(parseInt(rawValue, 10));
  };

  const parseFormattedNumber = (value: string) => {
    // Remove dots (thousand separators) and parse integer
    const rawValue = value.replace(/\./g, '');
    return parseInt(rawValue || '0', 10);
  };

  // Derived state for Modal Interest Calculation
  const paymentDetails = useMemo(() => {
    if (!confirmPayment) return { principal: 0, interest: 0, total: 0, days: 0, remainingAfterPay: 0 };
    
    // The user inputs how much Principal they want to pay off
    const amountToPay = parseFormattedNumber(paymentAmountInput);
    
    // RE-CALCULATE status based on the selected Payment Date
    const status = calculateLoanStatus(
        confirmPayment.initialPrincipal,
        confirmPayment.transactionDate,
        0, // Force 0 rate
        confirmPayment.paymentsHistory,
        paymentDate // Target date for calculation
    );
    
    const remainingAfterPay = Math.max(0, status.remainingPrincipal - amountToPay);

    return {
        principal: amountToPay,
        remainingBeforePay: status.remainingPrincipal,
        totalPayment: amountToPay, // No Interest
        remainingAfterPay,
        days: status.daysSinceLastEvent
    };
  }, [confirmPayment, paymentDate, paymentAmountInput]);

  // Form State
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [stageId, setStageId] = useState(stages[0]?.id || '');
  const [payerId, setPayerId] = useState(currentUser.id);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [allocType, setAllocType] = useState<'EQUAL' | 'CUSTOM'>('EQUAL');
  const [customAmounts, setCustomAmounts] = useState<{[key:string]: string}>({});

  // Auto-select first stage if none selected (useful when starting with 0 stages then adding one)
  useEffect(() => {
    if (!stageId && stages.length > 0) {
        setStageId(stages[0].id);
    }
  }, [stages, stageId]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(formatNumberInput(e.target.value));
  };

  const handleCustomAmountChange = (userId: string, val: string) => {
    setCustomAmounts(prev => ({
        ...prev,
        [userId]: formatNumberInput(val)
    }));
  };
  
  const handlePaymentAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPaymentAmountInput(formatNumberInput(e.target.value));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFormattedNumber(amount);
    
    if (!description || !numAmount || !stageId) return;

    let allocations = [];
    if (allocType === 'EQUAL') {
       const share = numAmount / users.length;
       allocations = users.map(u => ({ userId: u.id, amount: share, percentage: (100/users.length), paidAmount: 0, payments: [], isPaid: false }));
    } else {
       allocations = users.map(u => {
         const val = parseFormattedNumber(customAmounts[u.id] || '0');
         return { userId: u.id, amount: val, percentage: (val/numAmount)*100, paidAmount: 0, payments: [], isPaid: false };
       });
    }

    onAddCost({
      stageId,
      description,
      amount: numAmount,
      payerId,
      date,
      interestRate: 0, // Force 0
      isCustomAllocation: allocType === 'CUSTOM',
      allocations
    });
    
    setShowAddForm(false);
    setDescription('');
    setAmount('');
    setCustomAmounts({});
  };

  const handleOpenPaymentConfirm = (
      costId: string, 
      debtorId: string, 
      debtorName: string, 
      initialPrincipal: number,
      paymentsHistory: any[],
      transactionDate: string, 
      interestRate: number
  ) => {
      setPaymentDate(new Date().toISOString().split('T')[0]); // Default to today
      
      // Calculate current status to pre-fill
      const status = calculateLoanStatus(initialPrincipal, transactionDate, 0, paymentsHistory);
      
      setConfirmPayment({ 
          costId, 
          debtorId, 
          debtorName, 
          initialPrincipal,
          paymentsHistory,
          transactionDate, 
          interestRate: 0
      });
      
      setPaymentAmountInput(formatNumberInput(status.remainingPrincipal.toString()));
  };

  // --- AI HANDLER ---
  const handleSendMessage = async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!chatInput.trim() || isTyping) return;

      const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: chatInput, timestamp: Date.now() };
      setChatMessages(prev => [...prev, userMsg]);
      setChatInput('');
      setIsTyping(true);

      // Prepare context data
      const context = { stages, costs, debts, users };
      
      // Call service
      const answer = await chatWithFinancialAssistant(
          userMsg.text, 
          context, 
          chatMessages.map(m => ({role: m.role, text: m.text}))
      );

      const botMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'model', text: answer, timestamp: Date.now() };
      setChatMessages(prev => [...prev, botMsg]);
      setIsTyping(false);
  };

  // --- CALCULATE ANALYTICS ---

  // 1. Total Project Cost (Sum of all approved costs)
  const totalProjectCost = useMemo(() => {
    return costs
      .filter(c => c.status === 'APPROVED')
      .reduce((sum, c) => sum + c.amount, 0);
  }, [costs]);

  // 2. Contribution Share (Allocated amount per user in approved costs)
  const contributionData = useMemo(() => {
      return users.map(u => {
          const totalShare = costs
            .filter(c => c.status === 'APPROVED')
            .reduce((acc, cost) => {
                const userAlloc = cost.allocations.find(a => a.userId === u.id);
                return acc + (userAlloc ? userAlloc.amount : 0);
            }, 0);
          return { name: u.name, value: totalShare };
      });
  }, [costs, users]);

  const COLORS = ['#6366f1', '#10b981', '#f59e0b'];

  return (
    <div className="space-y-6 relative">
      
      {/* 0. Payment Call Alerts (High Priority) */}
      {paymentCallStages.length > 0 && (
          <div className="space-y-3">
              {paymentCallStages.map(stage => (
                  <div key={stage.id} className="p-5 rounded-xl border border-indigo-200 bg-indigo-50 shadow-md relative animate-in slide-in-from-top-2">
                      <div className="flex items-start gap-4">
                          <div className="p-3 bg-white rounded-full text-indigo-600 shadow-sm mt-1">
                              <Bell className="w-6 h-6 animate-pulse" />
                          </div>
                          <div className="flex-1">
                              <h3 className="font-bold text-lg text-indigo-900 flex items-center gap-2 mb-2">
                                🔔 Thông báo chuẩn bị tài chính
                              </h3>
                              <div className="text-indigo-900 text-sm sm:text-base leading-relaxed space-y-2">
                                  <p>
                                    Ngày <span className="font-bold bg-white px-1.5 py-0.5 rounded border border-indigo-100 shadow-sm text-indigo-700">{formatDate(stage.startDate)}</span> tới giai đoạn <span className="font-bold uppercase">{stage.name}</span>, 
                                    dự kiến tốn <span className="font-bold">{formatCurrency(stage.budget)}</span>.
                                  </p>
                                  <p>
                                    Mỗi người cần chuẩn bị <span className="font-bold text-xl text-red-600 bg-white px-2 py-0.5 rounded border border-red-100 shadow-sm mx-1">{formatCurrency(stage.paymentCallAmount || 0)}</span> trước ngày đó.
                                  </p>
                              </div>
                          </div>
                          {currentUser.role === Role.ADMIN && (
                              <button 
                                onClick={() => onDismissPaymentCall(stage.id)}
                                className="text-indigo-300 hover:text-indigo-600 p-1.5 hover:bg-indigo-100 rounded transition-colors"
                              >
                                  <X className="w-5 h-5" />
                              </button>
                          )}
                      </div>
                  </div>
              ))}
          </div>
      )}

      {/* 1. Alerts Section (Notifications) */}
      {alerts.length > 0 && (
          <div className="space-y-3">
              {alerts.map((alert, idx) => (
                  <div key={idx} className={`p-4 rounded-xl border flex items-start gap-3 shadow-sm ${alert.type === 'warning' ? 'bg-red-50 border-red-100 text-red-800' : 'bg-blue-50 border-blue-100 text-blue-800'}`}>
                      {alert.type === 'warning' ? <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" /> : <Bell className="w-5 h-5 flex-shrink-0 mt-0.5" />}
                      <div>
                          <h4 className="font-bold text-sm">{alert.title}</h4>
                          <p className="text-xs mt-1 opacity-90">{alert.message}</p>
                      </div>
                  </div>
              ))}
          </div>
      )}

      {/* 2. Debt Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users
          .filter(u => u.id === currentUser.id) // Only show the card for the current user
          .map(u => {
            const myDebts = debts.filter(d => d.debtorId === u.id);
            const totalOwed = myDebts.reduce((acc, d) => acc + d.totalDebt, 0);

            const othersDebtsToMe = debts.filter(d => d.creditorId === u.id);
            const totalReceivable = othersDebtsToMe.reduce((acc, d) => acc + d.totalDebt, 0);

            const net = totalReceivable - totalOwed;

            return (
              <div key={u.id} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                 <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                        {u.avatar}
                    </div>
                    <div>
                        <h3 className="font-semibold text-slate-800">{u.name}</h3>
                        <p className="text-xs text-slate-500">{u.role}</p>
                    </div>
                 </div>
                 
                 <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Phải thu:</span>
                        <span className="font-medium text-green-600">+{formatCurrency(totalReceivable)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Phải trả:</span>
                        <span className="font-medium text-red-600">-{formatCurrency(totalOwed)}</span>
                    </div>
                    <div className="pt-2 border-t border-slate-100 flex justify-between font-bold">
                        <span>Dư nợ ròng:</span>
                        <span className={net >= 0 ? "text-green-600" : "text-red-600"}>
                            {net >= 0 ? '+' : ''}{formatCurrency(net)}
                        </span>
                    </div>
                 </div>
              </div>
            );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 3. Transaction List & Voting Center */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col order-2 lg:order-1">
           <div className="p-6 border-b border-slate-100 flex justify-between items-center">
             <h2 className="text-lg font-bold text-slate-800">Giao dịch & Bỏ phiếu</h2>
             {currentUser.role === Role.ADMIN && (
                <button onClick={() => setShowAddForm(!showAddForm)} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition shadow-sm">
                    <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Thêm chi phí</span>
                </button>
             )}
           </div>

           {showAddForm && (
             <div className="p-6 bg-slate-50 border-b border-slate-100 animate-in slide-in-from-top-4">
                <form onSubmit={handleSubmit} className="space-y-4">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-slate-500 mb-1">Mô tả</label>
                        <input required type="text" value={description} onChange={e => setDescription(e.target.value)} className="w-full border rounded-lg p-3 text-sm" placeholder="VD: Cát xây dựng" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Số tiền (VND)</label>
                        <input 
                            required 
                            type="text" 
                            inputMode="numeric"
                            value={amount} 
                            onChange={handleAmountChange} 
                            className="w-full border rounded-lg p-3 text-sm font-mono" 
                            placeholder="0" 
                        />
                      </div>
                      {/* Interest Rate Input REMOVED */}
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Giai đoạn</label>
                        <select value={stageId} onChange={e => setStageId(e.target.value)} className="w-full border rounded-lg p-3 text-sm bg-white" required>
                           {stages.length === 0 && <option value="">Vui lòng tạo giai đoạn trước</option>}
                           {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Người chi</label>
                        <select value={payerId} onChange={e => setPayerId(e.target.value)} className="w-full border rounded-lg p-3 text-sm bg-white">
                           {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                      </div>
                      <div className="md:col-span-2">
                         <label className="block text-xs font-medium text-slate-500 mb-1">Ngày</label>
                         <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full border rounded-lg p-3 text-sm bg-white" />
                      </div>
                      <div className="md:col-span-2">
                         <label className="block text-xs font-medium text-slate-500 mb-1">Phân bổ</label>
                         <div className="flex gap-4 p-1">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" checked={allocType === 'EQUAL'} onChange={() => setAllocType('EQUAL')} className="w-4 h-4 text-indigo-600 focus:ring-indigo-500" /> 
                                <span className="text-sm">Chia đều (33%)</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" checked={allocType === 'CUSTOM'} onChange={() => setAllocType('CUSTOM')} className="w-4 h-4 text-indigo-600 focus:ring-indigo-500" /> 
                                <span className="text-sm">Tùy chỉnh</span>
                            </label>
                         </div>
                      </div>
                   </div>
                   
                   {allocType === 'CUSTOM' && (
                       <div className="bg-white p-3 rounded border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {users.map(u => (
                              <div key={u.id}>
                                  <label className="text-xs block mb-1 font-medium">{u.name}</label>
                                  <input 
                                    type="text"
                                    inputMode="numeric"
                                    value={customAmounts[u.id] || ''} 
                                    onChange={e => handleCustomAmountChange(u.id, e.target.value)}
                                    className="w-full border text-sm p-2 rounded font-mono" 
                                    placeholder="Số tiền"
                                  />
                              </div>
                          ))}
                       </div>
                   )}

                   <div className="flex justify-end gap-3 pt-2">
                      <button type="button" onClick={() => setShowAddForm(false)} className="px-4 py-2 text-slate-600 text-sm hover:bg-slate-200 rounded-lg transition-colors">Hủy</button>
                      <button type="submit" disabled={stages.length === 0} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                          {stages.length === 0 ? 'Cần tạo giai đoạn trước' : 'Lưu chi phí'}
                      </button>
                   </div>
                </form>
             </div>
           )}

           <div className="divide-y divide-slate-100 overflow-y-auto max-h-[600px] min-h-[300px]">
              {costs.length === 0 && <div className="p-8 text-center text-slate-400">Chưa có giao dịch nào.</div>}
              {costs.map(cost => {
                  const isApproved = cost.status === 'APPROVED';
                  const needsMyApproval = !cost.approvedBy.includes(currentUser.id) && cost.status === 'PENDING';
                  const approvalCount = cost.approvedBy.length;
                  const totalUsers = users.length;
                  const stageName = stages.find(s => s.id === cost.stageId)?.name || 'Giai đoạn không xác định';
                  const payerName = users.find(u => u.id === cost.payerId)?.name || 'Không xác định';

                  return (
                      <div key={cost.id} className={`p-4 hover:bg-slate-50 transition-colors ${!isApproved ? 'bg-amber-50/50' : ''}`}>
                          <div className="flex justify-between items-start cursor-pointer gap-2" onClick={() => setExpandedCost(expandedCost === cost.id ? null : cost.id)}>
                             <div className="flex gap-3 flex-1 min-w-0">
                                <div className={`mt-1 w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${isApproved ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
                                   <Wallet className="w-4 h-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <div className="font-medium text-slate-800 truncate pr-2">{cost.description}</div>
                                        {!isApproved && (
                                            <span className="text-[10px] px-1.5 py-0.5 bg-amber-200 text-amber-800 rounded font-bold whitespace-nowrap">
                                                Voting: {approvalCount}/{totalUsers}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs text-slate-500 flex flex-wrap gap-1 items-center">
                                       <span className="whitespace-nowrap">{formatDate(cost.date)}</span>
                                       <span className="hidden sm:inline">•</span>
                                       <span className="truncate max-w-[120px] sm:max-w-none">{stageName}</span>
                                    </div>
                                    <div className="text-xs text-slate-500 mt-0.5 truncate">
                                       Chi bởi <span className="font-semibold text-indigo-600">{payerName}</span>
                                    </div>
                                </div>
                             </div>
                             <div className="text-right flex-shrink-0">
                                <div className="font-bold text-slate-900">{formatCurrency(cost.amount)}</div>
                                <div className="flex items-center justify-end gap-1 mt-1">
                                    {isApproved ? (
                                        <span className="flex items-center text-[10px] sm:text-xs text-green-600 font-medium"><Check className="w-3 h-3 mr-1"/> Đã duyệt</span>
                                    ) : (
                                        <span className="flex items-center text-[10px] sm:text-xs text-amber-600 font-medium"><Clock className="w-3 h-3 mr-1"/> Chờ phiếu bầu</span>
                                    )}
                                    {expandedCost === cost.id ? <ChevronUp className="w-4 h-4 text-slate-400"/> : <ChevronDown className="w-4 h-4 text-slate-400"/>}
                                </div>
                             </div>
                          </div>
                          
                          {/* Expanded Details */}
                          {expandedCost === cost.id && (
                              <div className="mt-4 pl-0 sm:pl-11 text-sm space-y-3 animate-in slide-in-from-top-1">
                                  {/* Pending Approval Action Section */}
                                  {needsMyApproval && (
                                      <div className="p-4 bg-white rounded-lg border-2 border-amber-100 shadow-sm mb-4">
                                          <div className="flex items-start gap-3">
                                              <div className="p-2 bg-amber-100 rounded-full text-amber-600">
                                                  <AlertCircle className="w-5 h-5" />
                                              </div>
                                              <div className="flex-1">
                                                  <h4 className="font-bold text-slate-800">Cần phiếu bầu của bạn</h4>
                                                  <p className="text-xs text-slate-500 mt-1">
                                                      Khoản chi này cần được tất cả thành viên xác nhận trước khi tính vào công nợ. Vui lòng kiểm tra kỹ số tiền và người thụ hưởng.
                                                  </p>
                                                  <div className="mt-3 flex gap-2">
                                                      <button 
                                                        onClick={(e) => { e.stopPropagation(); onApproveCost(cost.id); }}
                                                        className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white text-sm font-bold rounded-lg shadow-sm hover:bg-amber-600 transition-colors"
                                                      >
                                                          <ThumbsUp className="w-4 h-4" />
                                                          Đồng ý duyệt chi
                                                      </button>
                                                  </div>
                                              </div>
                                          </div>
                                      </div>
                                  )}

                                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                      <p className="font-medium text-slate-700 mb-2 text-xs uppercase tracking-wider">Chi tiết phân bổ</p>
                                      <ul className="space-y-2">
                                          {cost.allocations.map(a => {
                                              const u = users.find(user => user.id === a.userId);
                                              // Only the payer or ADMIN can mark as paid. And only if transaction is fully approved.
                                              const canMarkAsPaid = (currentUser.role === Role.ADMIN || currentUser.id === cost.payerId) && cost.status === 'APPROVED';
                                              const isDebtor = a.userId !== cost.payerId;
                                              const paidAmount = a.paidAmount || 0;
                                              
                                              // Use centralized calc logic for display
                                              const status = calculateLoanStatus(a.amount, cost.date, 0, a.payments || []);
                                              
                                              const isFullyPaid = status.remainingPrincipal <= 0;

                                              return (
                                                  <li key={a.userId} className="flex flex-col sm:flex-row sm:justify-between sm:items-center text-slate-600 gap-1 sm:gap-0 pb-2 border-b border-slate-100 last:border-0 last:pb-0">
                                                      <span className="text-sm font-medium">{u?.name} ({a.percentage.toFixed(1)}%)</span>
                                                      <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                                                        <div className="text-right flex-1 sm:flex-none">
                                                            <div className="font-medium">
                                                              {isDebtor ? (
                                                                <>
                                                                  <span className={paidAmount > 0 ? "text-green-600" : ""}>{formatCurrency(paidAmount)}</span>
                                                                  <span className="text-slate-400 text-xs"> / </span>
                                                                  <span>{formatCurrency(a.amount)}</span>
                                                                </>
                                                              ) : (
                                                                formatCurrency(a.amount)
                                                              )}
                                                            </div>
                                                        </div>
                                                        
                                                        {isDebtor && (
                                                            <div className="flex-shrink-0">
                                                                {isFullyPaid ? (
                                                                    <div className="flex flex-col items-end">
                                                                       <span className="text-[10px] px-2 py-1 bg-green-100 text-green-700 rounded-full font-bold">ĐÃ TRẢ</span>
                                                                    </div>
                                                                ) : (
                                                                    canMarkAsPaid && (
                                                                        <button 
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleOpenPaymentConfirm(cost.id, a.userId, u?.name || 'Người dùng', a.amount, a.payments || [], cost.date, 0);
                                                                            }}
                                                                            className="flex items-center gap-1 text-xs px-3 py-1.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
                                                                        >
                                                                            <DollarSign className="w-3 h-3" /> Thu tiền
                                                                        </button>
                                                                    )
                                                                )}
                                                            </div>
                                                        )}
                                                      </div>
                                                  </li>
                                              )
                                          })}
                                      </ul>
                                  </div>
                                  
                                  {/* Approval Status Footer */}
                                  <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-2">
                                      <span>Trạng thái:</span>
                                      <div className="flex -space-x-1">
                                          {cost.approvedBy.map(uid => {
                                              const u = users.find(user => user.id === uid);
                                              return (
                                                  <div key={uid} className="w-4 h-4 rounded-full bg-green-100 border border-white text-green-700 flex items-center justify-center font-bold text-[8px]" title={`Đã duyệt: ${u?.name}`}>
                                                      {u?.avatar}
                                                  </div>
                                              )
                                          })}
                                      </div>
                                      <span>đã duyệt.</span>
                                      {totalUsers - approvalCount > 0 && (
                                          <span className="text-amber-500 font-medium">Chờ {totalUsers - approvalCount} người nữa.</span>
                                      )}
                                  </div>
                              </div>
                          )}
                      </div>
                  )
              })}
           </div>
        </div>

        {/* 4. Charts */}
        <div className="space-y-6 order-1 lg:order-2">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
               <div className="flex items-center gap-2 mb-2">
                 <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                   <TrendingUp className="w-5 h-5" />
                 </div>
                 <h3 className="text-sm font-bold text-slate-500 uppercase">Tổng chi phí dự án</h3>
               </div>
               <div className="mb-6">
                 <div className="text-2xl font-bold text-slate-900">{formatCurrency(totalProjectCost)}</div>
                 <p className="text-xs text-slate-500">Đã bao gồm tất cả các hạng mục được duyệt</p>
               </div>

               <div className="border-t border-slate-100 pt-4">
                  <h3 className="text-sm font-bold text-slate-500 uppercase mb-4 flex items-center gap-2">
                    <PieChart className="w-4 h-4" /> Tổng vốn góp
                  </h3>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={contributionData}>
                            <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                            <YAxis hide />
                            <Tooltip 
                                formatter={(value: number) => [formatCurrency(value), 'Đã góp']} 
                                labelStyle={{ color: '#334155', fontWeight: 600 }}
                            />
                            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                {contributionData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-[10px] text-slate-400 text-center italic mt-2">
                    *Biểu đồ hiển thị giá trị phân bổ trách nhiệm đóng góp (Share) của mỗi người.
                  </p>
               </div>
            </div>
        </div>
      </div>

      {/* --- AI CHATBOT FLOATING WIDGET --- */}
      
      {/* 1. Toggle Button (Bottom Right) */}
      <div className="fixed bottom-6 right-6 z-40 print:hidden">
          <button 
              onClick={() => setIsChatOpen(!isChatOpen)}
              className={`p-4 rounded-full shadow-xl transition-all duration-300 flex items-center justify-center ${isChatOpen ? 'bg-slate-800 text-white rotate-90' : 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:scale-110'}`}
          >
              {isChatOpen ? <X className="w-6 h-6" /> : <Sparkles className="w-6 h-6 animate-pulse" />}
          </button>
      </div>

      {/* 2. Chat Window Overlay */}
      {isChatOpen && (
          <div className="fixed bottom-24 right-6 w-full max-w-[350px] sm:max-w-[400px] h-[500px] max-h-[70vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col z-40 overflow-hidden animate-in slide-in-from-bottom-5 fade-in zoom-in-95 origin-bottom-right">
              {/* Header */}
              <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-4 flex justify-between items-center text-white shrink-0">
                  <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm">
                          <Bot className="w-5 h-5 text-yellow-300" />
                      </div>
                      <div>
                          <h3 className="font-bold text-sm">Trợ lý Tài chính AI</h3>
                          <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                <p className="text-[10px] text-indigo-100 opacity-90">Online</p>
                          </div>
                      </div>
                  </div>
                  <div className="flex gap-2">
                        <button 
                            onClick={() => setChatMessages([{ id: 'init', role: 'model', text: 'Xin chào! Tôi là trợ lý tài chính của TTP Home. \nBạn cần xem **tổng quan công nợ**, **chi phí dự án** hay **tiến độ** không?', timestamp: Date.now() }])} 
                            className="p-1.5 hover:bg-white/20 rounded-lg transition"
                            title="Làm mới đoạn chat"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => setIsChatOpen(false)}
                            className="p-1.5 hover:bg-white/20 rounded-lg transition"
                        >
                            <Minimize2 className="w-4 h-4" />
                        </button>
                  </div>
              </div>

              {/* Chat Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                  {chatMessages.map((msg) => (
                      <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold shadow-sm ${msg.role === 'user' ? 'bg-indigo-600' : 'bg-violet-600'}`}>
                              {msg.role === 'user' ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                          </div>
                          <div className={`max-w-[85%] rounded-2xl p-3 shadow-sm ${msg.role === 'user' ? 'bg-white text-slate-800 rounded-tr-none' : 'bg-white text-slate-800 rounded-tl-none border border-slate-100'}`}>
                              <RenderMessageText text={msg.text} />
                              <div className="text-[9px] text-slate-400 mt-1 text-right">
                                  {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                              </div>
                          </div>
                      </div>
                  ))}
                  {isTyping && (
                      <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center flex-shrink-0 text-white shadow-sm">
                              <Bot className="w-4 h-4" />
                          </div>
                          <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-none border border-slate-100 shadow-sm flex items-center gap-1">
                              <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                              <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-75"></div>
                              <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-150"></div>
                          </div>
                      </div>
                  )}
                  <div ref={chatEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-3 bg-white border-t border-slate-100 shrink-0">
                  <form onSubmit={handleSendMessage} className="relative flex items-center gap-2">
                      <input 
                          type="text" 
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          placeholder="Hỏi về tiền nong..." 
                          className="w-full bg-slate-50 border border-slate-200 rounded-full pl-4 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all placeholder:text-slate-400"
                          disabled={isTyping}
                      />
                      <button 
                          type="submit" 
                          disabled={!chatInput.trim() || isTyping}
                          className="absolute right-1.5 p-1.5 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors shadow-sm"
                      >
                          <Send className="w-4 h-4" />
                      </button>
                  </form>
              </div>
          </div>
      )}


      {/* Payment Confirmation Modal */}
      {confirmPayment && (
         <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
               <h3 className="text-lg font-bold text-slate-900 mb-2">Ghi nhận thanh toán</h3>
               <p className="text-slate-600 mb-4 text-sm">
                 Nhận tiền từ <span className="font-bold">{confirmPayment.debtorName}</span>?
               </p>

               {/* Calculation Details */}
               <div className="bg-slate-50 rounded-xl p-4 mb-4 space-y-4 text-sm border border-slate-100">
                  <div className="flex justify-between text-slate-500">
                      <span>Dư nợ hiện tại:</span>
                      <span className="font-medium text-slate-800">{formatCurrency(paymentDetails.remainingBeforePay)}</span>
                  </div>
                  
                  {/* PRINCIPAL INPUT */}
                  <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-indigo-100 shadow-sm">
                     <span className="font-medium text-slate-700">Số tiền trả:</span>
                     <div className="flex items-center gap-1">
                         <input 
                            type="text"
                            inputMode="numeric"
                            value={paymentAmountInput}
                            onChange={handlePaymentAmountChange}
                            className="w-28 text-right border-none focus:ring-0 outline-none font-bold text-indigo-700 bg-transparent text-lg"
                            placeholder="0"
                         />
                         <span className="text-xs text-slate-400">₫</span>
                     </div>
                  </div>

                  <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-slate-900">
                      <span>Dư nợ sau thanh toán:</span>
                      <span className={paymentDetails.remainingAfterPay > 0 ? "text-amber-600" : "text-green-600"}>
                          {formatCurrency(paymentDetails.remainingAfterPay)}
                      </span>
                  </div>
               </div>

               <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ngày nhận tiền</label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-3 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 bg-white"
                  />
               </div>
               
               <div className="flex justify-end gap-3">
                  <button
                    onClick={() => {
                        setConfirmPayment(null);
                        setPaymentAmountInput('');
                    }}
                    className="px-4 py-3 text-slate-600 hover:bg-slate-100 rounded-xl font-medium text-sm transition-colors"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={() => {
                       const amount = parseFormattedNumber(paymentAmountInput);
                       if(amount > 0) {
                           onMarkAsPaid(confirmPayment.costId, confirmPayment.debtorId, amount, 0, paymentDate);
                           setConfirmPayment(null);
                           setPaymentAmountInput('');
                       }
                    }}
                    className="px-6 py-3 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl font-bold text-sm shadow-md transition-colors"
                  >
                    Xác nhận
                  </button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
};
