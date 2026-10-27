import { ensureSession, supabase } from './supabase';
import type { Answer, RoomState, SolutionRow } from './types';

export class ApiError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

const MESSAGES: Record<string, string> = {
  network: 'Mất kết nối mạng. Hệ thống sẽ tự thử lại.',
  anon_disabled: 'Máy chủ chưa bật đăng nhập ẩn danh (Anonymous sign-ins). Hãy bật trong Supabase > Authentication.',
  not_authenticated: 'Phiên đăng nhập chưa sẵn sàng. Hãy tải lại trang.',
  room_not_found: 'Không tìm thấy phòng với mã này.',
  not_in_room: 'Bạn chưa tham gia phòng này.',
  forbidden: 'Bạn không có quyền thực hiện thao tác này.',
  room_closed: 'Phòng đã đóng.',
  room_started: 'Phòng đã bắt đầu, không nhận thêm người chơi mới.',
  room_full: 'Phòng đã đủ 10 người.',
  name_taken: 'Tên này đã có người dùng trong phòng. Hãy chọn tên khác.',
  invalid_name: 'Tên phải có từ 1 đến 30 ký tự.',
  invalid_recovery: 'Tên hoặc mã khôi phục không đúng.',
  already_started: 'Phòng đã bắt đầu.',
  no_players: 'Chưa có học sinh nào trong phòng.',
  phase_locked: 'Giai đoạn này không còn nhận hoặc sửa bài.',
  first_submit_locked: 'Đã hết thời gian nộp bài lần đầu.',
  edit_not_allowed: 'Giáo viên chưa cho phép sửa bài.',
  hint_already_used: 'Quyền hỗ trợ đã được sử dụng.',
  wrong_phase: 'Thao tác này không phù hợp với giai đoạn hiện tại.',
  use_confirm: 'Hãy dùng nút “Xác nhận kết quả cuối cùng”.',
  invalid_answer: 'Câu trả lời không hợp lệ.',
  no_task: 'Bạn chưa được giao nhiệm vụ.',
};

export function errorMessage(e: unknown): string {
  const code = e instanceof ApiError ? e.code : e instanceof Error ? e.message : String(e);
  return MESSAGES[code] ?? `Có lỗi xảy ra: ${code}`;
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  try {
    await ensureSession();
  } catch (e) {
    const m = String((e as { message?: string })?.message ?? e).toLowerCase();
    if (m.includes('anonymous')) throw new ApiError('anon_disabled');
    throw new ApiError('network');
  }
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    const m = error.message ?? '';
    if (/fetch|network|load failed/i.test(m)) throw new ApiError('network');
    throw new ApiError(m);
  }
  return data as T;
}

export const createRoom = () => rpc<{ code: string }>('create_room');
export const joinRoom = (code: string, name: string, recovery: string | null) =>
  rpc<{ code: string }>('join_room', { p_code: code, p_name: name, p_recovery: recovery });
export const getState = (code: string) => rpc<RoomState>('get_state', { p_code: code });
export const startGame = (code: string) => rpc<unknown>('start_game', { p_code: code });
export const advancePhase = (code: string) => rpc<unknown>('advance_phase', { p_code: code });
export const activateHint = (code: string) => rpc<{ hinted: number }>('activate_hint', { p_code: code });
export const setEditOpen = (code: string, open: boolean) =>
  rpc<unknown>('set_edit_open', { p_code: code, p_open: open });
export const publishResults = (code: string) => rpc<unknown>('publish_results', { p_code: code });
export const confirmRoom = (code: string) => rpc<unknown>('confirm_room', { p_code: code });
export const closeRoom = (code: string) => rpc<unknown>('close_room', { p_code: code });
export const submitAnswer = (code: string, answer: Answer) =>
  rpc<unknown>('submit_answer', { p_code: code, p_answer: answer });
export const getSolutions = (code: string) => rpc<SolutionRow[]>('get_solutions', { p_code: code });
