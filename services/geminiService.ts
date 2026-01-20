
import { GoogleGenAI } from "@google/genai";
import { Cost, Stage, DebtRecord, User } from "../types";
import { formatCurrency, formatDate } from "../utils/finance";

const getAIClient = () => {
    let apiKey = "";
    
    // 1. Try checking Vite environment variables (Standard approach)
    try {
        const env = (import.meta as any).env;
        if (env) {
            // Prioritize VITE_API_KEY as it's the standard for exposed vars in Vite
            apiKey = env.VITE_API_KEY || env.API_KEY || "";
        }
    } catch (e) {
        // Ignore error if import.meta is not available
    }

    // 2. Fallback to process.env (Node/Webpack environments) if not found yet
    if (!apiKey && typeof process !== 'undefined' && process.env) {
        apiKey = process.env.API_KEY || process.env.VITE_API_KEY || "";
    }

    if (!apiKey) {
        console.error("Gemini API Key not found. Please set VITE_API_KEY in your .env file.");
        return null;
    }
    
    return new GoogleGenAI({ apiKey });
};

interface FinancialContext {
    stages: Stage[];
    costs: Cost[];
    debts: DebtRecord[];
    users: User[];
}

// Helper to sanitize data and map IDs to Names for easier AI understanding
const prepareContextForAI = (context: FinancialContext) => {
    const userMap = context.users.reduce((acc, u) => ({ ...acc, [u.id]: u.name }), {} as Record<string, string>);
    const stageMap = context.stages.reduce((acc, s) => ({ ...acc, [s.id]: s.name }), {} as Record<string, string>);

    return {
        users: context.users.map(u => u.name),
        stages: context.stages.map(s => ({
            name: s.name,
            status: s.status,
            budget: formatCurrency(s.budget),
            totalSpent: formatCurrency(s.totalCost),
            startDate: s.startDate,
            endDate: s.endDate
        })),
        debts: context.debts.map(d => ({
            debtor: userMap[d.debtorId],
            creditor: userMap[d.creditorId],
            totalDebt: formatCurrency(d.totalDebt),
            principal: formatCurrency(d.principal),
            interest: formatCurrency(d.interest),
            details: d.details.map(det => ({
                description: det.description,
                date: formatDate(det.dateIncurred),
                daysOverdue: det.daysOverdue,
                interestRate: det.interestRate + '%'
            }))
        })),
        recentTransactions: context.costs.slice(0, 20).map(c => ({
            description: c.description,
            amount: formatCurrency(c.amount),
            payer: userMap[c.payerId],
            date: formatDate(c.date),
            stage: stageMap[c.stageId],
            status: c.status
        }))
    };
};

export const chatWithFinancialAssistant = async (
    userQuestion: string, 
    context: FinancialContext,
    currentUser: User, // Added currentUser parameter
    chatHistory: {role: 'user' | 'model', text: string}[]
): Promise<string> => {
    const ai = getAIClient();
    if (!ai) return "Lỗi: Thiếu API Key. Vui lòng tạo file .env và thêm VITE_API_KEY=... vào thư mục gốc.";

    const cleanData = prepareContextForAI(context);
    const dataString = JSON.stringify(cleanData, null, 2);

    const systemInstruction = `
    Bạn là Kế toán trưởng kiêm Trợ lý ảo cho dự án xây nhà 'HTTP Home'.
    
    --- THÔNG TIN NGƯỜI DÙNG HIỆN TẠI (CONTEXT) ---
    Người đang trò chuyện với bạn là: **${currentUser.name}** (ID: ${currentUser.id}).
    Vai trò: ${currentUser.role}.
    
    **QUY TẮC QUAN TRỌNG:**
    Khi người dùng xưng hô "tôi", "mình", "của tôi", "em", "anh"... hãy hiểu là họ đang hỏi về dữ liệu của chính **${currentUser.name}**.
    Ví dụ: Nếu họ hỏi "Tôi còn nợ bao nhiêu?", hãy tìm công nợ của **${currentUser.name}** để trả lời.
    -----------------------------------------------

    Nhiệm vụ của bạn là trả lời các câu hỏi về tài chính, công nợ và tiến độ dựa trên DỮ LIỆU ĐƯỢC CUNG CẤP dưới đây.

    --- DỮ LIỆU DỰ ÁN (LIVE DATA) ---
    ${dataString}
    ---------------------------------

    QUY TẮC TRẢ LỜI:
    1. **CHỈ** sử dụng thông tin từ phần "DỮ LIỆU DỰ ÁN" ở trên. KHÔNG được tự bịa ra số liệu.
    2. Nếu dữ liệu không có thông tin người dùng hỏi, hãy trả lời: "Dữ liệu hiện tại chưa có thông tin này" hoặc hỏi thêm chi tiết để người dùng làm rõ.
    3. Khi nói về tiền, luôn kèm đơn vị VND hoặc định dạng tiền tệ dễ đọc.
    4. Giọng điệu: Chuyên nghiệp nhưng thân thiện, ngắn gọn, súc tích.
    5. Nếu hỏi về "ai nợ ai", hãy trích xuất từ phần 'debts'.
    6. Nếu hỏi về "tiến độ" hoặc "ngân sách", hãy xem phần 'stages'.
    7. Câu trả lời cần định dạng Markdown (in đậm số tiền, danh sách gạch đầu dòng) để dễ đọc.

    Ví dụ:
    User: "Tình hình nợ nần thế nào?"
    Bot: "Hiện tại: 
    - **TamTrang** đang nợ **TuanChom**: **50.000.000 đ** (trong đó lãi là 200k).
    - **Phi** không có khoản nợ nào."
    `;

    try {
        // We construct a fresh chat every time to ensure the System Instruction has the LATEST data.
        // We append the previous short history to keep conversation flow.
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [
                ...chatHistory.map(msg => ({
                    role: msg.role,
                    parts: [{ text: msg.text }]
                })),
                {
                    role: 'user',
                    parts: [{ text: userQuestion }]
                }
            ],
            config: {
                systemInstruction: systemInstruction,
            }
        });

        return response.text || "Xin lỗi, tôi không thể phân tích dữ liệu lúc này.";
    } catch (error) {
        console.error("Gemini Error:", error);
        return "Đã xảy ra lỗi kết nối với trợ lý AI. (Kiểm tra API Key hoặc mạng)";
    }
};
