
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { INITIAL_USERS, DEFAULT_INTEREST_RATE_YEARLY, APP_LOGO } from './constants';
import { User, Stage, Cost, DebtRecord, Role, StageStatus, Payment, Topic, TopicStatus, TopicComment, Attachment } from './types';
import { calculateDebts, formatCurrency } from './utils/finance';
import { Timeline } from './components/Timeline';
import { FinancialDashboard } from './components/FinancialDashboard';
import { ActivityLog } from './components/ActivityLog';
import { PersonalReport } from './components/PersonalReport';
import { DiscussionBoard } from './components/DiscussionBoard';
import { Login } from './components/Login';
import { FirebaseConfigModal } from './components/FirebaseConfigModal';
import { LayoutGrid, Calendar, History, Users, LogOut, Loader2, Settings2, Plus, FileBarChart, Sparkles, X, Send, Bot, Minimize2 } from 'lucide-react';
import { tryInitFirebase, getFirebaseAuth, getFirebaseDb, resetFirebaseConfig, getFirebaseStorage } from './firebaseConfig';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, query, orderBy, arrayUnion } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { chatWithFinancialAssistant } from './services/geminiService';

interface ChatMessage {
    id: string;
    role: 'user' | 'model';
    text: string;
    timestamp: number;
}

// Helper to render basic Markdown in AI Chat
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

export default function App() {
  // --- Config & Auth State ---
  const [isFirebaseReady, setIsFirebaseReady] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // --- App Data State ---
  const [users] = useState<User[]>(INITIAL_USERS);
  const [stages, setStages] = useState<Stage[]>([]); 
  const [costs, setCosts] = useState<Cost[]>([]);    
  const [topics, setTopics] = useState<Topic[]>([]); 
  
  const [view, setView] = useState<'DASHBOARD' | 'TIMELINE' | 'ACTIVITY' | 'DISCUSSION'>('DASHBOARD');
  const [showPersonalReport, setShowPersonalReport] = useState(false);
  
  // State for Add Cost Modal (controlled by Dashboard floating button)
  const [showAddCostModal, setShowAddCostModal] = useState(false);

  // --- AI Chat State (Global) ---
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
      { id: 'init', role: 'model', text: 'Xin chào! Tôi là trợ lý tài chính của HTTP Home. \nBạn cần xem **tổng quan công nợ**, **chi phí dự án** hay **tiến độ** không?', timestamp: Date.now() }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll chat
  useEffect(() => {
    if (isChatOpen) {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isTyping, isChatOpen]);
  
  // --- 1. Init Firebase on Mount ---
  useEffect(() => {
      const ready = tryInitFirebase();
      if (ready) {
          setIsFirebaseReady(true);
      } else {
          setInitializing(false);
          setIsFirebaseReady(false);
      }
  }, []);

  // --- 2. Auth & Data Listeners ---
  useEffect(() => {
    if (!isFirebaseReady) return;
    
    setInitializing(true);
    const auth = getFirebaseAuth();
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const appUser = INITIAL_USERS.find(u => u.email === firebaseUser.email);
        if (appUser) {
            setCurrentUser(appUser);
        } else {
            setCurrentUser(null); 
            alert("Tài khoản này chưa được cấu hình trong hệ thống HTTP Home.");
            signOut(auth);
        }
      } else {
        setCurrentUser(null);
      }
      setInitializing(false);
    });

    return () => unsubscribeAuth();
  }, [isFirebaseReady]);

  // --- 3. Real-time Data Sync (Firestore) ---
  useEffect(() => {
    if (!isFirebaseReady || !currentUser) return;

    const db = getFirebaseDb();

    // Sync Stages
    const unsubStages = onSnapshot(query(collection(db, 'stages'), orderBy('id')), (snapshot) => {
        const data = snapshot.docs.map(doc => doc.data() as Stage);
        setStages(data.sort((a,b) => a.id.localeCompare(b.id)));
    });

    // Sync Costs
    const unsubCosts = onSnapshot(query(collection(db, 'costs'), orderBy('createdAt', 'desc')), (snapshot) => {
        const data = snapshot.docs.map(doc => doc.data() as Cost);
        setCosts(data);
    });

    // Sync Topics
    const unsubTopics = onSnapshot(query(collection(db, 'topics'), orderBy('createdAt', 'desc')), (snapshot) => {
        const data = snapshot.docs.map(doc => doc.data() as Topic);
        setTopics(data);
    });

    return () => {
        unsubStages();
        unsubCosts();
        unsubTopics();
    };
  }, [isFirebaseReady, currentUser]);

  const handleLogout = () => {
      const auth = getFirebaseAuth();
      signOut(auth);
  };

  const handleResetConfig = () => {
      if(window.confirm("Bạn có chắc muốn xóa cấu hình Firebase và nhập lại không?")) {
          resetFirebaseConfig();
      }
  };

  // --- Derived State ---
  const debts = useMemo(() => {
    return calculateDebts(costs, users);
  }, [costs, users]);

  const stagesWithCalculatedCosts = useMemo(() => {
    return stages.map(stage => {
      const stageCosts = costs.filter(c => c.stageId === stage.id && c.status === 'APPROVED');
      const total = stageCosts.reduce((sum, c) => sum + c.amount, 0);
      return { ...stage, totalCost: total };
    });
  }, [stages, costs]);

  // --- Firestore Handlers ---

  const handleAddStage = async () => {
    const newStage: Stage = {
      id: `s${Date.now()}`,
      name: 'Giai đoạn mới',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      status: StageStatus.NOT_STARTED,
      totalCost: 0,
      budget: 0
    };
    try {
        const db = getFirebaseDb();
        await setDoc(doc(db, 'stages', newStage.id), newStage);
    } catch (error) {
        console.error("Error adding stage:", error);
    }
  };

  const handleDeleteStage = async (id: string) => {
    if(!window.confirm("Bạn có chắc chắn muốn xóa giai đoạn này?")) return;
    try {
        const db = getFirebaseDb();
        await deleteDoc(doc(db, 'stages', id));
    } catch (error) {
        console.error("Error deleting stage:", error);
    }
  };

  const handleUpdateStageStatus = async (id: string, status: StageStatus) => {
    const db = getFirebaseDb();
    await updateDoc(doc(db, 'stages', id), { status });
  };

  const handleUpdateStageDates = async (id: string, startDate: string, endDate: string) => {
    const db = getFirebaseDb();
    await updateDoc(doc(db, 'stages', id), { startDate, endDate });
  };

  const handleUpdateStageName = async (id: string, name: string) => {
    const db = getFirebaseDb();
    await updateDoc(doc(db, 'stages', id), { name });
  };
  
  const handleUpdateStageBudget = async (id: string, budget: number) => {
    const db = getFirebaseDb();
    await updateDoc(doc(db, 'stages', id), { budget });
  };

  const handleTogglePaymentCall = async (id: string) => {
    const db = getFirebaseDb();
    const stage = stages.find(s => s.id === id);
    if (!stage) return;

    if (stage.paymentCallAmount) {
         await updateDoc(doc(db, 'stages', id), { paymentCallAmount: 0 }); 
    } else {
        const amountPerPerson = stage.budget > 0 ? Math.round(stage.budget / users.length) : 0;
        await updateDoc(doc(db, 'stages', id), { paymentCallAmount: amountPerPerson });
    }
  };
  
  const handleDismissPaymentCall = async (id: string) => {
    const db = getFirebaseDb();
    await updateDoc(doc(db, 'stages', id), { paymentCallAmount: 0 });
  };

  const handleAddCost = async (costData: Omit<Cost, 'id' | 'createdAt' | 'approvedBy' | 'status'>, files: File[]) => {
    if (!currentUser) return;
    
    setIsUploading(true);
    const newId = `c${Date.now()}`;
    const attachments: Attachment[] = [];

    // 1. Upload files if any
    if (files && files.length > 0) {
      try {
        const storage = getFirebaseStorage();
        // Process files in parallel
        await Promise.all(files.map(async (file) => {
          // Unique path: costs/{costId}/{timestamp}_{filename}
          const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
          const storageRef = ref(storage, `costs/${newId}/${Date.now()}_${safeName}`);
          
          const snapshot = await uploadBytes(storageRef, file);
          const downloadURL = await getDownloadURL(snapshot.ref);
          
          attachments.push({
            id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: file.name,
            url: downloadURL,
            type: file.type,
            size: file.size
          });
        }));
      } catch (error) {
        console.error("Error uploading files:", error);
        alert("Lỗi khi tải chứng từ. Vui lòng kiểm tra lại kết nối hoặc dung lượng file.");
        setIsUploading(false);
        return; // Stop process if upload fails
      }
    }

    // 2. Save Cost Data
    const newCost: Cost = {
      ...costData,
      id: newId,
      createdAt: Date.now(),
      status: 'PENDING',
      approvedBy: [currentUser.id],
      interestRate: 0, // FORCE 0 Interest
      attachments: attachments
    };

    try {
        const db = getFirebaseDb();
        await setDoc(doc(db, 'costs', newCost.id), newCost);
    } catch (e) {
        console.error("Error adding cost", e);
        alert("Lỗi lưu dữ liệu chi phí.");
    } finally {
        setIsUploading(false);
    }
  };
  
  const handleUploadAttachments = async (costId: string, files: File[]) => {
    if (!currentUser || files.length === 0) return;
    
    setIsUploading(true);
    try {
        const storage = getFirebaseStorage();
        const newAttachments: Attachment[] = [];

        await Promise.all(files.map(async (file) => {
            const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
            const storageRef = ref(storage, `costs/${costId}/${Date.now()}_${safeName}`);
            
            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);
            
            newAttachments.push({
                id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                name: file.name,
                url: downloadURL,
                type: file.type,
                size: file.size
            });
        }));

        const db = getFirebaseDb();
        await updateDoc(doc(db, 'costs', costId), {
            attachments: arrayUnion(...newAttachments)
        });
    } catch (error) {
        console.error("Error uploading extra files:", error);
        alert("Lỗi khi bổ sung chứng từ.");
    } finally {
        setIsUploading(false);
    }
  };

  const handleApproveCost = async (costId: string) => {
    if (!currentUser) return;
    const cost = costs.find(c => c.id === costId);
    if (!cost) return;
    if (cost.approvedBy.includes(currentUser.id)) return;

    const newApprovals = [...cost.approvedBy, currentUser.id];
    const isFullyApproved = newApprovals.length >= users.length;
    
    const db = getFirebaseDb();
    await updateDoc(doc(db, 'costs', costId), {
        approvedBy: newApprovals,
        status: isFullyApproved ? 'APPROVED' : 'PENDING'
    });
  };

  const handlePayment = async (costId: string, debtorId: string, amount: number, interest: number, paidDate: string) => {
    const cost = costs.find(c => c.id === costId);
    if (!cost) return;

    const newAllocations = cost.allocations.map(a => {
        if (a.userId !== debtorId) return a;
        const newPayment: Payment = {
          id: `p${Date.now()}`,
          amount: amount,
          interest: 0, // FORCE 0 Interest
          date: paidDate
        };
        const newPaidAmount = (a.paidAmount || 0) + amount;
        const isPaid = newPaidAmount >= a.amount - 100;
        return { 
          ...a, 
          paidAmount: newPaidAmount,
          payments: [...(a.payments || []), newPayment],
          isPaid: isPaid
        };
    });

    const db = getFirebaseDb();
    await updateDoc(doc(db, 'costs', costId), { allocations: newAllocations });
  };

  const handleUpdateDefaultSettings = (newRate: number) => {
    // Interest is removed, so this does nothing or just updates local state
  };

  const handleAddTopic = async (title: string) => {
      if (!currentUser) return;
      const newTopic: Topic = {
          id: `t${Date.now()}`,
          creatorId: currentUser.id,
          title,
          createdAt: Date.now(),
          status: TopicStatus.VOTING,
          votes: [{ userId: currentUser.id, type: 'LIKE' }],
          comments: [],
          readyToSpin: []
      };
      const db = getFirebaseDb();
      await setDoc(doc(db, 'topics', newTopic.id), newTopic);
  };

  const handleAddTopicComment = async (topicId: string, content: string) => {
      if (!currentUser) return;
      const topic = topics.find(t => t.id === topicId);
      if(!topic) return;

      const newComment: TopicComment = {
          id: `cm${Date.now()}`,
          userId: currentUser.id,
          content,
          createdAt: Date.now()
      };
      const newComments = [...(topic.comments || []), newComment];
      
      const db = getFirebaseDb();
      await updateDoc(doc(db, 'topics', topicId), { comments: newComments });
  };

  const handleVote = async (topicId: string, type: 'LIKE' | 'DISLIKE') => {
      if (!currentUser) return;
      const topic = topics.find(t => t.id === topicId);
      if (!topic) return;
      if (topic.status !== TopicStatus.VOTING && topic.status !== TopicStatus.CONFLICT) return;

      const existingVoteIndex = topic.votes.findIndex(v => v.userId === currentUser.id);
      let newVotes = [...topic.votes];
      
      if (existingVoteIndex >= 0) {
          newVotes[existingVoteIndex] = { userId: currentUser.id, type };
      } else {
          newVotes.push({ userId: currentUser.id, type });
      }

      // Calculate Status
      const totalUsers = users.length;
      const likeCount = newVotes.filter(v => v.type === 'LIKE').length;
      const dislikeCount = newVotes.filter(v => v.type === 'DISLIKE').length;
      const totalVotes = newVotes.length;
      
      let newStatus = topic.status;
      let finalMethod = topic.finalDecisionMethod;

      if (likeCount === totalUsers) {
          newStatus = TopicStatus.APPROVED;
          finalMethod = 'CONSENSUS';
      }
      else if (dislikeCount === totalUsers) {
          newStatus = TopicStatus.REJECTED;
      }
      else if (totalVotes === totalUsers) {
          newStatus = TopicStatus.CONFLICT;
      }
      else {
          newStatus = TopicStatus.VOTING;
      }

      const db = getFirebaseDb();
      // Need to strip undefined if finalMethod is undefined (Firestore doesn't like undefined)
      const updatePayload: any = {
          votes: newVotes,
          status: newStatus
      };
      if (finalMethod) updatePayload.finalDecisionMethod = finalMethod;

      await updateDoc(doc(db, 'topics', topicId), updatePayload);
  };

  const handleToggleReadyToSpin = async (topicId: string) => {
      if (!currentUser) return;
      const topic = topics.find(t => t.id === topicId);
      if (!topic) return;
      
      const isReady = topic.readyToSpin.includes(currentUser.id);
      let newReadyList;
      if (isReady) {
          newReadyList = topic.readyToSpin.filter(id => id !== currentUser.id);
      } else {
          newReadyList = [...topic.readyToSpin, currentUser.id];
      }
      
      const db = getFirebaseDb();
      await updateDoc(doc(db, 'topics', topicId), { readyToSpin: newReadyList });
  };

  const handleSpinDecision = async (topicId: string, approved: boolean) => {
      const db = getFirebaseDb();
      await updateDoc(doc(db, 'topics', topicId), {
          status: approved ? TopicStatus.APPROVED : TopicStatus.REJECTED,
          finalDecisionMethod: 'RANDOM_SPIN',
          readyToSpin: []
      });
  };

  // FAB Trung tâm giờ đây điều khiển AI
  const handleFABClick = () => {
    setIsChatOpen(prev => !prev);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
      if (!chatInput.trim() || isTyping || !currentUser) return;
      const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: chatInput, timestamp: Date.now() };
      setChatMessages(prev => [...prev, userMsg]);
      setChatInput('');
      setIsTyping(true);
      const context = { stages: stagesWithCalculatedCosts, costs, debts, users };
      const answer = await chatWithFinancialAssistant(
          userMsg.text, context, currentUser, 
          chatMessages.map(m => ({role: m.role, text: m.text}))
      );
      const botMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'model', text: answer, timestamp: Date.now() };
      setChatMessages(prev => [...prev, botMsg]);
      setIsTyping(false);
  };

  // 4. Main App Render Logic
  const renderContent = () => {
    // 1. Check if Firebase Config is missing
    if (!isFirebaseReady) {
        return <FirebaseConfigModal onSuccess={() => window.location.reload()} />;
    }

    // 2. Loading Auth State
    if (initializing) {
        return (
            <div className="h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="w-10 h-10 text-primary-600 animate-spin" />
            </div>
        )
    }

    // 3. Not Logged In
    if (!currentUser) {
        return (
          <div className="relative">
             <Login />
             <button 
                onClick={handleResetConfig}
                className="fixed bottom-4 right-4 p-2 bg-slate-800 text-slate-400 rounded-full hover:text-white transition opacity-50 hover:opacity-100 z-50"
                title="Reset Firebase Config"
             >
                <Settings2 className="w-4 h-4" />
             </button>
          </div>
        );
    }

    // 4. Determine Active View Component
    let contentEl;
    switch (view) {
        case 'TIMELINE':
        contentEl = (
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
        break;
        case 'ACTIVITY':
        contentEl = (
            <ActivityLog 
            costs={costs}
            users={users}
            stages={stagesWithCalculatedCosts}
            />
        );
        break;
        case 'DISCUSSION':
        contentEl = (
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
        break;
        case 'DASHBOARD':
        default:
        contentEl = (
            <FinancialDashboard 
            costs={costs}
            debts={debts}
            users={users}
            currentUser={currentUser}
            stages={stagesWithCalculatedCosts}
            defaultInterestRate={0} // Force 0
            onUpdateDefaultSettings={handleUpdateDefaultSettings}
            onAddCost={handleAddCost}
            onApproveCost={handleApproveCost}
            onMarkAsPaid={handlePayment}
            onDismissPaymentCall={handleDismissPaymentCall}
            onUploadAttachments={handleUploadAttachments}
            externalShowAddForm={showAddCostModal}
            setExternalShowAddForm={setShowAddCostModal}
            />
        );
        break;
    }

    const NavButton = ({ active, onClick, icon: Icon, label }: any) => (
      <button 
        onClick={onClick}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-semibold ${active ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/30' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
      >
        <Icon className="w-5 h-5 flex-shrink-0" />
        <span className="text-sm">{label}</span>
      </button>
    );

    const MobileNavButton = ({ active, onClick, icon: Icon, label }: any) => (
       <button 
         onClick={onClick}
         className={`flex-1 flex flex-col items-center justify-center py-1 gap-1 transition-all duration-300 ${active ? 'text-primary-600' : 'text-slate-400 hover:text-slate-600'}`}
       >
          <div className={`p-1.5 rounded-2xl transition-all ${active ? 'bg-primary-50' : 'bg-transparent'}`}>
             <Icon className={`w-6 h-6 ${active ? 'fill-current' : 'stroke-2'}`} strokeWidth={active ? 0 : 2} />
          </div>
          <span className="text-[10px] font-bold">{label}</span>
       </button>
    );

    return (
        <div className="min-h-screen flex flex-col md:flex-row bg-slate-100 relative font-sans">
          {/* Global Loading Overlay (for Uploads) */}
          {isUploading && (
              <div className="fixed inset-0 bg-slate-900/80 z-[200] flex flex-col items-center justify-center text-white backdrop-blur-sm">
                  <Loader2 className="w-12 h-12 animate-spin mb-3 text-primary-400" />
                  <p className="font-bold text-lg">Đang tải chứng từ lên...</p>
                  <p className="text-sm text-slate-300">Vui lòng không tắt trình duyệt.</p>
              </div>
          )}
    
          {/* DESKTOP Sidebar */}
          <aside className="hidden md:flex w-72 bg-slate-900 text-slate-300 flex-shrink-0 flex-col h-screen sticky top-0 overflow-y-auto border-r border-slate-800">
            <div className="p-8 pb-4 flex items-center gap-3">
               <img src={APP_LOGO} alt="Logo" className="w-10 h-10 object-contain bg-white rounded-xl p-1 shadow-md" />
               <div>
                   <h1 className="text-2xl font-extrabold text-white tracking-tight">HTTP Home</h1>
                   <p className="text-xs text-slate-500 font-medium tracking-wide">FINANCE & BUILD</p>
               </div>
            </div>
    
            <nav className="flex-1 px-4 space-y-2 mt-6">
               <NavButton active={view === 'DASHBOARD'} onClick={() => setView('DASHBOARD')} icon={LayoutGrid} label="Tổng quan" />
               <NavButton active={view === 'TIMELINE'} onClick={() => setView('TIMELINE')} icon={Calendar} label="Tiến độ" />
               <NavButton active={view === 'ACTIVITY'} onClick={() => setView('ACTIVITY')} icon={History} label="Nhật ký" />
               <NavButton active={view === 'DISCUSSION'} onClick={() => setView('DISCUSSION')} icon={Users} label="Hội nghị" />
            </nav>
    
            {/* User Info Footer */}
            <div className="p-4 border-t border-slate-800">
               <div className="flex items-center gap-3 px-3 py-3 rounded-2xl bg-slate-800 border border-slate-700 shadow-sm">
                   <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-xs font-bold flex-shrink-0 text-white shadow-inner border border-white/20">
                       {currentUser.avatar}
                   </div>
                   <div className="min-w-0 flex-1">
                       <div className="text-sm font-bold text-white truncate">{currentUser.name}</div>
                       <div className="text-[10px] text-slate-400 truncate">{currentUser.email}</div>
                   </div>
                   <button 
                        onClick={handleLogout}
                        className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-700 transition"
                        title="Đăng xuất"
                    >
                        <LogOut className="w-4 h-4" />
                   </button>
               </div>
            </div>
          </aside>
    
          {/* Main Content */}
          <main className="flex-1 w-full max-w-[100vw] overflow-hidden flex flex-col h-screen">
            {/* Desktop Header */}
            <header className="hidden md:flex bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 py-4 justify-between items-center sticky top-0 z-20">
               <div>
                 <h2 className="text-xl font-bold text-slate-800">
                   {view === 'DASHBOARD' && 'Tổng quan tài chính'}
                   {view === 'TIMELINE' && 'Tiến độ dự án'}
                   {view === 'ACTIVITY' && 'Nhật ký hoạt động'}
                   {view === 'DISCUSSION' && 'Hội nghị & Quy tắc'}
                 </h2>
               </div>
               
               <button 
                 onClick={() => setShowPersonalReport(true)}
                 className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 hover:text-slate-900 transition-all font-semibold text-sm"
               >
                 <FileBarChart className="w-4 h-4" />
                 <span>Báo cáo cá nhân</span>
               </button>
            </header>
    
            {/* Content Area - Scrollable */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8 space-y-6 pb-32 md:pb-8 scroll-smooth">
               {/* Mobile Header Logo */}
               <div className="md:hidden flex items-center justify-between mb-2">
                   <div className="flex items-center gap-2">
                        <img src={APP_LOGO} alt="Logo" className="w-8 h-8 rounded-lg bg-white p-1 shadow-sm border border-slate-100" />
                        <h1 className="font-extrabold text-slate-800 text-lg">HTTP Home</h1>
                   </div>
                   <div onClick={() => setShowPersonalReport(true)} className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center cursor-pointer overflow-hidden border border-slate-300">
                      {currentUser.avatar && <span className="text-xs font-bold text-slate-600">{currentUser.avatar}</span>}
                   </div>
               </div>

               {contentEl}
            </div>

            {/* MOBILE BOTTOM NAVIGATION BAR */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-[0_-5px_20px_rgba(0,0,0,0.05)] px-4 pt-2 pb-safe-bottom z-30 flex items-center justify-between">
                <MobileNavButton active={view === 'DASHBOARD'} onClick={() => setView('DASHBOARD')} icon={LayoutGrid} label="Home" />
                <MobileNavButton active={view === 'TIMELINE'} onClick={() => setView('TIMELINE')} icon={Calendar} label="Tiến độ" />
                
                {/* FAB (Floating Action Button) - GIỜ LÀ NÚT AI */}
                <div className="relative -top-6">
                    <button 
                        onClick={handleFABClick}
                        className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transform active:scale-95 transition-all border-4 border-slate-100 ${isChatOpen ? 'bg-slate-800 text-white' : 'bg-gradient-to-r from-primary-600 to-accent-500 text-white shadow-primary-500/40'}`}
                    >
                        {isChatOpen ? <X className="w-6 h-6" /> : <Sparkles className="w-8 h-8 animate-pulse" strokeWidth={2.5} />}
                    </button>
                </div>

                <MobileNavButton active={view === 'DISCUSSION'} onClick={() => setView('DISCUSSION')} icon={Users} label="Hội nghị" />
                <MobileNavButton active={view === 'ACTIVITY'} onClick={() => setView('ACTIVITY')} icon={History} label="Nhật ký" />
            </div>

          </main>
    
          {/* AI CHAT WIDGET (Toàn cục) */}
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
                  <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="p-3 bg-white border-t border-slate-100 flex gap-2">
                      <input 
                        type="text" 
                        value={chatInput} 
                        onChange={e => setChatInput(e.target.value)} 
                        placeholder="Hỏi gì đó..."
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-primary-500"
                      />
                      <button type="submit" disabled={!chatInput.trim()} className="p-2 bg-primary-600 text-white rounded-full hover:bg-primary-700 disabled:opacity-50">
                          <Send className="w-4 h-4" />
                      </button>
                  </form>
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
  };

  return renderContent();
}
