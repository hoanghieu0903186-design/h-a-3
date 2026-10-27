# Giải mã bản đồ nguyên tố

Game Hóa học 10 (Bài 5 – Bảng tuần hoàn) cho 1 giáo viên + tối đa 10 học sinh.
React + TypeScript + Vite · Supabase (PostgreSQL, Realtime, Anonymous Auth) · Vercel.

## Kiến trúc ngắn gọn

- Không cần Edge Functions. Mọi thao tác ghi dữ liệu đi qua **hàm SQL `SECURITY DEFINER`** (RPC); các bảng không có
  policy INSERT/UPDATE/DELETE nên trình duyệt không thể ghi trực tiếp.
- Đáp án chuẩn nằm ở bảng `task_answers`: bật RLS, không có policy, đã `revoke` mọi quyền của `anon`/`authenticated`
  → trình duyệt không đọc được. Chấm bài chạy trong `submit_answer` → `grade_answer`.
- Danh tính: Supabase **Anonymous sign-in** (mỗi trình duyệt một `auth.uid()`). Giáo viên là người tạo phòng
  (`rooms.teacher_id`); học sinh là `players.user_id`. Quyền được kiểm tra trong từng hàm RPC.
- Đồng hồ: `phase_ends_at` lưu ở máy chủ. `get_state` tự chuyển giai đoạn khi hết giờ (không cần cron). Client chỉ
  hiển thị đếm ngược theo giờ máy chủ (`server_now`).
- Đồng bộ: Realtime báo "có thay đổi" → client gọi lại `get_state`; có polling 3–5 giây làm dự phòng.
- Chống gửi trùng: khóa hàng `players` (`FOR UPDATE`) + `submissions.player_id UNIQUE`.

Luồng: lobby → briefing (30s) → working (180s) → review (90s) → confirm (60s) → finished (giáo viên xác nhận).

## Cấu trúc thư mục

```
supabase/01_schema.sql   bảng, RLS, hàm RPC, Realtime
supabase/02_seed.sql     10 nhiệm vụ + đáp án chuẩn
src/lib/                 supabase.ts, api.ts, types.ts, format.ts
src/data/elements.ts     bảng tuần hoàn H–Ca (Z = 1–20)
src/hooks/useRoomState.ts
src/components/          PeriodicTable, TaskForm, JoinForm, Timer, StatusBar, Toaster
src/pages/               Home, TeacherRoom, StudentRoom
```

## Triển khai

1. **Tạo dự án Supabase** (supabase.com → New project).
2. **Bật đăng nhập ẩn danh:** Authentication → Sign In / Providers → bật **Allow anonymous sign-ins**.
3. **Chạy SQL:** SQL Editor → dán và chạy `supabase/01_schema.sql`, rồi `supabase/02_seed.sql`.
   (Nếu báo lỗi `supabase_realtime`/`publication`, vào Database → Replication bật Realtime cho 3 bảng `rooms`, `players`, `submissions`.)
4. **Lấy khóa:** Project Settings → API → copy *Project URL* và *anon/publishable key*.
   Không dùng `service_role` ở frontend.
5. **Chạy thử cục bộ:**
   ```bash
   npm install
   cp .env.example .env     # điền VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY
   npm run dev
   ```
6. **Đưa lên Vercel:** đẩy mã lên GitHub → Vercel → Add New Project → chọn repo (Framework: Vite) →
   thêm 2 biến môi trường `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` → Deploy.
   `vercel.json` đã có rewrite để các đường dẫn `/teacher/...` và `/play/...` hoạt động khi tải lại trang.
7. Gửi cho học sinh đường link hiển thị trên màn hình giáo viên (`https://<tên-miền>/?room=MÃPHÒNG`).

## Kiểm tra trên nhiều thiết bị

- Mỗi vai trò dùng **một trình duyệt/hồ sơ riêng** (cửa sổ ẩn danh hoặc thiết bị khác). Các tab cùng trình duyệt dùng
  chung phiên đăng nhập nên giáo viên và học sinh sẽ trùng danh tính.
- Thử: tạo phòng → 2–3 học sinh vào → bắt đầu → nộp bài → tải lại trang học sinh (bài vẫn còn) → giai đoạn kiểm tra:
  bật quyền hỗ trợ, cho sửa bài → xác nhận → đóng phòng. Thử thêm người thứ 11 (bị từ chối) và người vào khi phòng đã bắt đầu.

## Lỗi thường gặp

| Hiện tượng | Cách xử lý |
|---|---|
| "Máy chủ chưa bật đăng nhập ẩn danh" | Bật Anonymous sign-ins (bước 2). |
| Trang trắng / "Chưa cấu hình Supabase" | Thiếu biến môi trường; trên Vercel phải Redeploy sau khi thêm biến. |
| 404 khi tải lại `/play/...` | Thiếu `vercel.json` hoặc chưa deploy lại. |
| `permission denied for function ...` | Chạy lại phần "PHÂN QUYỀN THỰC THI" cuối `01_schema.sql`. |
| Không tự cập nhật thời gian thực | Bật Realtime cho 3 bảng; ứng dụng vẫn tự làm mới mỗi 3–5 giây. |
| Học sinh đổi thiết bị mất phiên | Dùng "Tôi đã vào phòng này trước đó": nhập tên + mã khôi phục (hiện ở phòng chờ). |
| Mất phiên của giáo viên | Phiên giáo viên lưu trong trình duyệt; đừng xóa dữ liệu trình duyệt trong lúc đang dạy. |

## Giới hạn đã biết

- Ai cũng có thể tạo phòng (không có đăng nhập giáo viên riêng). Muốn chặn, thêm đăng nhập email cho giáo viên và kiểm
  tra trong `create_room`.
- Dữ liệu phòng cũ không tự xóa; có thể xóa định kỳ bằng SQL (`delete from rooms where created_at < now() - interval '30 days'`).
