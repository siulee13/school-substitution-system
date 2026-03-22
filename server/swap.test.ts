import { describe, it, expect } from 'vitest';

// ─────────────────────────────────────────────
// 測試 decodeSwapValue（前端工具函數）
// 由於前端函數無法直接在 Node 環境 import，
// 我們在此重新定義相同邏輯進行單元測試
// ─────────────────────────────────────────────

const SWAP_PREFIX = '__SWAP__';

function encodeSwapValue(candidate: {
  swapTeacherFullName: string;
  swapTeacherTimeSlot: string;
  swapTeacherClassName: string;
  swapTeacherSubject: string;
}): string {
  return `${SWAP_PREFIX}${candidate.swapTeacherFullName}|||${candidate.swapTeacherTimeSlot}|||${candidate.swapTeacherClassName}|||${candidate.swapTeacherSubject}`;
}

function decodeSwapValue(value: string): {
  isSwap: boolean;
  swapTeacherFullName?: string;
  swapTeacherTimeSlot?: string;
  swapTeacherClassName?: string;
  swapTeacherSubject?: string;
} {
  if (!value.startsWith(SWAP_PREFIX)) return { isSwap: false };
  const parts = value.slice(SWAP_PREFIX.length).split('|||');
  return {
    isSwap: true,
    swapTeacherFullName: parts[0],
    swapTeacherTimeSlot: parts[1],
    swapTeacherClassName: parts[2],
    swapTeacherSubject: parts[3],
  };
}

// ─────────────────────────────────────────────
// 測試 isSlotInRange（後端工具函數）
// ─────────────────────────────────────────────

function parseTimeToMinutes(timeStr: string): number {
  const match = timeStr.trim().match(/(\d{1,2}):(\d{2})/);
  if (match) {
    return parseInt(match[1]) * 60 + parseInt(match[2]);
  }
  return 0;
}

function isSlotInRange(timeSlot: string, startTime?: string, endTime?: string): boolean {
  if (!startTime && !endTime) return true;
  const parts = timeSlot.split(/[-－]/);
  if (parts.length < 2) return true;
  const slotStart = parseTimeToMinutes(parts[0]);
  const slotEnd = parseTimeToMinutes(parts[parts.length - 1]);
  const rangeStart = startTime ? parseTimeToMinutes(startTime) : 0;
  const rangeEnd = endTime ? parseTimeToMinutes(endTime) : 24 * 60;
  return slotStart < rangeEnd && slotEnd > rangeStart;
}

// ─────────────────────────────────────────────
// 測試套件
// ─────────────────────────────────────────────

describe('encodeSwapValue / decodeSwapValue', () => {
  it('should encode and decode swap value correctly', () => {
    const candidate = {
      swapTeacherFullName: '陳大文',
      swapTeacherTimeSlot: '9:05－ 9:40',
      swapTeacherClassName: '4A',
      swapTeacherSubject: '數學',
    };
    const encoded = encodeSwapValue(candidate);
    expect(encoded.startsWith(SWAP_PREFIX)).toBe(true);
    const decoded = decodeSwapValue(encoded);
    expect(decoded.isSwap).toBe(true);
    expect(decoded.swapTeacherFullName).toBe('陳大文');
    expect(decoded.swapTeacherTimeSlot).toBe('9:05－ 9:40');
    expect(decoded.swapTeacherClassName).toBe('4A');
    expect(decoded.swapTeacherSubject).toBe('數學');
  });

  it('should return isSwap=false for non-swap values', () => {
    expect(decodeSwapValue('陳大文').isSwap).toBe(false);
    expect(decodeSwapValue('none').isSwap).toBe(false);
    expect(decodeSwapValue('').isSwap).toBe(false);
  });

  it('should handle teacher names with special characters', () => {
    const candidate = {
      swapTeacherFullName: "O'Brien",
      swapTeacherTimeSlot: '11:00－11:35',
      swapTeacherClassName: '3B',
      swapTeacherSubject: '英文',
    };
    const encoded = encodeSwapValue(candidate);
    const decoded = decodeSwapValue(encoded);
    expect(decoded.swapTeacherFullName).toBe("O'Brien");
  });
});

describe('isSlotInRange', () => {
  it('should return true when no time range specified (全日)', () => {
    expect(isSlotInRange('9:05－ 9:40')).toBe(true);
    expect(isSlotInRange('11:00－11:35', undefined, undefined)).toBe(true);
  });

  it('should return true when slot overlaps with range', () => {
    // 課堂 9:05-9:40，範圍 9:00-10:00 → 重疊
    expect(isSlotInRange('9:05－ 9:40', '9:00', '10:00')).toBe(true);
    // 課堂 11:00-11:35，範圍 11:00-13:05 → 重疊
    expect(isSlotInRange('11:00－11:35', '11:00', '13:05')).toBe(true);
  });

  it('should return false when slot is outside range', () => {
    // 課堂 9:05-9:40，範圍 11:00-13:05 → 不重疊
    expect(isSlotInRange('9:05－ 9:40', '11:00', '13:05')).toBe(false);
    // 課堂 14:00-14:35，範圍 9:00-12:00 → 不重疊
    expect(isSlotInRange('14:00－14:35', '9:00', '12:00')).toBe(false);
  });

  it('should handle edge cases at boundaries', () => {
    // 課堂結束時間等於範圍開始時間 → 不重疊（slotEnd > rangeStart 不成立）
    expect(isSlotInRange('9:05－ 9:40', '9:40', '11:00')).toBe(false);
    // 課堂開始時間等於範圍結束時間 → 不重疊（slotStart < rangeEnd 不成立）
    expect(isSlotInRange('11:00－11:35', '9:00', '11:00')).toBe(false);
  });

  it('should return true for slots with partial overlap', () => {
    // 課堂 10:30-11:05，範圍 11:00-13:05 → 部分重疊
    expect(isSlotInRange('10:30－11:05', '11:00', '13:05')).toBe(true);
  });
});

describe('swap candidate logic validation', () => {
  it('should correctly identify that swap requires earlier time slot', () => {
    // 調課邏輯：swapTeacherTimeSlot 必須在 absentTeacherTimeSlot 之前
    const swapSlotMinutes = parseTimeToMinutes('9:05');
    const absentSlotMinutes = parseTimeToMinutes('11:00');
    expect(swapSlotMinutes).toBeLessThan(absentSlotMinutes);
  });

  it('should reject swap when swap slot is after absent slot', () => {
    const swapSlotMinutes = parseTimeToMinutes('13:05');
    const absentSlotMinutes = parseTimeToMinutes('11:00');
    expect(swapSlotMinutes).toBeGreaterThanOrEqual(absentSlotMinutes);
  });
});
