
# Hướng Dẫn Triển Khai Ứng Dụng "Quản lý Nhà TTP" Lên Firebase

Tài liệu này hướng dẫn cách thiết lập môi trường phát triển (Local), cấu hình Authentication, build ứng dụng và triển khai lên Firebase Hosting.

## 1. Chuẩn bị môi trường

Trước khi bắt đầu, hãy đảm bảo bạn đã cài đặt:

*   **Node.js** (Phiên bản 18 trở lên): [Tải tại đây](https://nodejs.org/)
*   **Tài khoản Google** (để sử dụng Firebase)

## 2. Khởi tạo dự án (Local)

Mở Terminal (Command Prompt/PowerShell) và chạy các lệnh sau:

```bash
# 1. Tạo dự án mới với Vite (chọn React + TypeScript)
npm create vite@latest ttp-home -- --template react-ts

# 2. Di chuyển vào thư mục dự án
cd ttp-home

# 3. Cài đặt các thư viện cần thiết
npm install lucide-react recharts @google/genai firebase
```

## 3. Cấu hình Firebase & Authentication

### Bước 1: Tạo dự án Firebase Console
1. Truy cập [Firebase Console](https://console.firebase.google.com/).
2. Tạo dự án mới (Ví dụ: `ttp-home`).
3. Tắt Google Analytics (không cần thiết cho demo).

### Bước 2: Bật tính năng Authentication
1. Trong menu bên trái, chọn **Authentication**.
2. Nhấn **Get Started**.
3. Chọn tab **Sign-in method**, chọn **Email/Password**.
4. Bật công tắc **Enable**, sau đó nhấn **Save**.

### Bước 3: Tạo tài khoản người dùng
Do ứng dụng này dành riêng cho nội bộ, bạn cần tạo tay 3 tài khoản này trong tab **Users** của Authentication:

| Email | Mật khẩu (Tự đặt) | Vai trò (Mapping) |
|---|---|---|
| `tuanchom@ttp.com` | `123456` | Admin |
| `tamtrang@ttp.com` | `123456` | Viewer |
| `phi@ttp.com` | `123456` | Viewer |

*(Lưu ý: Mật khẩu bạn tự đặt, sau đó cung cấp cho các thành viên)*

### Bước 4: Lấy config Firebase
1. Vào **Project Settings** (biểu tượng bánh răng).
2. Cuộn xuống phần **Your apps**, chọn biểu tượng web `</>`.
3. Đặt tên app (ví dụ: `ttp-web`), bỏ chọn "Also set up Firebase Hosting" lúc này, nhấn **Register app**.
4. Bạn sẽ thấy đoạn mã `const firebaseConfig = { ... }`.

### Bước 5: Cấu hình biến môi trường
Tạo file `.env` ở thư mục gốc dự án Vite và điền các thông số từ bước 4 vào (Vite yêu cầu prefix `VITE_`):

```env
API_KEY=AIzaSy... (API Key Gemini của bạn)

VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=ttp-home.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=ttp-home
VITE_FIREBASE_STORAGE_BUCKET=ttp-home.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

## 4. Cấu hình Vite

Mở file `vite.config.ts` và đảm bảo cấu hình như sau để load env:

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

## 5. Sao chép mã nguồn

Sao chép toàn bộ source code vào thư mục `src/` của dự án Vite (như hướng dẫn trong file code).

## 6. Thiết lập Firebase Hosting & Deploy

1.  Cài đặt Firebase CLI:
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
    *   Chọn: **Hosting: Configure files for Firebase Hosting and (optionally) set up GitHub Action deploys**.
    *   Chọn: **Use an existing project** -> Chọn dự án bạn vừa tạo.
    *   **What do you want to use as your public directory?** -> Nhập: `dist`
    *   **Configure as a single-page app?** -> Nhập: `y`
    *   **Set up automatic builds and deploys with GitHub?** -> Nhập: `n`

4.  Build và Triển khai:
    ```bash
    npm run build
    firebase deploy
    ```

Ứng dụng sẽ online tại đường dẫn dạng: `https://[project-id].web.app`.
