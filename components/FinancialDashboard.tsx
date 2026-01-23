
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Cost, User, Role, DebtRecord, Stage } from '../types';
import { formatCurrency, calculateLoanStatus, formatDate } from '../utils/finance';
import { AlertCircle, Check, Clock, Plus, Wallet, ChevronDown, ChevronUp, Percent, DollarSign, PieChart, TrendingUp, Sparkles, Bell, ThumbsUp, AlertTriangle, X, Send, Bot, User as UserIcon, RefreshCw, MessageSquareText, Minimize2, Paperclip, FileText, Image as ImageIcon, ArrowUpRight, ArrowDownLeft, MoreHorizontal, Delete, Calendar, Calculator, CheckCircle2, Share2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface FinancialDashboardProps {
  costs: Cost[];
  debts: DebtRecord[];
  users: User[];
  currentUser: User;
  stages: Stage[];
  defaultInterestRate: number;
  onUpdateDefaultSettings: (rate: number) => void;
  onAddCost: (cost: Omit<Cost, 'id' | 'createdAt' | 'approvedBy' | 'status'>, files: File[]) => void;
  onApproveCost: (costId: string) => void;
  onMarkAsPaid: (costId: string, debtorId: string, amount: number, interest: number, paidDate: string) => void;
  onDismissPaymentCall: (stageId: string) => void;
  onUploadAttachments: (costId: string, files: File[]) => void;
  externalShowAddForm?: boolean;
  setExternalShowAddForm?: (show: boolean) => void;
}

export const FinancialDashboard: React.FC<FinancialDashboardProps> = ({ 
  costs, debts, users, currentUser, stages, defaultInterestRate, onUpdateDefaultSettings, onAddCost, onApproveCost, onMarkAsPaid, onDismissPaymentCall, onUploadAttachments,
  externalShowAddForm, setExternalShowAddForm
}) => {
  const [localShowAddForm, setLocalShowAddForm] = useState(false);
  const showAddForm = externalShowAddForm !== undefined ? externalShowAddForm : localShowAddForm;
  const setShowAddForm = setExternalShowAddForm || setLocalShowAddForm;

  const [expandedCost, setExpandedCost] = useState<string | null>(null);

  // Payment Confirmation State
  const [confirmPayment, setConfirmPayment] = useState<{
      costId: string;
      debtorId: string;
      debtorName: string;
      initialPrincipal: number; 
      paymentsHistory: any[]; 
      transactionDate: string;
      interestRate: number;
  } | null>(null);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentAmountInput, setPaymentAmountInput] = useState('');

  // --- Payment Call Alerts ---
  const paymentCallStages = useMemo(() => {
    return stages.filter(s => s.paymentCallAmount && s.paymentCallAmount > 0);
  }, [stages]);

  // --- Smart Alerts State ---
  const alerts = useMemo(() => {
    const list = [];
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

  // Derived state for Modal Interest Calculation
  const paymentDetails = useMemo(() => {
    if (!confirmPayment) return { principal: 0, interest: 0, total: 0, days: 0, remainingAfterPay: 0 };
    const amountToPay = parseInt(paymentAmountInput || '0', 10);
    const status = calculateLoanStatus(
        confirmPayment.initialPrincipal,
        confirmPayment.transactionDate,
        0, 
        confirmPayment.paymentsHistory,
        paymentDate
    );
    const remainingBeforePay = Math.round(status.remainingPrincipal);
    const remainingAfterPay = Math.max(0, remainingBeforePay - amountToPay);

    return {
        principal: amountToPay,
        remainingBeforePay: remainingBeforePay,
        totalPayment: amountToPay,
        remainingAfterPay,
        days: status.daysSinceLastEvent
    };
  }, [confirmPayment, paymentDate, paymentAmountInput]);

  // Form State
  const [description, setDescription] = useState('');
  const [amountStr, setAmountStr] = useState('0'); // Use String for Numpad logic
  const [stageId, setStageId] = useState('');
  const [payerId, setPayerId] = useState(currentUser.id);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [allocType, setAllocType] = useState<'EQUAL' | 'CUSTOM'>('EQUAL');
  const [customAmounts, setCustomAmounts] = useState<{[key:string]: string}>({}); 
  
  // File Upload State
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Focus state for Numpad vs Text Input
  const [activeInput, setActiveInput] = useState<'AMOUNT' | 'DESCRIPTION'>('AMOUNT');

  useEffect(() => {
    if (!stageId && stages.length > 0) {
        // Default to the first "IN_PROGRESS" stage, or the last added stage
        const activeStage = stages.find(s => s.status === 'Đang thực hiện') || stages[stages.length - 1];
        if (activeStage) setStageId(activeStage.id);
    }
  }, [stages, stageId, showAddForm]);

  // Reset form when opening
  useEffect(() => {
    if (showAddForm) {
        setAmountStr('0');
        setDescription('');
        setDate(new Date().toISOString().split('T')[0]);
        setPayerId(currentUser.id);
        setSelectedFiles([]);
        setAllocType('EQUAL');
        setActiveInput('AMOUNT');
    }
  }, [showAddForm, currentUser.id]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
        const newFiles = Array.from(e.target.files);
        setSelectedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // --- Numpad Logic ---
  const handleNumClick = (val: string) => {
      if (activeInput !== 'AMOUNT') return;

      if (val === 'DEL') {
          setAmountStr(prev => prev.length > 1 ? prev.slice(0, -1) : '0');
      } else if (val === 'AC') {
          setAmountStr('0');
      } else if (val === '000') {
          setAmountStr(prev => prev === '0' ? '0' : prev + '000');
      } else {
          setAmountStr(prev => prev === '0' ? val : prev + val);
      }
  };

  const handleQuickDate = (type: 'TODAY' | 'YESTERDAY') => {
      const d = new Date();
      if (type === 'YESTERDAY') d.setDate(d.getDate() - 1);
      setDate(d.toISOString().split('T')[0]);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const numAmount = parseInt(amountStr.replace(/\D/g, '') || '0', 10);
    
    if (!description || numAmount === 0 || !stageId) {
        if (numAmount === 0) alert("Vui lòng nhập số tiền!");
        else if (!description) alert("Vui lòng nhập nội dung!");
        return;
    }

    let allocations = [];
    if (allocType === 'EQUAL') {
       const totalUsers = users.length;
       const baseShare = Math.floor(numAmount / totalUsers);
       const remainder = numAmount - (baseShare * totalUsers);

       allocations = users.map(u => {
           let myShare = baseShare;
           if (u.id === payerId) myShare += remainder;
           return { 
               userId: u.id, 
               amount: myShare, 
               percentage: (myShare / numAmount) * 100, 
               paidAmount: 0, 
               payments: [], 
               isPaid: false 
           };
       });
    } else {
       allocations = users.map(u => {
         const val = parseInt(customAmounts[u.id] || '0', 10);
         return { userId: u.id, amount: val, percentage: (val/numAmount)*100, paidAmount: 0, payments: [], isPaid: false };
       });
    }

    onAddCost({
      stageId,
      description,
      amount: numAmount,
      payerId,
      date,
      interestRate: 0,
      isCustomAllocation: allocType === 'CUSTOM',
      allocations
    }, selectedFiles);
    
    setShowAddForm(false);
  };

  const handleOpenPaymentConfirm = (costId: string, debtorId: string, debtorName: string, initialPrincipal: number, paymentsHistory: any[], transactionDate: string, interestRate: number) => {
      setPaymentDate(new Date().toISOString().split('T')[0]); 
      const status = calculateLoanStatus(initialPrincipal, transactionDate, 0, paymentsHistory);
      setConfirmPayment({ costId, debtorId, debtorName, initialPrincipal, paymentsHistory, transactionDate, interestRate: 0 });
      setPaymentAmountInput(Math.round(status.remainingPrincipal).toString());
  };

  const handleShareZalo = async (e: React.MouseEvent, cost: Cost) => {
    e.stopPropagation();
    const payerName = users.find(u => u.id === cost.payerId)?.name || 'Ai đó';
    const message = `💸 [HTTP Home] Chi phí mới\n━━━━━━━━━━━━━━━━\n📝 Nội dung: ${cost.description}\n💰 Số tiền: ${formatCurrency(cost.amount)}\n👤 Người chi: ${payerName}\n📅 Ngày: ${formatDate(cost.date)}`;

    if (navigator.share) {
        // Mobile Native Share
        try {
            await navigator.share({
                title: 'Chi phí HTTP Home',
                text: message,
            });
        } catch (err) {
            // User cancelled share
        }
    } else {
        // Desktop Fallback: Copy to clipboard & Open Zalo Web
        try {
            await navigator.clipboard.writeText(message);
            if(window.confirm("Đã sao chép nội dung! Bạn có muốn mở Zalo Web để dán vào nhóm không?")) {
                window.open("https://chat.zalo.me", "_blank");
            }
        } catch (err) {
            alert("Không thể sao chép. Vui lòng thử lại.");
        }
    }
  };

  const totalProjectCost = useMemo(() => {
    return costs.filter(c => c.status === 'APPROVED').reduce((sum, c) => sum + c.amount, 0);
  }, [costs]);

  const myNetPosition = useMemo(() => {
      const myDebts = debts.filter(d => d.debtorId === currentUser.id);
      const totalOwed = myDebts.reduce((acc, d) => acc + d.totalDebt, 0);
      const othersDebtsToMe = debts.filter(d => d.creditorId === currentUser.id);
      const totalReceivable = othersDebtsToMe.reduce((acc, d) => acc + d.totalDebt, 0);
      return { totalOwed, totalReceivable, net: totalReceivable - totalOwed };
  }, [debts, currentUser.id]);

  // Helper for rendering Stage Pills
  const renderStagePill = (s: Stage) => (
      <button 
        key={s.id} 
        type="button" 
        onClick={() => setStageId(s.id)} 
        className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${stageId === s.id ? 'bg-slate-800 text-white border-slate-800 shadow-md' : 'bg-white text-slate-500 border-slate-200'}`}
      >
          {s.name}
      </button>
  );

  return (
    <div className="space-y-6 relative pb-20 md:pb-0">
      
      {/* 0. NOTIFICATIONS */}
      <div className="space-y-3">
          {paymentCallStages.map(stage => (
              <div key={stage.id} className="p-4 rounded-2xl bg-gradient-to-r from-primary-600 to-primary-500 shadow-lg text-white relative animate-in slide-in-from-top-2">
                  <div className="flex items-start gap-4">
                      <div className="p-2 bg-white/20 rounded-full backdrop-blur-md">
                          <Bell className="w-5 h-5 animate-pulse" />
                      </div>
                      <div className="flex-1">
                          <h3 className="font-bold text-base flex items-center gap-2 mb-1">Chuẩn bị tài chính</h3>
                          <div className="text-primary-50 text-sm leading-relaxed">
                              Đóng <span className="font-bold text-white text-lg font-mono px-1">{formatCurrency(stage.paymentCallAmount || 0)}</span> cho giai đoạn <span className="font-bold uppercase">{stage.name}</span>.
                          </div>
                      </div>
                      {currentUser.role === Role.ADMIN && (
                          <button onClick={() => onDismissPaymentCall(stage.id)} className="text-primary-200 hover:text-white p-1">
                              <X className="w-4 h-4" />
                          </button>
                      )}
                  </div>
              </div>
          ))}

          {alerts.map((alert, idx) => (
              <div key={idx} className="p-4 rounded-2xl border bg-amber-50 border-amber-100 text-amber-900 flex items-start gap-3 shadow-sm">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600" />
                  <div>
                      <h4 className="font-bold text-sm text-amber-800">{alert.title}</h4>
                      <p className="text-xs mt-1 text-amber-700">{alert.message}</p>
                  </div>
              </div>
          ))}
      </div>

      {/* 1. HERO SECTION & WALLET */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between h-48 md:h-56 relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-10 bg-slate-50 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>
               <div>
                   <p className="text-slate-500 font-medium text-sm flex items-center gap-2 mb-2">
                       <TrendingUp className="w-4 h-4" /> Tổng chi dự án
                   </p>
                   <h2 className="text-3xl md:text-4xl font-extrabold text-slate-800 font-mono tracking-tight">
                       {formatCurrency(totalProjectCost)}
                   </h2>
               </div>
               <div className="relative z-10">
                   <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                       <div className="h-full bg-slate-800 w-3/4 rounded-full"></div> 
                   </div>
                   <p className="text-xs text-slate-400 mt-2 text-right font-medium">Cập nhật: Vừa xong</p>
               </div>
          </div>

          <div className={`p-6 rounded-3xl border shadow-sm flex flex-col justify-between h-48 md:h-56 relative overflow-hidden transition-all ${myNetPosition.net >= 0 ? 'bg-white border-slate-200' : 'bg-white border-red-100'}`}>
              <div>
                   <p className="text-slate-500 font-medium text-sm flex items-center gap-2 mb-3">
                       <Wallet className="w-4 h-4" /> Ví của tôi
                   </p>
                   
                   <div className="flex items-baseline gap-2">
                       <h2 className={`text-3xl md:text-4xl font-extrabold font-mono tracking-tight ${myNetPosition.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                           {myNetPosition.net > 0 ? '+' : ''}{formatCurrency(myNetPosition.net)}
                       </h2>
                   </div>
                   <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mt-1">
                       {myNetPosition.net >= 0 ? 'Đang dương' : 'Đang âm'}
                   </p>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-100">
                  <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Phải thu</span>
                      <span className="text-sm font-bold text-emerald-600 font-mono block">+{formatCurrency(myNetPosition.totalReceivable)}</span>
                  </div>
                  <div className="text-right">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Phải trả</span>
                      <span className="text-sm font-bold text-rose-600 font-mono block">-{formatCurrency(myNetPosition.totalOwed)}</span>
                  </div>
              </div>
          </div>
          
          <div className="hidden lg:flex bg-slate-850 p-6 rounded-3xl text-white flex-col justify-between h-56 shadow-lg shadow-slate-200">
              <div>
                  <h3 className="font-bold text-lg mb-1">Tỷ lệ đóng góp</h3>
                  <p className="text-slate-400 text-xs">Phân bổ trách nhiệm tài chính</p>
              </div>
              <div className="flex-1 flex items-end gap-2 pb-2">
                  {users.map((u, i) => {
                       const totalShare = costs.filter(c => c.status === 'APPROVED').reduce((acc, c) => {
                            const userAlloc = c.allocations.find(a => a.userId === u.id);
                            return acc + (userAlloc ? userAlloc.amount : 0);
                       }, 0);
                       const pct = totalProjectCost > 0 ? (totalShare / totalProjectCost) * 100 : 0;
                       
                       return (
                           <div key={u.id} className="flex-1 flex flex-col justify-end gap-1 group cursor-pointer">
                               <div className="text-[10px] text-center font-bold text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">{pct.toFixed(0)}%</div>
                               <div 
                                style={{ height: `${Math.max(10, pct)}%` }} 
                                className={`w-full rounded-t-lg transition-all ${i===0?'bg-primary-500':i===1?'bg-accent-500':'bg-blue-500'} opacity-80 group-hover:opacity-100`}
                               ></div>
                               <div className="text-[10px] text-center font-bold text-slate-300 truncate">{u.name}</div>
                           </div>
                       )
                  })}
              </div>
          </div>
      </div>

      {/* 2. TRANSACTIONS LIST */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
           <div className="p-6 border-b border-slate-50 flex justify-between items-center">
               <h3 className="font-bold text-lg text-slate-800">Giao dịch gần đây</h3>
               <button className="text-primary-600 text-sm font-bold hover:underline">Xem tất cả</button>
           </div>
           
           <div className="divide-y divide-slate-50">
               {costs.length === 0 && <div className="p-12 text-center text-slate-400 text-sm">Chưa có giao dịch nào.</div>}
               {costs.map(cost => {
                  const isApproved = cost.status === 'APPROVED';
                  const stageName = stages.find(s => s.id === cost.stageId)?.name;
                  const payer = users.find(u => u.id === cost.payerId);

                  return (
                      <div key={cost.id} onClick={() => setExpandedCost(expandedCost === cost.id ? null : cost.id)} className={`p-5 hover:bg-slate-50 transition-colors cursor-pointer group ${!isApproved ? 'bg-amber-50/30' : ''}`}>
                          <div className="flex items-start gap-4">
                              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 font-bold text-sm shadow-sm mt-0.5 ${isApproved ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-600'}`}>
                                  {payer?.avatar}
                              </div>
                              <div className="flex-1 min-w-0">
                                  <div className="flex flex-wrap items-start gap-x-2 gap-y-1 mb-1">
                                      <h4 className="font-bold text-slate-800 text-sm sm:text-base leading-snug break-words">{cost.description}</h4>
                                      {!isApproved && <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded uppercase tracking-wide whitespace-nowrap mt-0.5">Chờ duyệt</span>}
                                  </div>
                                  <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
                                      <span>{formatDate(cost.date)}</span>
                                      <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                      <span className="truncate max-w-[120px]">{stageName}</span>
                                      {cost.attachments && cost.attachments.length > 0 && <Paperclip className="w-3 h-3 text-slate-400" />}
                                  </div>
                              </div>
                              <div className="text-right">
                                  <div className="font-bold text-slate-900 font-mono text-base">{formatCurrency(cost.amount)}</div>
                                  <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                                      {isApproved ? 'Đã duyệt' : 'Đang chờ'}
                                  </div>
                              </div>
                              <ChevronDown className={`w-5 h-5 text-slate-300 group-hover:text-slate-500 transition-transform mt-1 ${expandedCost === cost.id ? 'rotate-180' : ''}`} />
                          </div>
                          {expandedCost === cost.id && (
                              <div className="mt-4 pt-4 border-t border-slate-100 pl-0 sm:pl-16 animate-in slide-in-from-top-2">
                                  <div className="flex gap-2 mb-4 overflow-x-auto pb-2 no-scrollbar">
                                      {!cost.approvedBy.includes(currentUser.id) && cost.status === 'PENDING' && (
                                          <button 
                                            onClick={(e) => { e.stopPropagation(); onApproveCost(cost.id); }}
                                            className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white text-sm font-bold rounded-xl shadow-md hover:bg-amber-600 transition-colors whitespace-nowrap"
                                          >
                                              <ThumbsUp className="w-4 h-4" /> Duyệt chi
                                          </button>
                                      )}
                                      
                                      {/* Share to Zalo Button */}
                                      <button 
                                        onClick={(e) => handleShareZalo(e, cost)}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 text-sm font-bold rounded-xl hover:bg-blue-100 transition-colors whitespace-nowrap"
                                      >
                                          <Share2 className="w-4 h-4" /> Chia sẻ Zalo
                                      </button>

                                      {(currentUser.id === cost.payerId || currentUser.role === Role.ADMIN) && (
                                        <label className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 text-sm font-bold rounded-xl hover:bg-slate-200 cursor-pointer transition-colors whitespace-nowrap">
                                            <input type="file" multiple className="hidden" onChange={(e) => {
                                                if(e.target.files?.length) onUploadAttachments(cost.id, Array.from(e.target.files));
                                            }} />
                                            <Plus className="w-4 h-4" /> Thêm ảnh
                                        </label>
                                      )}
                                  </div>
                                  
                                  {/* Attachments */}
                                  {cost.attachments && cost.attachments.length > 0 && (
                                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 mb-4">
                                          {cost.attachments.map(att => (
                                              <a key={att.id} href={att.url} target="_blank" rel="noreferrer" className="block aspect-square rounded-lg bg-slate-100 border border-slate-200 overflow-hidden relative hover:opacity-80 transition-opacity">
                                                  {att.type.startsWith('image/') ? (
                                                      <img src={att.url} alt={att.name} className="w-full h-full object-cover" />
                                                  ) : (
                                                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                                                          <FileText className="w-6 h-6" />
                                                      </div>
                                                  )}
                                              </a>
                                          ))}
                                      </div>
                                  )}

                                  {/* --- NEW: ALLOCATION LIST --- */}
                                  <div className="mt-4 pt-4 border-t border-slate-100">
                                      <div className="flex items-center gap-2 mb-3">
                                          <PieChart className="w-4 h-4 text-slate-400" />
                                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Chi tiết phân bổ</span>
                                      </div>
                                      <div className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
                                          {cost.allocations.map(alloc => {
                                              const allocUser = users.find(u => u.id === alloc.userId);
                                              const isPayer = alloc.userId === cost.payerId;
                                              const isMe = currentUser.id === alloc.userId;
                                              const paid = alloc.paidAmount || 0;
                                              const total = alloc.amount;
                                              // Allow collection if: Current User is Payer (or Admin), Target is NOT Payer, and NOT fully paid
                                              const canCollect = (currentUser.id === cost.payerId || currentUser.role === Role.ADMIN) && !isPayer && !alloc.isPaid;

                                              return (
                                                  <div key={alloc.userId} className="p-3 border-b border-slate-100 last:border-0 flex items-center justify-between hover:bg-white transition-colors">
                                                      <div className="flex items-center gap-3">
                                                          <div className="relative">
                                                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isPayer ? 'bg-amber-100 text-amber-700' : 'bg-white border border-slate-200 text-slate-600'}`}>
                                                                  {allocUser?.avatar}
                                                              </div>
                                                              {isPayer && <div className="absolute -bottom-1 -right-1 bg-amber-500 text-white text-[8px] px-1 rounded-full font-bold">Chi</div>}
                                                          </div>
                                                          <div>
                                                              <div className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                                                  {allocUser?.name}
                                                                  {isMe && <span className="text-[10px] text-slate-400 font-normal">(Bạn)</span>}
                                                              </div>
                                                              <div className="text-[10px] text-slate-500">
                                                                {alloc.percentage < 100 ? `${alloc.percentage.toFixed(0)}% trách nhiệm` : '100% trách nhiệm'}
                                                              </div>
                                                          </div>
                                                      </div>

                                                      <div className="text-right">
                                                          <div className="text-sm font-bold text-slate-800">{formatCurrency(total)}</div>
                                                          <div className="flex items-center justify-end gap-2 mt-0.5">
                                                              {isPayer ? (
                                                                  <span className="text-[10px] font-bold text-amber-600">Người ứng tiền</span>
                                                              ) : alloc.isPaid ? (
                                                                  <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                                                                      <CheckCircle2 className="w-3 h-3" /> Đã trả xong
                                                                  </span>
                                                              ) : (
                                                                  <div className="flex items-center gap-2">
                                                                      {paid > 0 && <span className="text-[10px] text-slate-400">Đã trả {formatCurrency(paid)}</span>}
                                                                      <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded">Còn nợ</span>
                                                                      {canCollect && (
                                                                          <button 
                                                                              onClick={(e) => {
                                                                                  e.stopPropagation();
                                                                                  handleOpenPaymentConfirm(cost.id, alloc.userId, allocUser?.name || '', alloc.amount, alloc.payments || [], cost.date, cost.interestRate);
                                                                              }}
                                                                              className="flex items-center gap-1 px-2 py-1 bg-primary-600 text-white text-[10px] font-bold rounded shadow-sm hover:bg-primary-700 active:scale-95 transition-all"
                                                                          >
                                                                              <DollarSign className="w-3 h-3" /> Thu
                                                                          </button>
                                                                      )}
                                                                  </div>
                                                              )}
                                                          </div>
                                                      </div>
                                                  </div>
                                              );
                                          })}
                                      </div>
                                  </div>
                              </div>
                          )}
                      </div>
                  )
               })}
           </div>
      </div>

      {/* 3. NEW ADD COST MODAL (CUSTOM NUMPAD) */}
      {(showAddForm) && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="absolute inset-0" onClick={() => setShowAddForm(false)}></div>
              
              <div className="bg-white w-full md:max-w-md h-[95vh] md:h-auto md:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden relative slide-up flex flex-col">
                  {/* Handle Bar */}
                  <div className="w-full flex justify-center pt-3 pb-2" onClick={() => setShowAddForm(false)}>
                      <div className="w-12 h-1.5 bg-slate-200 rounded-full"></div>
                  </div>

                  <div className="flex-1 flex flex-col overflow-hidden">
                      {/* --- TOP SECTION: DISPLAY & INPUTS --- */}
                      <div className="px-6 flex-shrink-0">
                          {/* Amount Display */}
                          <div className="flex flex-col items-center justify-center py-4 cursor-pointer" onClick={() => setActiveInput('AMOUNT')}>
                              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Số tiền</span>
                              <div className={`text-5xl font-mono font-bold tracking-tight transition-colors ${activeInput === 'AMOUNT' ? 'text-primary-600' : 'text-slate-800'}`}>
                                  {formatCurrency(parseInt(amountStr)).replace('₫', '')}
                              </div>
                              <span className="text-sm font-bold text-slate-400 mt-1">VNĐ</span>
                          </div>

                          {/* Description Input */}
                          <div className="mb-4">
                              <div className={`flex items-center gap-3 bg-slate-50 border rounded-2xl px-4 py-3 transition-all ${activeInput === 'DESCRIPTION' ? 'border-primary-500 ring-1 ring-primary-500 bg-white' : 'border-slate-200'}`}>
                                  <FileText className={`w-5 h-5 ${activeInput === 'DESCRIPTION' ? 'text-primary-500' : 'text-slate-400'}`} />
                                  <input 
                                    type="text" 
                                    value={description} 
                                    onChange={e => setDescription(e.target.value)}
                                    onFocus={() => setActiveInput('DESCRIPTION')}
                                    className="flex-1 bg-transparent border-none outline-none text-slate-800 font-medium placeholder-slate-400 text-base"
                                    placeholder="Chi cho việc gì?" 
                                  />
                              </div>
                          </div>
                      </div>

                      {/* --- MIDDLE SECTION: SCROLLABLE SELECTORS --- */}
                      <div className="flex-1 overflow-y-auto px-6 space-y-5 pb-4">
                          {/* 1. Stage Selector (Horizontal) */}
                          <div>
                              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Giai đoạn</label>
                              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-2 px-2">
                                  {stages.map(renderStagePill)}
                              </div>
                          </div>

                          {/* 2. Date Selector */}
                          <div>
                               <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Ngày chi</label>
                               <div className="flex items-center gap-2">
                                   <button type="button" onClick={() => handleQuickDate('TODAY')} className="px-3 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200">Hôm nay</button>
                                   <button type="button" onClick={() => handleQuickDate('YESTERDAY')} className="px-3 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200">Hôm qua</button>
                                   <div className="w-[1px] h-6 bg-slate-200 mx-1"></div>
                                   <div className="flex-1 relative">
                                        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-2 text-xs font-bold outline-none text-slate-700" />
                                        <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                   </div>
                               </div>
                          </div>

                          {/* 3. Payer & Allocation */}
                          <div>
                               <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Người trả tiền</label>
                               <div className="flex gap-3 overflow-x-auto no-scrollbar">
                                   {users.map(u => (
                                       <button 
                                          key={u.id} 
                                          type="button" 
                                          onClick={() => setPayerId(u.id)}
                                          className={`flex flex-col items-center gap-1 min-w-[60px] p-2 rounded-xl border transition-all ${payerId === u.id ? 'bg-primary-50 border-primary-500' : 'bg-white border-slate-100'}`}
                                       >
                                           <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ${payerId === u.id ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                               {u.avatar}
                                           </div>
                                           <span className={`text-[10px] font-bold ${payerId === u.id ? 'text-primary-700' : 'text-slate-400'}`}>{u.name}</span>
                                       </button>
                                   ))}
                               </div>
                          </div>
                          
                          {/* File Attachment */}
                          <div>
                              <div className="flex flex-wrap gap-2 mb-2">
                                  {selectedFiles.map((f, i) => (
                                      <div key={i} className="bg-blue-50 text-blue-700 px-2 py-1 rounded-md text-xs border border-blue-100 flex items-center gap-1">
                                          <span className="truncate max-w-[100px]">{f.name}</span>
                                          <button type="button" onClick={() => removeFile(i)}><X className="w-3 h-3" /></button>
                                      </div>
                                  ))}
                              </div>
                              <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 text-xs font-bold text-primary-600 bg-primary-50 px-3 py-2 rounded-lg hover:bg-primary-100 transition-colors">
                                  <Paperclip className="w-4 h-4" /> Đính kèm ảnh hóa đơn
                              </button>
                              <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileChange} />
                          </div>
                      </div>

                      {/* --- BOTTOM SECTION: NUMPAD --- */}
                      {/* Only show Numpad if Amount is focused (default) */}
                      {activeInput === 'AMOUNT' && (
                          <div className="bg-slate-50 border-t border-slate-200 p-2 pb-safe-bottom">
                              <div className="grid grid-cols-4 gap-2 h-64 md:h-72">
                                  {/* Numbers */}
                                  <button type="button" onClick={() => handleNumClick('1')} className="bg-white rounded-xl shadow-sm text-2xl font-bold text-slate-700 active:bg-slate-200">1</button>
                                  <button type="button" onClick={() => handleNumClick('2')} className="bg-white rounded-xl shadow-sm text-2xl font-bold text-slate-700 active:bg-slate-200">2</button>
                                  <button type="button" onClick={() => handleNumClick('3')} className="bg-white rounded-xl shadow-sm text-2xl font-bold text-slate-700 active:bg-slate-200">3</button>
                                  <button type="button" onClick={() => handleNumClick('DEL')} className="bg-slate-200 rounded-xl shadow-sm text-slate-600 flex items-center justify-center active:bg-slate-300"><Delete className="w-6 h-6" /></button>
                                  
                                  <button type="button" onClick={() => handleNumClick('4')} className="bg-white rounded-xl shadow-sm text-2xl font-bold text-slate-700 active:bg-slate-200">4</button>
                                  <button type="button" onClick={() => handleNumClick('5')} className="bg-white rounded-xl shadow-sm text-2xl font-bold text-slate-700 active:bg-slate-200">5</button>
                                  <button type="button" onClick={() => handleNumClick('6')} className="bg-white rounded-xl shadow-sm text-2xl font-bold text-slate-700 active:bg-slate-200">6</button>
                                  <button type="button" onClick={() => handleNumClick('AC')} className="bg-slate-200 rounded-xl shadow-sm text-sm font-bold text-slate-500 active:bg-slate-300">XÓA</button>

                                  <button type="button" onClick={() => handleNumClick('7')} className="bg-white rounded-xl shadow-sm text-2xl font-bold text-slate-700 active:bg-slate-200">7</button>
                                  <button type="button" onClick={() => handleNumClick('8')} className="bg-white rounded-xl shadow-sm text-2xl font-bold text-slate-700 active:bg-slate-200">8</button>
                                  <button type="button" onClick={() => handleNumClick('9')} className="bg-white rounded-xl shadow-sm text-2xl font-bold text-slate-700 active:bg-slate-200">9</button>
                                  
                                  {/* Submit Button Span 2 Rows */}
                                  <button type="button" onClick={() => handleSubmit()} className="row-span-2 bg-primary-600 rounded-xl shadow-lg shadow-primary-200 text-white font-bold text-xl flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform">
                                      <Check className="w-8 h-8" />
                                      <span className="text-xs">LƯU</span>
                                  </button>

                                  <button type="button" onClick={() => handleNumClick('000')} className="bg-white rounded-xl shadow-sm text-lg font-bold text-slate-600 active:bg-slate-200">000</button>
                                  <button type="button" onClick={() => handleNumClick('0')} className="col-span-2 bg-white rounded-xl shadow-sm text-2xl font-bold text-slate-700 active:bg-slate-200">0</button>
                              </div>
                          </div>
                      )}
                      
                      {/* Fallback Submit Button if Numpad hidden (e.g., Typing description) */}
                      {activeInput !== 'AMOUNT' && (
                          <div className="p-4 border-t border-slate-100 bg-white pb-safe-bottom">
                              <button type="button" onClick={() => handleSubmit()} className="w-full py-3 bg-primary-600 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2">
                                  <Check className="w-5 h-5" /> Lưu Chi Phí
                              </button>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* NÚT THÊM CHI PHÍ (FLOATING) - CHỈ ADMIN & TRANG HOME */}
      {currentUser.role === Role.ADMIN && (
          <div className="fixed bottom-28 md:bottom-6 right-4 md:right-6 z-40 print:hidden">
              <button 
                  onClick={() => setShowAddForm(true)}
                  className="p-3.5 rounded-full shadow-2xl transition-all duration-300 flex items-center justify-center border-4 border-white bg-gradient-to-r from-accent-500 to-orange-600 text-white hover:scale-110 active:scale-90"
              >
                  <Plus className="w-6 h-6" strokeWidth={3} />
              </button>
          </div>
      )}

      {/* Confirmation Modal */}
      {confirmPayment && (
         <div className="fixed inset-0 bg-slate-900/80 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95">
               <h3 className="text-xl font-bold text-slate-900 text-center mb-1">Xác nhận thu tiền</h3>
               <p className="text-slate-500 text-center text-sm mb-6">Từ <span className="font-bold text-slate-800">{confirmPayment.debtorName}</span></p>
               <div className="bg-slate-50 rounded-2xl p-4 mb-4 border border-slate-100">
                  <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-slate-400 uppercase">Còn nợ</span>
                      <span className="text-sm font-bold text-slate-700">{formatCurrency(paymentDetails.remainingBeforePay)}</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white border border-primary-200 rounded-xl px-3 py-2 shadow-sm">
                      <DollarSign className="w-5 h-5 text-primary-600" />
                      <input type="number" value={paymentAmountInput} onChange={e => setPaymentAmountInput(e.target.value)} className="flex-1 font-mono text-xl font-bold text-primary-700 outline-none" autoFocus />
                  </div>
                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-200">
                      <span className="text-xs font-bold text-slate-400 uppercase">Sau khi trả</span>
                      <span className={`text-sm font-bold ${paymentDetails.remainingAfterPay === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {formatCurrency(paymentDetails.remainingAfterPay)}
                      </span>
                  </div>
               </div>
               <div className="grid grid-cols-2 gap-3">
                   <button onClick={() => setConfirmPayment(null)} className="py-3 text-slate-600 font-bold hover:bg-slate-50 rounded-xl transition">Hủy</button>
                   <button onClick={() => {
                       const amount = parseInt(paymentAmountInput || '0', 10);
                       if(amount > 0) {
                           onMarkAsPaid(confirmPayment.costId, confirmPayment.debtorId, amount, 0, paymentDate);
                           setConfirmPayment(null);
                       }
                   }} className="py-3 bg-primary-600 text-white font-bold rounded-xl shadow-lg shadow-primary-200 hover:bg-primary-700 transition">Xác nhận</button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
};
