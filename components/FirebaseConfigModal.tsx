
import React, { useState } from 'react';
import { initFirebaseManual } from '../firebaseConfig';
import { Settings, ShieldCheck, AlertCircle, HelpCircle, Check } from 'lucide-react';

interface FirebaseConfigModalProps {
    onSuccess: () => void;
}

export const FirebaseConfigModal: React.FC<FirebaseConfigModalProps> = ({ onSuccess }) => {
    const [jsonInput, setJsonInput] = useState('');
    const [error, setError] = useState('');
    const [showHelp, setShowHelp] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        try {
            let cleanInput = jsonInput.trim();
            if (!cleanInput) {
                setError('Vui lòng nhập nội dung cấu hình.');
                return;
            }

            // 1. Remove comments if any (//...)
            cleanInput = cleanInput.replace(/\/\/.*$/gm, '');

            // 2. Strip variable declaration if present (const firebaseConfig = ...)
            cleanInput = cleanInput.replace(/const\s+\w+\s*=\s*/, '');
            cleanInput = cleanInput.replace(/;$/, '');

            // 3. Find the object boundaries
            const firstBrace = cleanInput.indexOf('{');
            const lastBrace = cleanInput.lastIndexOf('}');
            
            if (firstBrace === -1 || lastBrace === -1) {
                 throw new Error("Không tìm thấy dấu ngoặc nhọn { } chứa cấu hình.");
            }
            
            cleanInput = cleanInput.substring(firstBrace, lastBrace + 1);

            let config;
            try {
                // Try parsing as standard JSON
                config = JSON.parse(cleanInput);
            } catch (jsonErr) {
                // Fallback: Try to fix JavaScript Object syntax to JSON
                // 1. Quote unquoted keys:  apiKey: "..."  ->  "apiKey": "..."
                let fixedJson = cleanInput.replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":');
                // 2. Remove trailing commas:  "...", }  ->  "..." }
                fixedJson = fixedJson.replace(/,(\s*})/g, '$1');
                // 3. Replace single quotes with double quotes for values
                fixedJson = fixedJson.replace(/'/g, '"');
                
                try {
                    config = JSON.parse(fixedJson);
                } catch (e2) {
                    throw new Error("Định dạng không hợp lệ. Hãy đảm bảo bạn copy đúng đoạn mã trong dấu { }.");
                }
            }
            
            // Basic validation
            if (!config.apiKey || !config.authDomain) {
                setError('Cấu hình thiếu apiKey hoặc authDomain.');
                return;
            }

            const success = initFirebaseManual(config);
            if (success) {
                onSuccess();
            } else {
                setError('Không thể kết nối Firebase với cấu hình này.');
            }
        } catch (err: any) {
            setError(err.message || 'Lỗi xử lý mã cấu hình.');
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/95 z-[100] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[90vh]">
                <div className="bg-slate-800 p-6 flex items-center gap-4 text-white flex-shrink-0">
                    <div className="p-3 bg-blue-600 rounded-lg shadow-lg shadow-blue-500/30">
                        <Settings className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">Cấu hình Hệ thống</h2>
                        <p className="text-slate-300 text-sm">Kết nối cơ sở dữ liệu để bắt đầu</p>
                    </div>
                </div>

                <div className="p-6 overflow-y-auto">
                    {!showHelp ? (
                        <>
                            <div className="mb-4 bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-800 flex items-start gap-2">
                                <ShieldCheck className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                <div>
                                    Ứng dụng chưa tìm thấy cấu hình. Hãy dán mã <strong>firebaseConfig</strong> vào bên dưới.
                                    <button onClick={() => setShowHelp(true)} className="text-blue-600 font-bold hover:underline ml-1">
                                        (Xem hướng dẫn lấy mã)
                                    </button>
                                </div>
                            </div>

                            <form onSubmit={handleSubmit}>
                                <div className="mb-4">
                                    <label className="block text-sm font-bold text-slate-700 mb-2 flex justify-between">
                                        <span>Dán mã vào đây</span>
                                        <span className="text-xs font-normal text-slate-400">JSON hoặc JS Object</span>
                                    </label>
                                    <textarea 
                                        value={jsonInput}
                                        onChange={(e) => setJsonInput(e.target.value)}
                                        className="w-full h-40 p-4 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 resize-none shadow-inner"
                                        placeholder={`const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "project-id.firebaseapp.com",
  projectId: "project-id",
  storageBucket: "project-id.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};`}
                                    />
                                    <p className="text-[10px] text-slate-400 mt-1 text-right">
                                        Bạn có thể copy nguyên đoạn `const firebaseConfig = ...`
                                    </p>
                                </div>

                                {error && (
                                    <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2 border border-red-100">
                                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                        {error}
                                    </div>
                                )}

                                <button 
                                    type="submit"
                                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
                                >
                                    <Check className="w-5 h-5" /> Kết nối & Khởi động
                                </button>
                            </form>
                        </>
                    ) : (
                        <div className="space-y-4">
                             <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <HelpCircle className="w-5 h-5 text-blue-600" /> Cách lấy mã cấu hình
                             </h3>
                             <ol className="list-decimal ml-5 space-y-3 text-sm text-slate-600">
                                 <li>Truy cập <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-blue-600 font-bold hover:underline">Firebase Console</a>.</li>
                                 <li>Chọn Project của bạn (hoặc tạo mới).</li>
                                 <li>Bấm vào biểu tượng <strong>Bánh răng (Settings)</strong> &rarr; <strong>Project settings</strong>.</li>
                                 <li>Kéo xuống phần <strong>Your apps</strong>. Nếu chưa có, bấm vào icon <strong>Web (&lt;/&gt;)</strong> để tạo app mới.</li>
                                 <li>Tại phần <strong>SDK setup and configuration</strong>, chọn <strong>Config</strong>.</li>
                                 <li>Copy toàn bộ nội dung trong khung code (bao gồm cả `const firebaseConfig = ...`).</li>
                             </ol>
                             <div className="p-3 bg-slate-100 rounded text-xs font-mono text-slate-500 border border-slate-200">
                                 const firebaseConfig = &#123;<br/>
                                 &nbsp;&nbsp;apiKey: "..."<br/>
                                 &nbsp;&nbsp;...<br/>
                                 &#125;;
                             </div>
                             <button 
                                onClick={() => setShowHelp(false)}
                                className="w-full py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg transition-colors"
                             >
                                Quay lại nhập mã
                             </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
