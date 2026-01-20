
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Cost, User, Role, DebtRecord, Stage } from '../types';
import { formatCurrency, calculateLoanStatus, formatDate } from '../utils/finance';
import { chatWithFinancialAssistant } from '../services/geminiService';
import { AlertCircle, Check, Clock, Plus, Wallet, ChevronDown, ChevronUp, Percent, DollarSign, PieChart, TrendingUp, Sparkles, Bell, ThumbsUp, AlertTriangle, X, Send, Bot, User as UserIcon, RefreshCw, MessageSquareText, Minimize2, Paperclip, FileText, Image as ImageIcon, ArrowUpRight, ArrowDownLeft, MoreHorizontal } from 'lucide-react';
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
  // New props for controlling modal from App.tsx FAB
  externalShowAddForm?: boolean;
  setExternalShowAddForm?: (show: boolean) => void;
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
        <div className="prose prose-sm max-w-none text-sm leading-relaxed text-slate-600">
            {text.split('\n').map((line, lineIdx) => {
                const parts = line.split(/(\*\*.*?\*\*)/g);
                return (
                    <p key={lineIdx} className={`mb-1 ${line.trim().startsWith('-') ? 'pl-2' : ''}`}>
                        {parts.map((part, partIdx) => {
                            if (part.startsWith('**') && part.endsWith('**')) {
                                return <strong key={partIdx} className="font-bold text-slate-800">{part.slice(2, -2)}</strong>;
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
  costs, debts, users, currentUser, stages, defaultInterestRate, onUpdateDefaultSettings, onAddCost, onApproveCost, onMarkAsPaid, onDismissPaymentCall, onUploadAttachments,
  externalShowAddForm, setExternalShowAddForm
}) => {
  // Local state fallback if external props not provided
  const [localShowAddForm, setLocalShowAddForm] = useState(false);
  const showAddForm = externalShowAddForm !== undefined ? externalShowAddForm : localShowAddForm;
  const setShowAddForm = setExternalShowAddForm || setLocalShowAddForm;

  const [expandedCost, setExpandedCost] = useState<string | null>(null);

  // --- AI Chat State ---
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
      { id: 'init', role: 'model', text: 'Xin chào! Tôi là trợ lý tài chính của HTTP Home. \nBạn cần xem **tổng quan công nợ**, **chi phí dự án** hay **tiến độ** không?', timestamp: Date.now() }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

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
  const [amount, setAmount] = useState(''); 
  const [stageId, setStageId] = useState('');
  const [payerId, setPayerId] = useState(currentUser.id);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [allocType, setAllocType] = useState<'EQUAL' | 'CUSTOM'>('EQUAL');
  const [customAmounts, setCustomAmounts] = useState<{[key:string]: string}>({}); 
  
  // File Upload State
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!stageId && stages.length > 0) {
        setStageId(stages[0].id);
    }
  }, [stages, stageId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
        const newFiles = Array.from(e.target.files);
        setSelectedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseInt(amount || '0', 10);
    
    if (!description || !numAmount || !stageId) return;

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
    setDescription('');
    setAmount('');
    setCustomAmounts({});
    setSelectedFiles([]);
  };

  const handleOpenPaymentConfirm = (costId: string, debtorId: string, debtorName: string, initialPrincipal: number, paymentsHistory: any[], transactionDate: string, interestRate: number) => {
      setPaymentDate(new Date().toISOString().split('T')[0]); 
      const status = calculateLoanStatus(initialPrincipal, transactionDate, 0, paymentsHistory);
      setConfirmPayment({ costId, debtorId, debtorName, initialPrincipal, paymentsHistory, transactionDate, interestRate: 0 });
      setPaymentAmountInput(Math.round(status.remainingPrincipal).toString());
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!chatInput.trim() || isTyping) return;
      const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: chatInput, timestamp: Date.now() };
      setChatMessages(prev => [...prev, userMsg]);
      setChatInput('');
      setIsTyping(true);
      const context = { stages, costs, debts, users };
      const answer = await chatWithFinancialAssistant(
          userMsg.text, context, currentUser, 
          chatMessages.map(m => ({role: m.role, text: m.text}))
      );
      const botMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'model', text: answer, timestamp: Date.now() };
      setChatMessages(prev => [...prev, botMsg]);
      setIsTyping(false);
  };

  const totalProjectCost = useMemo(() => {
    return costs.filter(c => c.status === 'APPROVED').reduce((sum, c) => sum + c.amount, 0);
  }, [costs]);

  // Current User Net Position
  const myNetPosition = useMemo(() => {
      const myDebts = debts.filter(d => d.debtorId === currentUser.id);
      const totalOwed = myDebts.reduce((acc, d) => acc + d.totalDebt, 0);
      const othersDebtsToMe = debts.filter(d => d.creditorId === currentUser.id);
      const totalReceivable = othersDebtsToMe.reduce((acc, d) => acc + d.totalDebt, 0);
      return { totalOwed, totalReceivable, net: totalReceivable - totalOwed };
  }, [debts, currentUser.id]);

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
          {/* Total Cost Card */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between h-48 md:h-56 relative overflow-hidden group">
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

          {/* My Wallet Card (Net Position) */}
          <div className={`p-6 rounded-3xl border shadow-sm flex flex-col justify-between h-48 md:h-56 relative overflow-hidden transition-all ${myNetPosition.net >= 0 ? 'bg-white border-slate-100' : 'bg-white border-red-100'}`}>
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
                  <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Phải trả</span>
                      <span className="text-sm font-bold text-rose-600 font-mono block">-{formatCurrency(myNetPosition.totalOwed)}</span>
                  </div>
              </div>
          </div>
          
          {/* Quick Stats / Mini Chart (Desktop) */}
          <div className="hidden lg:flex bg-slate-850 p-6 rounded-3xl text-white flex-col justify-between h-56 shadow-lg shadow-slate-200">
              <div>
                  <h3 className="font-bold text-lg mb-1">Tỷ lệ đóng góp</h3>
                  <p className="text-slate-400 text-xs">Phân bổ trách nhiệm tài chính</p>
              </div>
              <div className="flex-1 flex items-end gap-2 pb-2">
                  {users.map((u, i) => {
                       // Calculate roughly for visual
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
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
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
                          <div className="flex items-center gap-4">
                              {/* Icon/Avatar */}
                              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 font-bold text-sm shadow-sm ${isApproved ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-600'}`}>
                                  {payer?.avatar}
                              </div>
                              
                              {/* Main Info */}
                              <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-0.5">
                                      <h4 className="font-bold text-slate-800 truncate">{cost.description}</h4>
                                      {!isApproved && <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded uppercase tracking-wide">Chờ duyệt</span>}
                                  </div>
                                  <div className="text-xs text-slate-500 flex items-center gap-2">
                                      <span>{formatDate(cost.date)}</span>
                                      <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                      <span className="truncate max-w-[100px]">{stageName}</span>
                                      {cost.attachments && cost.attachments.length > 0 && <Paperclip className="w-3 h-3 text-slate-400" />}
                                  </div>
                              </div>

                              {/* Amount */}
                              <div className="text-right">
                                  <div className="font-bold text-slate-900 font-mono text-base">{formatCurrency(cost.amount)}</div>
                                  <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                                      {isApproved ? 'Đã duyệt' : 'Đang chờ'}
                                  </div>
                              </div>
                              
                              <ChevronDown className={`w-5 h-5 text-slate-300 group-hover:text-slate-500 transition-transform ${expandedCost === cost.id ? 'rotate-180' : ''}`} />
                          </div>

                          {/* EXPANDED DETAILS */}
                          {expandedCost === cost.id && (
                              <div className="mt-4 pt-4 border-t border-slate-100 pl-16 animate-in slide-in-from-top-2">
                                  
                                  {/* Action Buttons Row */}
                                  <div className="flex gap-2 mb-4 overflow-x-auto pb-2 no-scrollbar">
                                      {/* Approve Button */}
                                      {!cost.approvedBy.includes(currentUser.id) && cost.status === 'PENDING' && (
                                          <button 
                                            onClick={(e) => { e.stopPropagation(); onApproveCost(cost.id); }}
                                            className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white text-sm font-bold rounded-xl shadow-md hover:bg-amber-600 transition-colors whitespace-nowrap"
                                          >
                                              <ThumbsUp className="w-4 h-4" /> Duyệt chi
                                          </button>
                                      )}
                                      
                                      {/* Upload Button */}
                                      {(currentUser.id === cost.payerId || currentUser.role === Role.ADMIN) && (
                                        <label className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 text-sm font-bold rounded-xl hover:bg-slate-200 cursor-pointer transition-colors whitespace-nowrap">
                                            <input type="file" multiple className="hidden" onChange={(e) => {
                                                if(e.target.files?.length) onUploadAttachments(cost.id, Array.from(e.target.files));
                                            }} />
                                            <Plus className="w-4 h-4" /> Thêm ảnh
                                        </label>
                                      )}
                                  </div>

                                  {/* Attachments Grid */}
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

                                  {/* Allocation List */}
                                  <div className="bg-slate-50 rounded-xl p-4 text-sm space-y-3">
                                      {cost.allocations.map(a => {
                                          const u = users.find(user => user.id === a.userId);
                                          const isMe = u?.id === currentUser.id;
                                          const isDebtor = a.userId !== cost.payerId;
                                          const canCollect = (currentUser.role === Role.ADMIN || currentUser.id === cost.payerId) && isApproved;
                                          const status = calculateLoanStatus(a.amount, cost.date, 0, a.payments || []);
                                          const isPaid = status.remainingPrincipal <= 0;

                                          return (
                                              <div key={a.userId} className="flex items-center justify-between">
                                                  <div className="flex items-center gap-2">
                                                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${isMe ? 'bg-primary-100 text-primary-700' : 'bg-slate-200 text-slate-600'}`}>
                                                          {u?.avatar}
                                                      </div>
                                                      <span className={`font-medium ${isMe ? 'text-primary-700' : 'text-slate-700'}`}>{u?.name}</span>
                                                  </div>
                                                  
                                                  <div className="flex items-center gap-3">
                                                      <div className="text-right">
                                                          <div className="font-mono font-bold text-slate-800">{formatCurrency(a.amount)}</div>
                                                          {isDebtor && a.paidAmount > 0 && !isPaid && (
                                                              <div className="text-[10px] text-emerald-600 font-bold">Đã trả: {formatCurrency(a.paidAmount)}</div>
                                                          )}
                                                      </div>

                                                      {isDebtor && (
                                                          isPaid ? (
                                                              <div className="bg-emerald-100 text-emerald-700 p-1 rounded-full"><Check className="w-3 h-3" /></div>
                                                          ) : (
                                                              canCollect && (
                                                                  <button 
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleOpenPaymentConfirm(cost.id, a.userId, u?.name || '', a.amount, a.payments || [], cost.date, 0);
                                                                    }}
                                                                    className="p-1.5 bg-white border border-slate-200 text-primary-600 rounded-lg shadow-sm hover:bg-primary-50 transition-colors"
                                                                    title="Thu tiền"
                                                                  >
                                                                      <DollarSign className="w-3.5 h-3.5" />
                                                                  </button>
                                                              )
                                                          )
                                                      )}
                                                  </div>
                                              </div>
                                          )
                                      })}
                                  </div>
                              </div>
                          )}
                      </div>
                  )
               })}
           </div>
      </div>

      {/* 3. ADD COST BOTTOM SHEET (Mobile First Design) */}
      {(showAddForm) && (
          <div className="fixed inset-0 z-50 flex justify-center items-end md:items-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
              {/* Overlay Click to close */}
              <div className="absolute inset-0" onClick={() => setShowAddForm(false)}></div>

              <div className="bg-white w-full md:max-w-lg md:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden relative slide-up md:animate-in md:zoom-in-95 flex flex-col max-h-[90vh]">
                  {/* Handle Bar for mobile feel */}
                  <div className="md:hidden w-full flex justify-center pt-3 pb-1" onClick={() => setShowAddForm(false)}>
                      <div className="w-12 h-1.5 bg-slate-200 rounded-full"></div>
                  </div>

                  <form onSubmit={handleSubmit} className="flex flex-col h-full">
                      <div className="px-6 pt-4 pb-0 flex-shrink-0">
                          <h3 className="text-center text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Nhập chi phí mới</h3>
                          {/* BIG AMOUNT INPUT */}
                          <div className="relative mb-6">
                             <input 
                                required
                                type="number"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                placeholder="0"
                                className="w-full text-center text-5xl font-mono font-bold text-slate-800 placeholder-slate-200 focus:outline-none bg-transparent py-2"
                                autoFocus
                             />
                             <div className="text-center text-sm font-bold text-primary-600 mt-1 h-5">
                                 {amount ? formatCurrency(parseInt(amount)) : 'VNĐ'}
                             </div>
                          </div>
                      </div>

                      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-5">
                          {/* Description */}
                          <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Nội dung chi</label>
                              <input 
                                required 
                                type="text" 
                                value={description} 
                                onChange={e => setDescription(e.target.value)} 
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-base font-medium focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all" 
                                placeholder="Ví dụ: Mua cát, xi măng..." 
                              />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Giai đoạn</label>
                                  <select value={stageId} onChange={e => setStageId(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-primary-500 outline-none">
                                      {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                  </select>
                              </div>
                              <div>
                                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Ngày chi</label>
                                  <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-primary-500 outline-none" />
                              </div>
                          </div>

                          {/* Payer Selection */}
                          <div>
                              <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Người chi tiền</label>
                              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                                  {users.map(u => (
                                      <button
                                        type="button"
                                        key={u.id}
                                        onClick={() => setPayerId(u.id)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all whitespace-nowrap ${payerId === u.id ? 'bg-slate-800 text-white border-slate-800 shadow-md' : 'bg-white text-slate-600 border-slate-200'}`}
                                      >
                                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${payerId === u.id ? 'bg-white text-slate-900' : 'bg-slate-100 text-slate-500'}`}>
                                              {u.avatar}
                                          </div>
                                          <span className="text-sm font-bold">{u.name}</span>
                                      </button>
                                  ))}
                              </div>
                          </div>

                          {/* Allocation Toggle */}
                          <div className="bg-slate-50 rounded-xl p-1 flex">
                              <button type="button" onClick={() => setAllocType('EQUAL')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${allocType === 'EQUAL' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400'}`}>Chia đều</button>
                              <button type="button" onClick={() => setAllocType('CUSTOM')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${allocType === 'CUSTOM' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400'}`}>Tùy chỉnh</button>
                          </div>
                          
                          {allocType === 'CUSTOM' && (
                              <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                  {users.map(u => (
                                      <div key={u.id} className="flex items-center gap-2">
                                          <label className="w-24 text-xs font-bold text-slate-600 truncate">{u.name}</label>
                                          <input 
                                            type="number" 
                                            placeholder="0"
                                            value={customAmounts[u.id] || ''}
                                            onChange={e => setCustomAmounts(prev => ({...prev, [u.id]: e.target.value}))}
                                            className="flex-1 border border-slate-200 rounded-lg p-2 text-sm font-mono focus:outline-none focus:border-primary-500"
                                          />
                                      </div>
                                  ))}
                              </div>
                          )}

                          {/* File Upload */}
                          <div>
                              <div className="flex flex-wrap gap-2 mb-2">
                                  {selectedFiles.map((f, i) => (
                                      <div key={i} className="bg-blue-50 text-blue-700 px-2 py-1 rounded-md text-xs border border-blue-100 flex items-center gap-1">
                                          <span className="truncate max-w-[100px]">{f.name}</span>
                                          <button type="button" onClick={() => removeFile(i)}><X className="w-3 h-3" /></button>
                                      </div>
                                  ))}
                              </div>
                              <button 
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full py-3 border border-dashed border-slate-300 rounded-xl text-slate-500 text-sm font-medium hover:bg-slate-50 hover:border-primary-300 hover:text-primary-600 transition-all flex items-center justify-center gap-2"
                              >
                                  <Paperclip className="w-4 h-4" /> Đính kèm hóa đơn / ảnh
                              </button>
                              <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileChange} />
                          </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="p-4 border-t border-slate-100 bg-white flex-shrink-0 pb-safe-bottom">
                          <button type="submit" className="w-full py-4 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-2xl shadow-xl shadow-primary-200 active:scale-[0.98] transition-all text-lg flex items-center justify-center gap-2">
                              <Check className="w-6 h-6" /> Lưu Chi Phí
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* AI CHAT WIDGET */}
      <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-40 print:hidden">
          <button 
              onClick={() => setIsChatOpen(!isChatOpen)}
              className={`p-3.5 rounded-full shadow-2xl transition-all duration-300 flex items-center justify-center border-4 border-white ${isChatOpen ? 'bg-slate-800 text-white rotate-90 scale-90' : 'bg-gradient-to-r from-primary-600 to-accent-500 text-white hover:scale-110'}`}
          >
              {isChatOpen ? <X className="w-6 h-6" /> : <Sparkles className="w-6 h-6 animate-pulse" />}
          </button>
      </div>

      {isChatOpen && (
          <div className="fixed bottom-36 md:bottom-24 right-4 md:right-6 w-[90vw] md:w-[400px] h-[500px] max-h-[60vh] bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col z-40 overflow-hidden animate-in slide-in-from-bottom-10 fade-in zoom-in-95 origin-bottom-right">
              {/* Chat Header */}
              <div className="bg-slate-900 p-4 flex justify-between items-center text-white shrink-0">
                  <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white">
                          <Bot className="w-5 h-5" />
                      </div>
                      <div>
                          <h3 className="font-bold text-sm">Trợ lý Tài chính</h3>
                          <div className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                              <span className="text-[10px] text-slate-300">Sẵn sàng</span>
                          </div>
                      </div>
                  </div>
                  <button onClick={() => setIsChatOpen(false)} className="text-slate-400 hover:text-white"><Minimize2 className="w-5 h-5" /></button>
              </div>

              {/* Chat Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                  {chatMessages.map(msg => (
                      <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                          <div className={`p-3 rounded-2xl max-w-[85%] text-sm shadow-sm ${msg.role === 'user' ? 'bg-primary-600 text-white rounded-tr-none' : 'bg-white border border-slate-200 rounded-tl-none'}`}>
                              {msg.role === 'model' ? <RenderMessageText text={msg.text} /> : msg.text}
                          </div>
                      </div>
                  ))}
                  {isTyping && (
                      <div className="flex gap-2">
                           <div className="bg-white border border-slate-200 p-3 rounded-2xl rounded-tl-none flex gap-1">
                               <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                               <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-75"></span>
                               <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-150"></span>
                           </div>
                      </div>
                  )}
                  <div ref={chatEndRef}></div>
              </div>

              {/* Chat Input */}
              <div className="p-3 bg-white border-t border-slate-100 flex gap-2">
                  <input 
                    type="text" 
                    value={chatInput} 
                    onChange={e => setChatInput(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && handleSendMessage(e)}
                    placeholder="Hỏi gì đó..."
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-primary-500"
                  />
                  <button onClick={handleSendMessage} disabled={!chatInput.trim()} className="p-2 bg-primary-600 text-white rounded-full hover:bg-primary-700 disabled:opacity-50">
                      <Send className="w-4 h-4" />
                  </button>
              </div>
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
                      <input 
                        type="number" 
                        value={paymentAmountInput}
                        onChange={e => setPaymentAmountInput(e.target.value)}
                        className="flex-1 font-mono text-xl font-bold text-primary-700 outline-none"
                        autoFocus
                      />
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
