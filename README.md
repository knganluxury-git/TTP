
# Hướng Dẫn Triển Khai Ứng Dụng "Quản lý Nhà TTP" Lên Firebase

Tài liệu này hướng dẫn cách thiết lập môi trường phát triển (Local), build ứng dụng và triển khai lên Firebase Hosting.

## 1. Chuẩn bị môi trường

Trước khi bắt đầu, hãy đảm bảo bạn đã cài đặt:

*   **Node.js** (Phiên bản 18 trở lên): [Tải tại đây](https://nodejs.org/)
*   **Tài khoản Google** (để sử dụng Firebase)

## 2. Khởi tạo dự án (Local)

Vì trình duyệt không thể chạy trực tiếp file `.tsx`, chúng ta cần sử dụng **Vite** để biên dịch code.

Mở Terminal (Command Prompt/PowerShell) và chạy các lệnh sau:

```bash
# 1. Tạo dự án mới với Vite (chọn React + TypeScript)
npm create vite@latest ttp-home -- --template react-ts

# 2. Di chuyển vào thư mục dự án
cd ttp-home

# 3. Cài đặt các thư viện cần thiết
npm install lucide-react recharts @google/genai firebase
```

## 3. Sao chép mã nguồn

Bây giờ hãy sao chép nội dung các file từ mã nguồn hiện tại vào cấu trúc thư mục của Vite:

1.  **`index.html`**:
    *   Mở file `index.html` trong thư mục gốc của Vite.
    *   Thêm dòng này vào trong thẻ `<head>` để giữ nguyên giao diện Tailwind CSS:
        ```html
        <script src="https://cdn.tailwindcss.com"></script>
        ```
    *   *Lưu ý: Không cần copy phần `importmap` vì Vite sẽ tự xử lý thư viện.*

2.  **Sao chép các file code vào thư mục `src/`**:
    *   Tạo các thư mục con: `src/components`, `src/services`, `src/utils`.
    *   Sao chép nội dung các file tương ứng:
        *   `types.ts` -> `src/types.ts`
        *   `constants.ts` -> `src/constants.ts`
        *   `App.tsx` -> `src/App.tsx`
        *   `services/geminiService.ts` -> `src/services/geminiService.ts`
        *   `utils/finance.ts` -> `src/utils/finance.ts`
        *   Các file trong `components/` -> `src/components/`

## 4. Cấu hình Biến Môi trường (API Key)

Vite sử dụng `import.meta.env` thay vì `process.env`. Tuy nhiên, để tránh phải sửa code, chúng ta sẽ cấu hình Vite để hiểu `process.env`.

1.  Mở file `vite.config.ts` và sửa lại như sau:

```typescript
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY)
    }
  }
})
```

2.  Tạo file `.env` ở thư mục gốc (cung cấp API Key của bạn):

```env
API_KEY=AIzaSy... (Dán key Gemini của bạn vào đây)
```

## 5. Thiết lập Firebase Hosting

1.  Cài đặt Firebase CLI (nếu chưa có):
    ```bash
    npm install -g firebase-tools
    ```

2.  Đăng nhập Firebase:
    ```bash
    firebase login
    ```

3.  Khởi tạo dự án Firebase:
    ```bash
    firebase init
    ```
    *   Chọn: **Hosting: Configure files for Firebase Hosting and (optionally) set up GitHub Action deploys** (Dùng phím cách để chọn, Enter để xác nhận).
    *   Chọn: **Use an existing project** (nếu đã tạo trên web) hoặc **Create a new project**.
    *   **What do you want to use as your public directory?** -> Nhập: `dist`
    *   **Configure as a single-page app (rewrite all urls to /index.html)?** -> Nhập: `y`
    *   **Set up automatic builds and deploys with GitHub?** -> Nhập: `n`

## 6. Build và Triển khai (Deploy)

Sau khi thiết lập xong, thực hiện lệnh sau để đẩy ứng dụng lên mạng:

```bash
# 1. Build ứng dụng (tạo thư mục dist)
npm run build

# 2. Đẩy lên Firebase
firebase deploy
```

Sau khi chạy xong, Firebase sẽ cung cấp cho bạn một đường link (ví dụ: `https://ttp-home.web.app`).

## Lưu ý quan trọng

*   **Bảo mật API Key:** Do đây là ứng dụng Frontend thuần túy (Static Site), API Key sẽ bị lộ trong mã nguồn trên trình duyệt. Đối với các dự án thực tế cần bảo mật cao, bạn nên gọi Gemini API thông qua một Backend (ví dụ: Firebase Cloud Functions) thay vì gọi trực tiếp từ React.
*   **Cập nhật:** Mỗi khi bạn sửa code, hãy chạy lại `npm run build` và `firebase deploy`.
