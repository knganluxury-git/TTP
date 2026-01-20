
import React, { useState, useMemo, useEffect } from 'react';
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
import { LayoutDashboard, Calendar, History, FileText, Users, LogOut, Loader2, Settings2 } from 'lucide-react';
import { tryInitFirebase, getFirebaseAuth, getFirebaseDb, resetFirebaseConfig, getFirebaseStorage } from './firebaseConfig';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, query, orderBy, arrayUnion } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export default function App() {
  // --- Config & Auth State ---
  const [isFirebaseReady, setIsFirebaseReady] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // --- App Data State ---
  const [users] = useState<User[]>(INITIAL_USERS);
  const [stages, setStages] = useState<Stage[]>([]); // Initialize empty, load from DB
  const [costs, setCosts] = useState<Cost[]>([]);    // Initialize empty, load from DB
  const [topics, setTopics] = useState<Topic[]>([]); // Initialize empty, load from DB
  
  const [view, setView] = useState<'DASHBOARD' | 'TIMELINE' | 'ACTIVITY' | 'DISCUSSION'>('DASHBOARD');
  const [showPersonalReport, setShowPersonalReport] = useState(false);
  
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
        // Sort specifically by ID or created date if needed, though orderBy above helps
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
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
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
            />
        );
        break;
    }

    const NavButton = ({ active, onClick, icon: Icon, label }: any) => (
      <button 
        onClick={onClick}
        className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors whitespace-nowrap ${active ? 'bg-blue-700 text-white shadow-lg shadow-blue-900/50' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
      >
        <Icon className="w-5 h-5 flex-shrink-0" />
        <span className="font-medium">{label}</span>
      </button>
    );

    return (
        <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 relative">
          {/* Global Loading Overlay (for Uploads) */}
          {isUploading && (
              <div className="fixed inset-0 bg-black/60 z-[200] flex flex-col items-center justify-center text-white backdrop-blur-sm">
                  <Loader2 className="w-12 h-12 animate-spin mb-3 text-blue-400" />
                  <p className="font-bold text-lg">Đang tải chứng từ lên...</p>
                  <p className="text-sm text-slate-300">Vui lòng không tắt trình duyệt.</p>
              </div>
          )}

          {/* MOBILE Header */}
          <header className="md:hidden bg-slate-900 text-white sticky top-0 z-30 shadow-md">
             <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-2">
                   <img src={APP_LOGO} alt="HTTP Home" className="w-8 h-8 object-contain" />
                   <h1 className="text-lg font-bold tracking-tight">HTTP Home</h1>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-slate-800 rounded-full pl-3 pr-1 py-1 border border-slate-700">
                       <span className="text-xs font-medium max-w-[80px] truncate">{currentUser.name}</span>
                       <div className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center text-[10px] font-bold">
                          {currentUser.avatar}
                       </div>
                    </div>
                    <button onClick={handleLogout} className="p-2 bg-slate-800 rounded-full text-slate-300 hover:text-white">
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
             </div>
             {/* Mobile Nav Tabs - Updated Active Color */}
             <nav className="flex px-4 pb-0 gap-1 overflow-x-auto no-scrollbar border-t border-slate-800">
                 <button 
                   onClick={() => setView('DASHBOARD')}
                   className={`flex-1 flex items-center justify-center gap-2 py-3 border-b-2 transition-colors whitespace-nowrap px-2 ${view === 'DASHBOARD' ? 'border-blue-500 text-white' : 'border-transparent text-slate-400'}`}
                 >
                    <LayoutDashboard className="w-4 h-4" />
                    <span className="text-sm font-medium">Tài chính</span>
                 </button>
                 <button 
                   onClick={() => setView('TIMELINE')}
                   className={`flex-1 flex items-center justify-center gap-2 py-3 border-b-2 transition-colors whitespace-nowrap px-2 ${view === 'TIMELINE' ? 'border-blue-500 text-white' : 'border-transparent text-slate-400'}`}
                 >
                    <Calendar className="w-4 h-4" />
                    <span className="text-sm font-medium">Tiến độ</span>
                 </button>
                 <button 
                   onClick={() => setView('ACTIVITY')}
                   className={`flex-1 flex items-center justify-center gap-2 py-3 border-b-2 transition-colors whitespace-nowrap px-2 ${view === 'ACTIVITY' ? 'border-blue-500 text-white' : 'border-transparent text-slate-400'}`}
                 >
                    <History className="w-4 h-4" />
                    <span className="text-sm font-medium">Nhật ký</span>
                 </button>
                 <button 
                   onClick={() => setView('DISCUSSION')}
                   className={`flex-1 flex items-center justify-center gap-2 py-3 border-b-2 transition-colors whitespace-nowrap px-2 ${view === 'DISCUSSION' ? 'border-blue-500 text-white' : 'border-transparent text-slate-400'}`}
                 >
                    <Users className="w-4 h-4" />
                    <span className="text-sm font-medium">Hội nghị</span>
                 </button>
             </nav>
          </header>
    
          {/* DESKTOP Sidebar */}
          <aside className="hidden md:flex w-64 bg-slate-900 text-slate-300 flex-shrink-0 flex-col h-screen sticky top-0 overflow-y-auto">
            <div className="p-6 flex items-center gap-3">
               <img src={APP_LOGO} alt="Logo" className="w-10 h-10 object-contain bg-white rounded-lg p-1" />
               <div>
                   <h1 className="text-2xl font-bold text-white tracking-tight">HTTP Home</h1>
                   <p className="text-xs text-slate-500 mt-1">Quản lý dự án</p>
               </div>
            </div>
    
            <nav className="flex-1 px-4 space-y-2">
               <NavButton active={view === 'DASHBOARD'} onClick={() => setView('DASHBOARD')} icon={LayoutDashboard} label="Tài chính" />
               <NavButton active={view === 'TIMELINE'} onClick={() => setView('TIMELINE')} icon={Calendar} label="Tiến độ" />
               <NavButton active={view === 'ACTIVITY'} onClick={() => setView('ACTIVITY')} icon={History} label="Nhật ký" />
               <NavButton active={view === 'DISCUSSION'} onClick={() => setView('DISCUSSION')} icon={Users} label="Hội nghị" />
            </nav>
    
            {/* User Info Footer */}
            <div className="p-4 border-t border-slate-800">
               <div className="flex items-center gap-3 px-3 py-2 rounded-md bg-slate-800/50">
                   <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0 text-white shadow-sm">
                       {currentUser.avatar}
                   </div>
                   <div className="min-w-0">
                       <div className="text-sm font-bold text-white truncate">{currentUser.name}</div>
                       <div className="text-[10px] text-slate-400 truncate">{currentUser.email}</div>
                   </div>
               </div>
               <div className="flex items-center gap-2 mt-3">
                    <button 
                        onClick={handleLogout}
                        className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
                    >
                        <LogOut className="w-3 h-3" /> Đăng xuất
                    </button>
                    <button 
                        onClick={handleResetConfig}
                        className="p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded transition"
                        title="Reset Firebase Config"
                    >
                        <Settings2 className="w-3 h-3" />
                    </button>
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
                 className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 hover:shadow-lg transition-all"
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
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border border-blue-100 text-blue-600 rounded-xl shadow-sm font-medium"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Xem báo cáo cá nhân của bạn</span>
                  </button>
               </div>
    
               {contentEl}
            </div>
          </main>
    
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
