
import React, { useState, useEffect, useRef } from 'react';
import { Topic, TopicStatus, User, Vote, Role, TopicComment } from '../types';
import { formatDate } from '../utils/finance';
import { Gavel, ThumbsUp, ThumbsDown, Plus, Users, Dices, Award, ScrollText, X, MessageSquare, Send, Clock, Eye, CheckCircle2 } from 'lucide-react';

interface DiscussionBoardProps {
  users: User[];
  currentUser: User;
  topics: Topic[];
  onAddTopic: (title: string) => void;
  onVote: (topicId: string, type: 'LIKE' | 'DISLIKE') => void;
  onSpinDecision: (topicId: string, approved: boolean) => void;
  onAddComment: (topicId: string, content: string) => void;
  onToggleReadyToSpin: (topicId: string) => void;
}

export const DiscussionBoard: React.FC<DiscussionBoardProps> = ({ 
  users, currentUser, topics, onAddTopic, onVote, onSpinDecision, onAddComment, onToggleReadyToSpin
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTopicTitle, setNewTopicTitle] = useState('');
  
  // Wheel Spin State
  const [spinModal, setSpinModal] = useState<{ isOpen: boolean, topicId: string | null }>({ isOpen: false, topicId: null });
  const [isSpinning, setIsSpinning] = useState(false);
  
  // Spin Logic State
  const [wheelData, setWheelData] = useState<Vote[]>([]);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [spinResult, setSpinResult] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');

  // Rule Detail Modal (History Viewing)
  const [selectedRule, setSelectedRule] = useState<Topic | null>(null);

  // Input states for comments per topic (using a map to avoid re-renders of all topics)
  const [commentInputs, setCommentInputs] = useState<{[key:string]: string}>({});

  // Auto-trigger spin when all users are ready
  useEffect(() => {
    const readyTopic = topics.find(t => t.status === TopicStatus.CONFLICT && t.readyToSpin.length === users.length);
    if (readyTopic && !spinModal.isOpen) {
        setSpinModal({ isOpen: true, topicId: readyTopic.id });
    }
  }, [topics, users.length, spinModal.isOpen]);

  // Handle the Spinning Logic (Auto Start)
  useEffect(() => {
    if (spinModal.isOpen && !isSpinning && spinResult === 'PENDING') {
       // Short delay before start
       const timer = setTimeout(() => {
           handleAutoSpin();
       }, 500);
       return () => clearTimeout(timer);
    }
  }, [spinModal.isOpen]);

  const handleAutoSpin = () => {
    if (!spinModal.topicId) return;
    const currentTopic = topics.find(t => t.id === spinModal.topicId);
    if (!currentTopic) return;

    setIsSpinning(true);
    setSpinResult('PENDING');
    
    // 1. Get Actual Votes from the Topic
    // We assume 3 users, so we expect 3 votes in conflict state.
    // If fewer, fill with random (fallback), though logic prevents this.
    let votes = [...currentTopic.votes];
    
    // Ensure 3 segments for visual balance (fill with random if missing - edge case)
    while (votes.length < 3) {
        votes.push({ userId: 'system', type: Math.random() > 0.5 ? 'LIKE' : 'DISLIKE' });
    }
    
    setWheelData(votes);

    // 2. Pick a random winner from the 3 slices
    const winnerIndex = Math.floor(Math.random() * 3);
    const winningVote = votes[winnerIndex];
    
    // 3. Calculate Rotation
    // Segment 0: 0-120deg (Center 60)
    // Segment 1: 120-240deg (Center 180)
    // Segment 2: 240-360deg (Center 300)
    
    // Since pointer is at Top (0deg), we need to rotate the wheel 
    // such that the target segment center aligns with 0deg.
    // Target Rotation = -CenterAngle.
    
    let targetCenter = 0;
    if (winnerIndex === 0) targetCenter = 60;
    else if (winnerIndex === 1) targetCenter = 180;
    else targetCenter = 300;

    // Add 5 full spins (1800deg) + alignment adjustment
    // To bring "targetCenter" to 0 (top), we rotate NEGATIVE targetCenter
    // We add randomness +/- 40deg to land randomly within the slice
    const randomOffset = (Math.random() * 80) - 40; 
    const finalRotation = 1800 + (360 - targetCenter) + randomOffset; 

    setWheelRotation(finalRotation);

    // 4. Wait for animation to finish (4s)
    setTimeout(() => {
        setIsSpinning(false);
        setSpinResult(winningVote.type === 'LIKE' ? 'APPROVED' : 'REJECTED');

        // Auto close and submit result
        setTimeout(() => {
            if (spinModal.topicId) {
                onSpinDecision(spinModal.topicId, winningVote.type === 'LIKE');
            }
            // Reset states
            setSpinModal({ isOpen: false, topicId: null });
            setSpinResult('PENDING');
            setWheelData([]);
            setWheelRotation(0);
        }, 3000);
    }, 4500); // 4s animation + 0.5s buffer
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if(newTopicTitle.trim()) {
          onAddTopic(newTopicTitle);
          setNewTopicTitle('');
          setShowAddModal(false);
      }
  };

  const handleSendComment = (topicId: string) => {
      const content = commentInputs[topicId];
      if (content && content.trim()) {
          onAddComment(topicId, content);
          setCommentInputs(prev => ({ ...prev, [topicId]: '' }));
      }
  };

  const activeTopics = topics.filter(t => t.status === TopicStatus.VOTING || t.status === TopicStatus.CONFLICT);
  const approvedRules = topics.filter(t => t.status === TopicStatus.APPROVED || t.status === TopicStatus.REJECTED).sort((a,b) => b.createdAt - a.createdAt);
  
  const getUser = (id: string) => users.find(u => u.id === id);

  return (
    <div className="space-y-8 animate-in fade-in pb-20">
      {/* 1. Header & Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
             <Users className="w-6 h-6 text-blue-600" /> Hội nghị bàn tròn
           </h2>
           <p className="text-slate-500 text-sm mt-1">Nơi thảo luận, biểu quyết và ban hành quy tắc chung.</p>
        </div>
        <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium shadow-md hover:bg-blue-700 transition"
        >
            <Plus className="w-4 h-4" /> Đề xuất mới
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* 2. Active Discussions List */}
          <div className="lg:col-span-2 space-y-6">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <Gavel className="w-4 h-4" /> Đang thảo luận ({activeTopics.length})
              </h3>
              
              {activeTopics.length === 0 && (
                  <div className="p-8 border-2 border-dashed border-slate-200 rounded-xl text-center text-slate-400">
                      Chưa có chủ đề nào đang thảo luận.
                  </div>
              )}

              {activeTopics.map(topic => {
                  const myVote = topic.votes.find(v => v.userId === currentUser.id);
                  const likeCount = topic.votes.filter(v => v.type === 'LIKE').length;
                  const dislikeCount = topic.votes.filter(v => v.type === 'DISLIKE').length;
                  const creator = getUser(topic.creatorId);
                  const isConflict = topic.status === TopicStatus.CONFLICT;
                  const isReadyToSpin = topic.readyToSpin.includes(currentUser.id);

                  return (
                      <div key={topic.id} className={`bg-white rounded-xl shadow-sm border p-0 relative overflow-hidden transition-all ${isConflict ? 'border-amber-300 ring-4 ring-amber-50' : 'border-slate-200'}`}>
                          {/* Topic Header */}
                          <div className="p-5">
                            {isConflict && (
                                <div className="absolute top-0 right-0 bg-amber-400 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider flex items-center gap-1">
                                    <Dices className="w-3 h-3" /> Tranh luận
                                </div>
                            )}

                            <div className="flex items-start gap-3 mb-4">
                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold flex-shrink-0">
                                    {creator?.avatar}
                                </div>
                                <div>
                                    <h4 className="font-bold text-lg text-slate-800 leading-snug">{topic.title}</h4>
                                    <p className="text-xs text-slate-500 mt-1">Đề xuất bởi {creator?.name} • {formatDate(topic.createdAt)}</p>
                                </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="mb-6">
                                <div className="flex justify-between text-xs text-slate-500 mb-2 font-medium">
                                    <span className="text-green-600">{likeCount} Đồng ý</span>
                                    <span className="text-red-600">{dislikeCount} Phản đối</span>
                                </div>
                                <div className="flex gap-1 h-2">
                                    {users.map((u, idx) => {
                                        const userVote = topic.votes.find(v => v.userId === u.id);
                                        let colorClass = 'bg-slate-200';
                                        if (userVote?.type === 'LIKE') colorClass = 'bg-green-500';
                                        if (userVote?.type === 'DISLIKE') colorClass = 'bg-red-500';
                                        
                                        return (
                                            <div key={u.id} className={`flex-1 rounded-full ${colorClass} transition-colors relative group`}>
                                                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none z-10">
                                                    {u.name}: {userVote ? (userVote.type === 'LIKE' ? 'Đồng ý' : 'Phản đối') : 'Chưa bỏ phiếu'}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => onVote(topic.id, 'LIKE')}
                                        disabled={isConflict} // Disable manual voting in conflict
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${myVote?.type === 'LIKE' ? 'bg-green-600 text-white shadow-md transform scale-105' : 'bg-slate-100 text-slate-600 hover:bg-green-50 hover:text-green-600 disabled:opacity-50 disabled:cursor-not-allowed'}`}
                                    >
                                        <ThumbsUp className="w-4 h-4" />
                                        Đồng ý
                                    </button>
                                    <button 
                                        onClick={() => onVote(topic.id, 'DISLIKE')}
                                        disabled={isConflict}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${myVote?.type === 'DISLIKE' ? 'bg-red-600 text-white shadow-md transform scale-105' : 'bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed'}`}
                                    >
                                        <ThumbsDown className="w-4 h-4" />
                                        Phản đối
                                    </button>
                                </div>

                                {isConflict && (
                                    <button 
                                        onClick={() => onToggleReadyToSpin(topic.id)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-all ${isReadyToSpin ? 'bg-amber-100 text-amber-700' : 'bg-amber-500 text-white hover:bg-amber-600 shadow-amber-200 animate-pulse hover:animate-none'}`}
                                    >
                                        {isReadyToSpin ? (
                                            <>
                                                <CheckCircle2 className="w-4 h-4" /> 
                                                <span>Chờ ({topic.readyToSpin.length}/{users.length})</span>
                                            </>
                                        ) : (
                                            <>
                                                <Dices className="w-4 h-4" />
                                                <span>🎲 Chấp nhận Ý Trời</span>
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                          </div>

                          {/* Chat Section */}
                          <div className="border-t border-slate-100 bg-slate-50/50">
                              {/* Message List */}
                              <div className="max-h-48 overflow-y-auto p-4 space-y-3">
                                  {topic.comments?.length === 0 && (
                                      <p className="text-center text-xs text-slate-400 italic">Chưa có thảo luận nào. Hãy bắt đầu!</p>
                                  )}
                                  {topic.comments?.map(comment => (
                                      <div key={comment.id} className="flex gap-2 text-sm">
                                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${comment.userId === currentUser.id ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'}`}>
                                              {getUser(comment.userId)?.avatar}
                                          </div>
                                          <div>
                                              <div className="flex items-center gap-2">
                                                  <span className="font-bold text-slate-700 text-xs">{getUser(comment.userId)?.name}</span>
                                                  <span className="text-[10px] text-slate-400">{formatDate(comment.createdAt)}</span>
                                              </div>
                                              <p className="text-slate-600 mt-0.5 leading-relaxed">{comment.content}</p>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                              
                              {/* Input */}
                              <div className="p-3 border-t border-slate-100 bg-white flex gap-2">
                                  <input 
                                    type="text" 
                                    value={commentInputs[topic.id] || ''}
                                    onChange={e => setCommentInputs(prev => ({...prev, [topic.id]: e.target.value}))}
                                    onKeyDown={e => e.key === 'Enter' && handleSendComment(topic.id)}
                                    placeholder="Thảo luận..."
                                    className="flex-1 bg-slate-50 border border-slate-200 rounded-full px-4 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                                  />
                                  <button 
                                    onClick={() => handleSendComment(topic.id)}
                                    disabled={!commentInputs[topic.id]?.trim()}
                                    className="p-1.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition"
                                  >
                                      <Send className="w-4 h-4" />
                                  </button>
                              </div>
                          </div>
                      </div>
                  );
              })}
          </div>

          {/* 3. The Constitution (Approved/Rejected Rules) */}
          <div className="bg-slate-900 rounded-xl p-6 text-slate-300 shadow-xl h-fit border border-slate-700">
               <div className="flex items-center gap-2 mb-6 border-b border-slate-700 pb-4">
                   <ScrollText className="w-6 h-6 text-yellow-500" />
                   <h3 className="text-lg font-bold text-white uppercase tracking-widest">Bộ Quy Tắc</h3>
               </div>

               <div className="space-y-6">
                   {approvedRules.length === 0 && <p className="text-sm italic opacity-50">Chưa có quy tắc nào.</p>}
                   {approvedRules.map((rule, idx) => (
                       <div 
                         key={rule.id} 
                         onClick={() => setSelectedRule(rule)}
                         className={`relative pl-6 group cursor-pointer hover:bg-slate-800/50 p-2 rounded-lg transition-colors -ml-2 ${rule.status === TopicStatus.REJECTED ? 'opacity-75' : ''}`}
                       >
                           <span className="absolute left-2 top-2 text-slate-600 font-serif text-2xl font-bold opacity-30">#{idx + 1}</span>
                           <p className={`font-medium leading-relaxed pr-6 ${rule.status === TopicStatus.REJECTED ? 'text-slate-400 line-through decoration-slate-600' : 'text-slate-100'}`}>{rule.title}</p>
                           <div className="flex items-center gap-2 mt-2 text-[10px] uppercase tracking-wider font-bold">
                               {rule.status === TopicStatus.REJECTED ? (
                                   <span className="text-red-400 flex items-center gap-1">
                                       <X className="w-3 h-3" /> Đã Bác bỏ
                                   </span>
                               ) : (
                                   rule.finalDecisionMethod === 'CONSENSUS' ? (
                                       <span className="text-emerald-400 flex items-center gap-1">
                                           <Award className="w-3 h-3" /> Đồng thuận 100%
                                       </span>
                                   ) : (
                                       <span className="text-amber-400 flex items-center gap-1">
                                           <Dices className="w-3 h-3" /> Ý trời phán quyết
                                       </span>
                                   )
                               )}
                               <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
                               <span className="text-slate-500">{formatDate(rule.createdAt)}</span>
                           </div>
                           <Eye className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                       </div>
                   ))}
               </div>
          </div>
      </div>

      {/* Add Topic Modal */}
      {showAddModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95">
                  <h3 className="text-lg font-bold text-slate-800 mb-4">Đề xuất chủ đề mới</h3>
                  <form onSubmit={handleCreateSubmit}>
                      <textarea 
                        className="w-full border border-slate-300 rounded-lg p-3 text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none resize-none h-32"
                        placeholder="Nhập nội dung quy định hoặc chủ đề thảo luận..."
                        value={newTopicTitle}
                        onChange={e => setNewTopicTitle(e.target.value)}
                        autoFocus
                      />
                      <div className="flex justify-end gap-3 mt-4">
                          <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg transition">Hủy</button>
                          <button type="submit" disabled={!newTopicTitle.trim()} className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition">Tạo đề xuất</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* SPIN WHEEL MODAL */}
      {spinModal.isOpen && (
           <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-4 backdrop-blur-md">
               <div className="relative mb-8">
                   {/* The Pointer (Fixed) */}
                   <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-20">
                       <div className="w-0 h-0 border-l-[15px] border-l-transparent border-r-[15px] border-r-transparent border-t-[30px] border-t-yellow-400 drop-shadow-md"></div>
                   </div>

                   {/* The Wheel */}
                   <div 
                        className="w-72 h-72 rounded-full border-8 border-white shadow-2xl overflow-hidden relative"
                        style={{ 
                            transform: `rotate(${wheelRotation}deg)`, 
                            transition: isSpinning ? 'transform 4s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none',
                            background: wheelData.length === 3 
                                ? `conic-gradient(
                                    ${wheelData[0].type === 'LIKE' ? '#22c55e' : '#ef4444'} 0deg 120deg, 
                                    ${wheelData[1].type === 'LIKE' ? '#22c55e' : '#ef4444'} 120deg 240deg, 
                                    ${wheelData[2].type === 'LIKE' ? '#22c55e' : '#ef4444'} 240deg 360deg
                                  )` 
                                : '#e2e8f0'
                        }}
                   >
                       {/* Labels inside wheel with Avatars */}
                       {/* Segment 0: 0-120 deg (Center 60) - Position: right top */}
                       <div className="absolute top-[32.5%] right-[19.7%] w-10 h-10 -translate-y-1/2 translate-x-1/2 flex items-center justify-center">
                           <div className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center font-bold text-xs shadow-md origin-center rotate-[300deg] ${wheelData[0]?.type === 'LIKE' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`} style={{ transform: `rotate(${-wheelRotation}deg)` }}>
                               {getUser(wheelData[0]?.userId)?.avatar || '?'}
                           </div>
                       </div>

                       {/* Segment 1: 120-240 deg (Center 180) - Position: bottom center */}
                       <div className="absolute bottom-[15%] left-1/2 -translate-x-1/2 w-10 h-10 flex items-center justify-center">
                           <div className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center font-bold text-xs shadow-md ${wheelData[1]?.type === 'LIKE' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`} style={{ transform: `rotate(${-wheelRotation}deg)` }}>
                               {getUser(wheelData[1]?.userId)?.avatar || '?'}
                           </div>
                       </div>

                       {/* Segment 2: 240-360 deg (Center 300) - Position: left top */}
                       <div className="absolute top-[32.5%] left-[19.7%] w-10 h-10 -translate-y-1/2 -translate-x-1/2 flex items-center justify-center">
                           <div className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center font-bold text-xs shadow-md ${wheelData[2]?.type === 'LIKE' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`} style={{ transform: `rotate(${-wheelRotation}deg)` }}>
                               {getUser(wheelData[2]?.userId)?.avatar || '?'}
                           </div>
                       </div>
                   </div>
                   
                   {/* Center Hub */}
                   <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-white rounded-full shadow-inner border-4 border-slate-200 z-10 flex items-center justify-center">
                       <Dices className="w-6 h-6 text-slate-400" />
                   </div>
               </div>

               {/* Controls / Result */}
               <div className="text-center space-y-4 max-w-xs">
                   {isSpinning ? (
                       <div className="text-white text-lg font-bold animate-pulse">Đang quyết định...</div>
                   ) : (
                       spinResult === 'PENDING' ? (
                           <div className="text-white/80 italic">Đang chuẩn bị vòng quay...</div>
                       ) : null
                   )}

                   {spinResult !== 'PENDING' && !isSpinning && (
                       <div className="animate-in zoom-in duration-500">
                           <div className={`text-4xl font-black mb-2 ${spinResult === 'APPROVED' ? 'text-green-400' : 'text-red-400'}`}>
                               {spinResult === 'APPROVED' ? 'THÔNG QUA!' : 'BÁC BỎ!'}
                           </div>
                           <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20 mt-4">
                               <p className="text-white/70 text-xs uppercase mb-2">Kết quả dựa trên lá phiếu của</p>
                               <div className="flex gap-2 justify-center">
                                   {wheelData.map((v, i) => (
                                       <div key={i} className={`flex-1 px-2 py-1.5 rounded text-xs font-bold border ${v.type === 'LIKE' ? 'bg-green-500/80 border-green-400 text-white' : 'bg-red-500/80 border-red-400 text-white'}`}>
                                           {getUser(v.userId)?.name || '#' + (i+1)}
                                       </div>
                                   ))}
                               </div>
                           </div>
                       </div>
                   )}
               </div>
           </div>
      )}

      {/* RULE DETAIL / HISTORY MODAL */}
      {selectedRule && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedRule(null)}>
              <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                  <div className="p-6 border-b border-slate-100 flex justify-between items-start">
                      <div>
                          <div className={`flex items-center gap-2 font-bold text-xs uppercase tracking-wider mb-2 ${selectedRule.status === TopicStatus.REJECTED ? 'text-red-600' : 'text-yellow-600'}`}>
                              <Award className="w-4 h-4" /> {selectedRule.status === TopicStatus.REJECTED ? 'Quyết định đã Bác bỏ' : 'Quy tắc đã thông qua'}
                          </div>
                          <h3 className="text-xl font-bold text-slate-900 leading-snug">{selectedRule.title}</h3>
                          <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                              <span>Ngày: {formatDate(selectedRule.createdAt)}</span>
                              <span>•</span>
                              <span>Đề xuất: {getUser(selectedRule.creatorId)?.name}</span>
                          </div>
                      </div>
                      <button onClick={() => setSelectedRule(null)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200">
                          <X className="w-5 h-5 text-slate-500" />
                      </button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto space-y-6">
                      {/* Voting Result */}
                      <div>
                          <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2"><Users className="w-4 h-4" /> Kết quả biểu quyết</h4>
                          <div className="flex gap-2">
                                {users.map(u => {
                                    const v = selectedRule.votes.find(vote => vote.userId === u.id);
                                    return (
                                        <div key={u.id} className={`flex-1 p-2 rounded-lg border text-center ${v?.type === 'LIKE' ? 'bg-green-50 border-green-200 text-green-700' : v?.type === 'DISLIKE' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-slate-50 border-slate-200'}`}>
                                            <div className="text-xs font-bold mb-1">{u.name}</div>
                                            <div className="text-lg">
                                                {v?.type === 'LIKE' ? <ThumbsUp className="w-5 h-5 mx-auto" /> : v?.type === 'DISLIKE' ? <ThumbsDown className="w-5 h-5 mx-auto" /> : '-'}
                                            </div>
                                        </div>
                                    )
                                })}
                          </div>
                          {selectedRule.finalDecisionMethod === 'RANDOM_SPIN' && (
                              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex flex-col gap-2 text-amber-800 text-sm">
                                  <div className="flex items-center gap-2 font-bold">
                                      <Dices className="w-5 h-5" />
                                      <span>Quyết định bởi Ý Trời</span>
                                  </div>
                                  <p className="text-xs opacity-90">Kết quả được định đoạt ngẫu nhiên do không đạt được đồng thuận.</p>
                              </div>
                          )}
                      </div>

                      {/* Chat History */}
                      <div>
                          <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Lịch sử thảo luận</h4>
                          <div className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-100">
                              {selectedRule.comments?.length === 0 ? (
                                  <p className="text-slate-400 italic text-sm text-center">Không có thảo luận nào được ghi lại.</p>
                              ) : (
                                  selectedRule.comments?.map(comment => (
                                      <div key={comment.id} className="flex gap-3 text-sm">
                                          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold flex-shrink-0 text-slate-600">
                                              {getUser(comment.userId)?.avatar}
                                          </div>
                                          <div>
                                              <div className="flex items-center gap-2">
                                                  <span className="font-bold text-slate-800">{getUser(comment.userId)?.name}</span>
                                                  <span className="text-xs text-slate-400">{formatDate(comment.createdAt)}</span>
                                              </div>
                                              <p className="text-slate-600 mt-1">{comment.content}</p>
                                          </div>
                                      </div>
                                  ))
                              )}
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
