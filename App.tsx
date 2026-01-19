
import React, { useState, useMemo, useEffect } from 'react';
import { INITIAL_USERS, INITIAL_STAGES, INITIAL_COSTS, DEFAULT_INTEREST_RATE_YEARLY, INITIAL_TOPICS } from './constants';
import { User, Stage, Cost, DebtRecord, Role, StageStatus, Payment, Topic, TopicStatus, TopicComment } from './types';
import { calculateDebts, formatCurrency } from './utils/finance';
import { Timeline } from './components/Timeline';
import { FinancialDashboard } from './components/FinancialDashboard';
import { ActivityLog } from './components/ActivityLog';
import { PersonalReport } from './components/PersonalReport';
import { DiscussionBoard } from './components/DiscussionBoard';
import { LayoutDashboard, Calendar, History, FileText, Menu, X, User as UserIcon, Users } from 'lucide-react';

export default function App() {
  // --- State ---
  const [currentUser, setCurrentUser] = useState<User>(INITIAL_USERS[0]);
  const [users] = useState<User[]>(INITIAL_USERS);
  const [stages, setStages] = useState<Stage[]>(INITIAL_STAGES);
  const [costs, setCosts] = useState<Cost[]>(INITIAL_COSTS);
  const [topics, setTopics] = useState<Topic[]>(INITIAL_TOPICS);
  const [view, setView] = useState<'DASHBOARD' | 'TIMELINE' | 'ACTIVITY' | 'DISCUSSION'>('DASHBOARD');
  const [showPersonalReport, setShowPersonalReport] = useState(false);
  const [showMobileUserMenu, setShowMobileUserMenu] = useState(false);

  // Settings State - Now acts as Default Value for new costs
  const [defaultInterestRate, setDefaultInterestRate] = useState(DEFAULT_INTEREST_RATE_YEARLY);

  // --- Derived State (Debts) ---
  const debts = useMemo(() => {
    // Interest is now calculated based on each cost's specific rate, not a global one
    return calculateDebts(costs, users);
  }, [costs, users]);

  // --- Derived State (Stages with Total Cost) ---
  const stagesWithCalculatedCosts = useMemo(() => {
    return stages.map(stage => {
      const stageCosts = costs.filter(c => c.stageId === stage.id && c.status === 'APPROVED');
      const total = stageCosts.reduce((sum, c) => sum + c.amount, 0);
      return { ...stage, totalCost: total };
    });
  }, [stages, costs]);

  // --- Handlers ---
  const handleAddStage = () => {
    const newStage: Stage = {
      id: `s${Date.now()}`,
      name: 'Giai đoạn mới',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      status: StageStatus.NOT_STARTED,
      totalCost: 0,
      budget: 0
    };
    setStages([...stages, newStage]);
  };

  const handleDeleteStage = (id: string) => {
    setStages(stages.filter(s => s.id !== id));
  };

  const handleUpdateStageStatus = (id: string, status: StageStatus) => {
    setStages(stages.map(s => s.id === id ? { ...s, status } : s));
  };

  const handleUpdateStageDates = (id: string, startDate: string, endDate: string) => {
    setStages(stages.map(s => s.id === id ? { ...s, startDate, endDate } : s));
  };

  const handleUpdateStageName = (id: string, name: string) => {
    setStages(stages.map(s => s.id === id ? { ...s, name } : s));
  };
  
  const handleUpdateStageBudget = (id: string, budget: number) => {
      setStages(stages.map(s => s.id === id ? { ...s, budget } : s));
  };

  const handleTogglePaymentCall = (id: string) => {
    setStages(stages.map(s => {
        if (s.id !== id) return s;
        // If already has a call, toggle it off
        if (s.paymentCallAmount) {
            return { ...s, paymentCallAmount: undefined };
        }
        // If no call, turn it on with default calculation: Budget / Users Count
        const amountPerPerson = s.budget > 0 ? Math.round(s.budget / users.length) : 0;
        return { ...s, paymentCallAmount: amountPerPerson };
    }));
  };
  
  const handleDismissPaymentCall = (id: string) => {
    setStages(stages.map(s => s.id === id ? { ...s, paymentCallAmount: undefined } : s));
  };

  const handleAddCost = (costData: Omit<Cost, 'id' | 'createdAt' | 'approvedBy' | 'status'>) => {
    const newCost: Cost = {
      ...costData,
      id: `c${Date.now()}`,
      createdAt: Date.now(),
      status: 'PENDING',
      approvedBy: [currentUser.id] // Creator auto-approves
    };
    setCosts([newCost, ...costs]);
  };

  const handleApproveCost = (costId: string) => {
    setCosts(costs.map(c => {
      if (c.id !== costId) return c;
      
      // If already approved by me, do nothing
      if(c.approvedBy.includes(currentUser.id)) return c;

      const newApprovals = [...c.approvedBy, currentUser.id];
      const isFullyApproved = newApprovals.length >= users.length; 
      
      return {
        ...c,
        approvedBy: newApprovals,
        status: isFullyApproved ? 'APPROVED' : 'PENDING'
      };
    }));
  };

  // Add partial or full payment
  const handlePayment = (costId: string, debtorId: string, amount: number, interest: number, paidDate: string) => {
    setCosts(costs.map(c => {
      if (c.id !== costId) return c;
      
      return {
        ...c,
        allocations: c.allocations.map(a => {
          if (a.userId !== debtorId) return a;

          const newPayment: Payment = {
            id: `p${Date.now()}`,
            amount: amount,
            interest: interest,
            date: paidDate
          };
          
          // Paid Amount only tracks PRINCIPAL
          const newPaidAmount = (a.paidAmount || 0) + amount;
          // Floating point safety check, though for currency integers are preferred usually
          const isPaid = newPaidAmount >= a.amount - 100; // tolerance of 100 VND

          return { 
            ...a, 
            paidAmount: newPaidAmount,
            payments: [...(a.payments || []), newPayment],
            isPaid: isPaid
          };
        })
      };
    }));
  };

  const handleUpdateDefaultSettings = (newRate: number) => {
    setDefaultInterestRate(newRate);
  };

  // --- DISCUSSION BOARD HANDLERS ---
  const handleAddTopic = (title: string) => {
      const newTopic: Topic = {
          id: `t${Date.now()}`,
          creatorId: currentUser.id,
          title,
          createdAt: Date.now(),
          status: TopicStatus.VOTING,
          votes: [{ userId: currentUser.id, type: 'LIKE' }], // Creator auto likes
          comments: [],
          readyToSpin: []
      };
      setTopics([newTopic, ...topics]);
  };

  const handleAddTopicComment = (topicId: string, content: string) => {
      const newComment: TopicComment = {
          id: `cm${Date.now()}`,
          userId: currentUser.id,
          content,
          createdAt: Date.now()
      };

      setTopics(prev => prev.map(t => {
          if (t.id !== topicId) return t;
          return {
              ...t,
              comments: [...(t.comments || []), newComment]
          };
      }));
  };

  const handleVote = (topicId: string, type: 'LIKE' | 'DISLIKE') => {
      setTopics(prevTopics => prevTopics.map(topic => {
          if (topic.id !== topicId) return topic;
          // Only allow voting if topic is active
          if (topic.status !== TopicStatus.VOTING && topic.status !== TopicStatus.CONFLICT) return topic;

          // Update Votes
          const existingVoteIndex = topic.votes.findIndex(v => v.userId === currentUser.id);
          let newVotes = [...topic.votes];
          
          if (existingVoteIndex >= 0) {
              newVotes[existingVoteIndex] = { userId: currentUser.id, type };
          } else {
              newVotes.push({ userId: currentUser.id, type });
          }

          // --- CALCULATE NEW STATUS ---
          const totalUsers = users.length; // 3
          const likeCount = newVotes.filter(v => v.type === 'LIKE').length;
          const dislikeCount = newVotes.filter(v => v.type === 'DISLIKE').length;
          const totalVotes = newVotes.length;
          
          let newStatus = topic.status;
          let finalMethod = topic.finalDecisionMethod;

          // Only change status if everyone has voted OR if consensus is already impossible/achieved
          
          // Case 1: 3 Likes -> Approved (Unanimous)
          if (likeCount === totalUsers) {
              newStatus = TopicStatus.APPROVED;
              finalMethod = 'CONSENSUS';
          }
          // Case 2: 3 Dislikes -> Rejected (Unanimous rejection)
          else if (dislikeCount === totalUsers) {
              newStatus = TopicStatus.REJECTED;
          }
          // Case 3: Everyone voted, but no consensus (e.g., 2L-1D, 1L-2D) -> Conflict
          else if (totalVotes === totalUsers) {
              newStatus = TopicStatus.CONFLICT;
              // Ensure we reset readyToSpin if we just entered conflict (though practically they can't be ready yet)
          }
          // Default: Still Voting if not everyone voted
          else {
              newStatus = TopicStatus.VOTING;
          }

          return {
              ...topic,
              votes: newVotes,
              status: newStatus,
              finalDecisionMethod: finalMethod
          };
      }));
  };

  // Toggle "Ready to Spin" status for the current user
  const handleToggleReadyToSpin = (topicId: string) => {
      setTopics(prevTopics => prevTopics.map(topic => {
          if (topic.id !== topicId) return topic;
          
          const isReady = topic.readyToSpin.includes(currentUser.id);
          let newReadyList;
          
          if (isReady) {
              newReadyList = topic.readyToSpin.filter(id => id !== currentUser.id);
          } else {
              newReadyList = [...topic.readyToSpin, currentUser.id];
          }

          return {
              ...topic,
              readyToSpin: newReadyList
          };
      }));
  };

  const handleSpinDecision = (topicId: string, approved: boolean) => {
      setTopics(prevTopics => prevTopics.map(topic => {
          if (topic.id !== topicId) return topic;
          return {
              ...topic,
              status: approved ? TopicStatus.APPROVED : TopicStatus.REJECTED,
              finalDecisionMethod: 'RANDOM_SPIN',
              readyToSpin: [] // Clear ready state
          };
      }));
  };

  const renderContent = () => {
    switch (view) {
      case 'TIMELINE':
        return (
          <Timeline 
            stages={stagesWithCalculatedCosts} 
            role={currentUser.role}
            onUpdateStatus={handleUpdateStageStatus}
            onUpdateStageDates={handleUpdateStageDates}
            onUpdateStageName={handleUpdateStageName}
            onUpdateStageBudget={handleUpdateStageBudget}
            onTogglePaymentCall={handleTogglePaymentCall}
            onDeleteStage={handleDeleteStage}
            onAddStage={handleAddStage}
          />
        );
      case 'ACTIVITY':
        return (
          <ActivityLog 
            costs={costs}
            users={users}
            stages={stagesWithCalculatedCosts}
          />
        );
      case 'DISCUSSION':
        return (
            <DiscussionBoard 
                users={users}
                currentUser={currentUser}
                topics={topics}
                onAddTopic={handleAddTopic}
                onVote={handleVote}
                onSpinDecision={handleSpinDecision}
                onAddComment={handleAddTopicComment}
                onToggleReadyToSpin={handleToggleReadyToSpin}
            />
        );
      case 'DASHBOARD':
      default:
        return (
          <FinancialDashboard 
            costs={costs}
            debts={debts}
            users={users}
            currentUser={currentUser}
            stages={stagesWithCalculatedCosts}
            defaultInterestRate={defaultInterestRate}
            onUpdateDefaultSettings={handleUpdateDefaultSettings}
            onAddCost={handleAddCost}
            onApproveCost={handleApproveCost}
            onMarkAsPaid={handlePayment}
            onDismissPaymentCall={handleDismissPaymentCall}
          />
        );
    }
  };

  const NavButton = ({ active, onClick, icon: Icon, label }: any) => (
    <button 
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors whitespace-nowrap ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      <span className="font-medium">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      {/* MOBILE Header */}
      <header className="md:hidden bg-slate-900 text-white sticky top-0 z-30 shadow-md">
         <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-2">
               <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center font-bold">T</div>
               <h1 className="text-lg font-bold tracking-tight">TTP Home</h1>
            </div>
            <button onClick={() => setShowMobileUserMenu(true)} className="flex items-center gap-2 bg-slate-800 rounded-full pl-3 pr-1 py-1 border border-slate-700">
               <span className="text-xs font-medium max-w-[80px] truncate">{currentUser.name}</span>
               <div className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center text-[10px] font-bold">
                  {currentUser.avatar}
               </div>
            </button>
         </div>
         {/* Mobile Nav Tabs */}
         <nav className="flex px-4 pb-0 gap-1 overflow-x-auto no-scrollbar border-t border-slate-800">
             <button 
               onClick={() => setView('DASHBOARD')}
               className={`flex-1 flex items-center justify-center gap-2 py-3 border-b-2 transition-colors whitespace-nowrap px-2 ${view === 'DASHBOARD' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-400'}`}
             >
                <LayoutDashboard className="w-4 h-4" />
                <span className="text-sm font-medium">Tài chính</span>
             </button>
             <button 
               onClick={() => setView('TIMELINE')}
               className={`flex-1 flex items-center justify-center gap-2 py-3 border-b-2 transition-colors whitespace-nowrap px-2 ${view === 'TIMELINE' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-400'}`}
             >
                <Calendar className="w-4 h-4" />
                <span className="text-sm font-medium">Tiến độ</span>
             </button>
             <button 
               onClick={() => setView('ACTIVITY')}
               className={`flex-1 flex items-center justify-center gap-2 py-3 border-b-2 transition-colors whitespace-nowrap px-2 ${view === 'ACTIVITY' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-400'}`}
             >
                <History className="w-4 h-4" />
                <span className="text-sm font-medium">Nhật ký</span>
             </button>
             <button 
               onClick={() => setView('DISCUSSION')}
               className={`flex-1 flex items-center justify-center gap-2 py-3 border-b-2 transition-colors whitespace-nowrap px-2 ${view === 'DISCUSSION' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-400'}`}
             >
                <Users className="w-4 h-4" />
                <span className="text-sm font-medium">Hội nghị</span>
             </button>
         </nav>
      </header>

      {/* DESKTOP Sidebar */}
      <aside className="hidden md:flex w-64 bg-slate-900 text-slate-300 flex-shrink-0 flex-col h-screen sticky top-0 overflow-y-auto">
        <div className="p-6">
           <h1 className="text-2xl font-bold text-white tracking-tight">TTP Home</h1>
           <p className="text-xs text-slate-500 mt-1">Quản lý dự án</p>
        </div>

        <nav className="flex-1 px-4 space-y-2">
           <NavButton active={view === 'DASHBOARD'} onClick={() => setView('DASHBOARD')} icon={LayoutDashboard} label="Tài chính" />
           <NavButton active={view === 'TIMELINE'} onClick={() => setView('TIMELINE')} icon={Calendar} label="Tiến độ" />
           <NavButton active={view === 'ACTIVITY'} onClick={() => setView('ACTIVITY')} icon={History} label="Nhật ký" />
           <NavButton active={view === 'DISCUSSION'} onClick={() => setView('DISCUSSION')} icon={Users} label="Hội nghị" />
        </nav>

        {/* User Switcher */}
        <div className="p-4 border-t border-slate-800">
           <p className="text-xs font-semibold text-slate-500 mb-3 uppercase">Đang xem với tư cách</p>
           <div className="space-y-2">
             {users.map(u => (
               <button 
                 key={u.id}
                 onClick={() => setCurrentUser(u)}
                 className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${currentUser.id === u.id ? 'bg-slate-800 text-white shadow-sm' : 'hover:bg-slate-800/50'}`}
               >
                 <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold flex-shrink-0">{u.avatar}</div>
                 <span className="truncate">{u.name}</span>
                 {u.role === Role.ADMIN && <span className="ml-auto text-[10px] bg-indigo-900 text-indigo-200 px-1 rounded">ADMIN</span>}
               </button>
             ))}
           </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-[100vw] overflow-hidden flex flex-col">
        {/* Desktop Header */}
        <header className="hidden md:flex bg-white border-b border-slate-200 px-8 py-5 justify-between items-center sticky top-0 z-10 shadow-sm">
           <div>
             <h2 className="text-xl font-bold text-slate-800">
               {view === 'DASHBOARD' && 'Tổng quan tài chính'}
               {view === 'TIMELINE' && 'Tiến độ dự án'}
               {view === 'ACTIVITY' && 'Nhật ký hoạt động'}
               {view === 'DISCUSSION' && 'Hội nghị & Quy tắc'}
             </h2>
             <p className="text-sm text-slate-500">Xin chào, {currentUser.name}</p>
           </div>
           
           <button 
             onClick={() => setShowPersonalReport(true)}
             className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg shadow-md hover:bg-indigo-700 hover:shadow-lg transition-all"
           >
             <FileText className="w-4 h-4" />
             <span>Báo cáo cá nhân</span>
           </button>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 md:space-y-8 pb-24 md:pb-8">
           {/* Mobile Report Button (Floating) */}
           <div className="md:hidden mb-4">
             <button 
                onClick={() => setShowPersonalReport(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border border-indigo-100 text-indigo-600 rounded-xl shadow-sm font-medium"
              >
                <FileText className="w-4 h-4" />
                <span>Xem báo cáo cá nhân của bạn</span>
              </button>
           </div>

           {renderContent()}
        </div>
      </main>

      {/* Mobile User Menu Modal */}
      {showMobileUserMenu && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setShowMobileUserMenu(false)}>
           <div className="bg-white w-full max-w-sm rounded-2xl p-4 shadow-2xl animate-in slide-in-from-bottom-10 duration-300" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                 <h3 className="font-bold text-lg text-slate-800">Chọn người dùng</h3>
                 <button onClick={() => setShowMobileUserMenu(false)} className="p-2 bg-slate-100 rounded-full text-slate-500">
                    <X className="w-5 h-5" />
                 </button>
              </div>
              <div className="space-y-2">
                 {users.map(u => (
                   <button 
                     key={u.id}
                     onClick={() => { setCurrentUser(u); setShowMobileUserMenu(false); }}
                     className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${currentUser.id === u.id ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'bg-white border-slate-100 hover:bg-slate-50'}`}
                   >
                     <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${currentUser.id === u.id ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>{u.avatar}</div>
                     <div className="text-left">
                        <div className={`font-bold ${currentUser.id === u.id ? 'text-indigo-900' : 'text-slate-700'}`}>{u.name}</div>
                        <div className="text-xs text-slate-500">{u.role}</div>
                     </div>
                     {currentUser.id === u.id && <Check className="w-5 h-5 text-indigo-600 ml-auto" />}
                   </button>
                 ))}
              </div>
           </div>
        </div>
      )}

      {/* Personal Report Modal */}
      {showPersonalReport && (
        <PersonalReport 
            user={currentUser} 
            users={users} 
            costs={costs} 
            debts={debts} 
            onClose={() => setShowPersonalReport(false)} 
        />
      )}
    </div>
  );
}

function Check(props: any) {
    return (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
    )
}
