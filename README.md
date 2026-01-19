
# Hướng Dẫn Triển Khai Ứng Dụng "Quản lý Nhà TTP" Lên Firebase

Tài liệu này hướng dẫn chi tiết cách cấu hình và triển khai ứng dụng lên Firebase Hosting. Ứng dụng hỗ trợ 2 chế độ cấu hình: Biến môi trường (cho Dev/Build) và Nhập thủ công (cho Demo nhanh).

## 1. Chuẩn bị

Đảm bảo máy tính đã cài đặt:
*   **Node.js** (v18+): [Tải tại nodejs.org](https://nodejs.org/)
*   **Firebase CLI**: Chạy lệnh `npm install -g firebase-tools`

## 2. Thiết lập Firebase Project

1.  Truy cập [Firebase Console](https://console.firebase.google.com/).
2.  Tạo dự án mới (Ví dụ: `ttp-home`).
3.  **Authentication**:
    *   Vào menu **Build** -> **Authentication**.
    *   Tab **Sign-in method** -> Chọn **Email/Password** -> Bật **Enable** -> Lưu.
    *   Tab **Users** -> Thêm người dùng (Ví dụ: `tuanchom@ttp.com` / `123456`).
4.  **Lấy Config**:
    *   Vào **Project Settings** (bánh răng).
    *   Kéo xuống **Your apps** -> Chọn Web (`</>`) -> Đăng ký app (Ví dụ `ttp-web`).
    *   Sao chép toàn bộ object `firebaseConfig` (chứa `apiKey`, `authDomain`,...).

## 3. Cài đặt & Chạy Local

1.  Cài đặt thư viện:
    ```bash
    npm install
    ```

2.  Cấu hình biến môi trường (Khuyên dùng cho Dev):
    *   Tạo file `.env` tại thư mục gốc.
    *   Điền thông tin lấy được ở Bước 2:
    ```env
    VITE_FIREBASE_API_KEY=AIzaSy...
    VITE_FIREBASE_AUTH_DOMAIN=project-id.firebaseapp.com
    VITE_FIREBASE_PROJECT_ID=project-id
    VITE_FIREBASE_STORAGE_BUCKET=project-id.appspot.com
    VITE_FIREBASE_MESSAGING_SENDER_ID=...
    VITE_FIREBASE_APP_ID=...
    
    # API Key Google Gemini (Nếu có dùng AI chat)
    API_KEY=AIzaSy...
    ```

3.  Chạy ứng dụng:
    ```bash
    npm run dev
    ```
    *   Nếu chưa cấu hình `.env`, ứng dụng sẽ hiện bảng yêu cầu nhập JSON Config. Bạn có thể dán đoạn mã JSON từ Firebase Console vào đó.

## 4. Deploy lên Firebase Hosting

### Cách 1: Deploy thủ công (Nhanh nhất)

1.  Đăng nhập Firebase trên terminal:
    ```bash
    firebase login
    ```

2.  Khởi tạo dự án (chỉ cần làm lần đầu):
    ```bash
    firebase init hosting
    ```
    *   Chọn **Use an existing project** -> Chọn dự án bạn vừa tạo.
    *   **Public directory**: Nhập `dist`
    *   **Configure as a single-page app**: Nhập `y`
    *   **Set up automatic builds and deploys with GitHub**: Nhập `n`

3.  Build ứng dụng:
    ```bash
    npm run build
    ```
    *   *Lưu ý: Quá trình build sẽ "đóng gói" các biến môi trường từ file `.env` vào code. Đảm bảo file `.env` của bạn đã có đủ thông tin.*

4.  Đẩy lên server:
    ```bash
    firebase deploy --only hosting
    ```

Sau khi xong, terminal sẽ hiển thị **Hosting URL** (ví dụ: `https://ttp-home.web.app`). Bạn có thể gửi link này cho mọi người.

### Cách 2: Deploy không cần biến môi trường (Chia sẻ mã nguồn công khai)

Nếu bạn không muốn lộ API Key trong code khi build hoặc deploy lên GitHub Pages/Vercel công khai:

1.  Không tạo file `.env` hoặc để trống các biến `VITE_FIREBASE_...`.
2.  Chạy `npm run build` và deploy như bình thường.
3.  Khi người dùng truy cập web lần đầu, màn hình sẽ hiện **"Cấu hình Hệ thống"**.
4.  Người dùng (hoặc Admin) dán chuỗi JSON `firebaseConfig` vào để kích hoạt. Cấu hình này sẽ được lưu ở trình duyệt của họ.

## 5. Tài khoản Đăng nhập Mặc định

Hệ thống được thiết kế để map email Firebase với dữ liệu ứng dụng:

| Tên | Email | Quyền |
|---|---|---|
| TuanChom | `tuanchom@ttp.com` | Admin (Quản lý dự án) |
| TamTrang | `tamtrang@ttp.com` | Viewer |
| Phi | `phi@ttp.com` | Viewer |

*Hãy tạo đúng các email này trong Firebase Authentication để đăng nhập thành công.*
