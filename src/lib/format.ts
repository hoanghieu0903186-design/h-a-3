import type { FinalStatus, Phase } from './types';

export const PHASE_LABEL: Record<Phase, string> = {
  lobby: 'Phòng chờ',
  briefing: 'Hướng dẫn',
  working: 'Thực hiện nhiệm vụ',
  review: 'Kiểm tra và hỗ trợ',
  confirm: 'Xác nhận kết quả',
  finished: 'Đã hoàn thành',
};

export const PHASE_SECONDS: Partial<Record<Phase, number>> = {
  briefing: 30,
  working: 180,
  review: 90,
  confirm: 60,
};

export const STATUS_LABEL: Record<FinalStatus, string> = {
  DAT: 'ĐẠT',
  CHO_XAC_MINH: 'CHỜ XÁC MINH BỔ SUNG',
};

const ROMAN: Record<number, string> = {
  1: 'IA', 2: 'IIA', 13: 'IIIA', 14: 'IVA', 15: 'VA', 16: 'VIA', 17: 'VIIA', 18: 'VIIIA',
};

export function groupLabel(g: number): string {
  return ROMAN[g] ? `${g} (${ROMAN[g]})` : String(g);
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('vi-VN');
}
