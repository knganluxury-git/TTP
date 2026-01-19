
import React, { useState } from 'react';
import { initFirebaseManual } from '../firebaseConfig';
import { Settings, ShieldCheck, AlertCircle } from 'lucide-react';

interface FirebaseConfigModalProps {
    onSuccess: () => void;
}

export const FirebaseConfigModal: React.FC<FirebaseConfigModalProps> = ({ onSuccess }) => {
    const [jsonInput, setJsonInput] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        try {
            // Flexible parsing: Handle standard JSON or JS object style just in case
            const cleanInput = jsonInput.trim();
            if (!cleanInput) {
                setError('Vui lòng nhập nội dung cấu hình.');
                return;
            }

            const config = JSON.parse(cleanInput);
            
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
        } catch (err) {
            setError('Định dạng JSON không hợp lệ. Hãy copy toàn bộ object từ Firebase Console.');
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900 z-[100] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
                <div className="bg-slate-800 p-6 flex items-center gap-4 text-white">
                    <div className="p-3 bg-indigo-500 rounded-lg">
                        <Settings className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">Cấu hình Hệ thống</h2>
                        <p className="text-slate-300 text-sm">Kết nối cơ sở dữ liệu để bắt đầu</p>
                    </div>
                </div>

                <div className="p-6">
                    <div className="mb-4 bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-800 flex items-start gap-2">
                        <ShieldCheck className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <div>
                            Ứng dụng chưa tìm thấy cấu hình Firebase. Vui lòng nhập <strong>firebaseConfig</strong> của bạn để tiếp tục. 
                            <br/><span className="text-xs opacity-80 mt-1 block">Thông tin này sẽ được lưu an toàn trong trình duyệt của bạn.</span>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="mb-4">
                            <label className="block text-sm font-bold text-slate-700 mb-2">
                                Dán mã JSON Firebase Config
                            </label>
                            <textarea 
                                value={jsonInput}
                                onChange={(e) => setJsonInput(e.target.value)}
                                className="w-full h-40 p-4 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700"
                                placeholder={`{
  "apiKey": "AIza...",
  "authDomain": "...",
  "projectId": "...",
  ...
}`}
                            />
                        </div>

                        {error && (
                            <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" />
                                {error}
                            </div>
                        )}

                        <button 
                            type="submit"
                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-200"
                        >
                            Kết nối & Khởi động
                        </button>
                    </form>
                    
                    <div className="mt-4 text-center">
                        <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline">
                            Lấy mã này ở đâu? (Firebase Console &rarr; Project Settings)
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};
