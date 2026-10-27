// Vị trí các nguyên tố Z = 1 đến 20 trong bảng tuần hoàn (18 cột, chu kỳ 1-4).
export type Block = 's' | 'p' | 'd';

export interface ElementInfo {
  z: number;
  symbol: string;
  name: string;
  period: number;
  group: number;
  block: Block;
}

export const ELEMENTS: ElementInfo[] = [
  { z: 1, symbol: 'H', name: 'Hiđro', period: 1, group: 1, block: 's' },
  { z: 2, symbol: 'He', name: 'Heli', period: 1, group: 18, block: 's' },
  { z: 3, symbol: 'Li', name: 'Liti', period: 2, group: 1, block: 's' },
  { z: 4, symbol: 'Be', name: 'Beri', period: 2, group: 2, block: 's' },
  { z: 5, symbol: 'B', name: 'Bo', period: 2, group: 13, block: 'p' },
  { z: 6, symbol: 'C', name: 'Cacbon', period: 2, group: 14, block: 'p' },
  { z: 7, symbol: 'N', name: 'Nitơ', period: 2, group: 15, block: 'p' },
  { z: 8, symbol: 'O', name: 'Oxi', period: 2, group: 16, block: 'p' },
  { z: 9, symbol: 'F', name: 'Flo', period: 2, group: 17, block: 'p' },
  { z: 10, symbol: 'Ne', name: 'Neon', period: 2, group: 18, block: 'p' },
  { z: 11, symbol: 'Na', name: 'Natri', period: 3, group: 1, block: 's' },
  { z: 12, symbol: 'Mg', name: 'Magie', period: 3, group: 2, block: 's' },
  { z: 13, symbol: 'Al', name: 'Nhôm', period: 3, group: 13, block: 'p' },
  { z: 14, symbol: 'Si', name: 'Silic', period: 3, group: 14, block: 'p' },
  { z: 15, symbol: 'P', name: 'Photpho', period: 3, group: 15, block: 'p' },
  { z: 16, symbol: 'S', name: 'Lưu huỳnh', period: 3, group: 16, block: 'p' },
  { z: 17, symbol: 'Cl', name: 'Clo', period: 3, group: 17, block: 'p' },
  { z: 18, symbol: 'Ar', name: 'Argon', period: 3, group: 18, block: 'p' },
  { z: 19, symbol: 'K', name: 'Kali', period: 4, group: 1, block: 's' },
  { z: 20, symbol: 'Ca', name: 'Canxi', period: 4, group: 2, block: 's' },
];

export const ELEMENT_BY_SYMBOL: Record<string, ElementInfo> = Object.fromEntries(
  ELEMENTS.map((e) => [e.symbol, e]),
);
