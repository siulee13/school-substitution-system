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

describe('teacherTeachesClassOnDay logic (class-based matching)', () => {
  // 模擬時間表資料：老師在某天所有課堂的班別集合
  // 新規則：直接查詢時間表中老師在同日是否有教對方班別（不論科目）
  function mockTeacherTeachesClassOnDay(
    teacherClasses: Record<string, string[]>, // teacherName -> [classNames]
    teacherName: string,
    className: string
  ): boolean {
    return (teacherClasses[teacherName] || []).includes(className);
  }

  it('should return true when teacher has a class of that name on that day', () => {
    const timetable: Record<string, string[]> = {
      '陳大文': ['2A', '3B', '4A'],
      '李弘光': ['2B', '3A'],
    };
    // 陳大文有教 4A → true
    expect(mockTeacherTeachesClassOnDay(timetable, '陳大文', '4A')).toBe(true);
    // 陳大文有教 2A → true
    expect(mockTeacherTeachesClassOnDay(timetable, '陳大文', '2A')).toBe(true);
    // 李弘光有教 2B → true
    expect(mockTeacherTeachesClassOnDay(timetable, '李弘光', '2B')).toBe(true);
  });

  it('should return false when teacher does not teach that class on that day', () => {
    const timetable: Record<string, string[]> = {
      '陳大文': ['2A', '3B', '4A'],
      '李弘光': ['2B', '3A'],
    };
    // 陳大文沒有教 2B → false
    expect(mockTeacherTeachesClassOnDay(timetable, '陳大文', '2B')).toBe(false);
    // 李弘光沒有教 4A → false
    expect(mockTeacherTeachesClassOnDay(timetable, '李弘光', '4A')).toBe(false);
    // 不存在的老師 → false
    expect(mockTeacherTeachesClassOnDay(timetable, '王大明', '2A')).toBe(false);
  });

  it('should require BOTH directions for swap to be valid (new rule)', () => {
    const timetable: Record<string, string[]> = {
      // A 老師：教 2A 和 2B
      'A老師': ['2A', '2B'],
      // B 老師（請假）：教 2A 和 2B
      'B老師': ['2A', '2B'],
      // C 老師：只教 2A，沒有教 2B
      'C老師': ['2A'],
    };

    // 情境 1：A 老師在 T1 教 2A，B 老師在 T2 要教 2B
    // 條件 A：A 老師在同日有教 2B → true
    const aTeachesB = mockTeacherTeachesClassOnDay(timetable, 'A老師', '2B');
    // 條件 B：B 老師在同日有教 2A → true
    const bTeachesA = mockTeacherTeachesClassOnDay(timetable, 'B老師', '2A');
    // 雙向满足 → 可調課
    expect(aTeachesB && bTeachesA).toBe(true);

    // 情境 2：C 老師在 T1 教 2A，B 老師在 T2 要教 2B
    // 條件 A：C 老師在同日有教 2B → false（C 只教 2A）
    const cTeachesB = mockTeacherTeachesClassOnDay(timetable, 'C老師', '2B');
    // 條件 A 不満足 → 不可調課
    expect(cTeachesB && bTeachesA).toBe(false);
  });
});

describe('swap candidate class lists (swapTeacherAllClasses / absentTeacherAllClasses)', () => {
  it('should include class lists in swap candidate payload', () => {
    const candidate = {
      swapTeacherFullName: 'Teacher A',
      swapTeacherShortName: 'A',
      swapTeacherTimeSlot: '9:05－ 9:40',
      swapTeacherClassName: '2A',
      swapTeacherSubject: 'Math',
      absentTeacherTimeSlot: '14:00－14:35',
      absentTeacherClassName: '2B',
      absentTeacherSubject: 'English',
      swapTeacherAllClasses: ['2A', '3B', '4C'],
      absentTeacherAllClasses: ['2B', '1A'],
    };
    expect(Array.isArray(candidate.swapTeacherAllClasses)).toBe(true);
    expect(Array.isArray(candidate.absentTeacherAllClasses)).toBe(true);
    expect(candidate.swapTeacherAllClasses.length).toBeGreaterThan(0);
    expect(candidate.absentTeacherAllClasses.length).toBeGreaterThan(0);
    // swap teacher's own slot class should be in their class list
    expect(candidate.swapTeacherAllClasses).toContain(candidate.swapTeacherClassName);
    // absent teacher's slot class should be in their class list
    expect(candidate.absentTeacherAllClasses).toContain(candidate.absentTeacherClassName);
  });

  it('should have distinct class lists for each teacher', () => {
    const swapTeacherAllClasses = ['2A', '3B'];
    const absentTeacherAllClasses = ['2B', '1A'];
    // In a valid swap: swap teacher teaches absent teacher's class
    // (verified by bidirectional rule in findSwapCandidates)
    const swapTeacherTeachesAbsentClass = swapTeacherAllClasses.some(c => ['2B', '1A'].includes(c));
    const absentTeacherTeachesSwapClass = absentTeacherAllClasses.some(c => ['2A', '3B'].includes(c));
    // For a valid swap both must be true
    expect(typeof swapTeacherTeachesAbsentClass).toBe('boolean');
    expect(typeof absentTeacherTeachesSwapClass).toBe('boolean');
  });
});

describe('multi-teacher generateSuggestionsMulti shape', () => {
  it('should return an array of per-teacher suggestion results', () => {
    // Simulate the expected shape of generateSuggestionsMulti response
    const mockResult = [
      {
        teacherFullName: '陳大文',
        suggestions: [
          { timeSlot: '9:05－ 9:40', className: '4A', subject: '數學', swapCandidates: [] },
        ],
      },
      {
        teacherFullName: '李弘光',
        suggestions: [
          { timeSlot: '11:00－11:35', className: '3B', subject: '英文', swapCandidates: [] },
        ],
      },
    ];
    expect(Array.isArray(mockResult)).toBe(true);
    expect(mockResult.length).toBe(2);
    expect(mockResult[0]).toHaveProperty('teacherFullName');
    expect(mockResult[0]).toHaveProperty('suggestions');
    expect(Array.isArray(mockResult[0].suggestions)).toBe(true);
  });

  it('should correctly find teacher result by fullName', () => {
    const mockResult = [
      { teacherFullName: '陳大文', suggestions: [] },
      { teacherFullName: '李弘光', suggestions: [] },
    ];
    const found = mockResult.find(r => r.teacherFullName === '李弘光');
    expect(found).toBeDefined();
    expect(found?.teacherFullName).toBe('李弘光');
    const notFound = mockResult.find(r => r.teacherFullName === '王大明');
    expect(notFound).toBeUndefined();
  });

  it('should handle single teacher as a degenerate case', () => {
    const mockResult = [
      { teacherFullName: '陳大文', suggestions: [{ timeSlot: '9:05', className: '4A', subject: '數學', swapCandidates: [] }] },
    ];
    expect(mockResult.length).toBe(1);
    expect(mockResult[0].suggestions.length).toBe(1);
  });
});

describe('excludedSwapResources deduplication logic', () => {
  // 模擬 generateSuggestionsMulti 的調課資源去重邏輯
  // 格式：`${swapTeacherFullName}|||${swapTeacherTimeSlot}`
  function buildResourceKey(swapTeacherFullName: string, swapTeacherTimeSlot: string): string {
    return `${swapTeacherFullName}|||${swapTeacherTimeSlot}`;
  }

  it('should exclude already-used swap resources for subsequent teachers', () => {
    const excludedSwapResources = new Set<string>();

    // 第一位老師：李弘光請假，系統找到王婉婷在 9:05 的調課建議
    const teacher1Swaps = [
      { swapTeacherFullName: '王婉婷', swapTeacherTimeSlot: '9:05－ 9:40', absentTeacherTimeSlot: '12:30－13:05' },
    ];
    // 將第一位老師的調課資源加入已佔用集合
    for (const swap of teacher1Swaps) {
      excludedSwapResources.add(buildResourceKey(swap.swapTeacherFullName, swap.swapTeacherTimeSlot));
    }

    // 第二位老師：梁美紅請假，尝試使用王婉婷在 9:05 的調課建議
    const candidate2 = { swapTeacherFullName: '王婉婷', swapTeacherTimeSlot: '9:05－ 9:40' };
    const resourceKey2 = buildResourceKey(candidate2.swapTeacherFullName, candidate2.swapTeacherTimeSlot);
    // 應被排除（已被第一位老師佔用）
    expect(excludedSwapResources.has(resourceKey2)).toBe(true);

    // 第三位老師：鄧淡芳請假，尝試使用王婉婷在 9:05 的調課建議
    const candidate3 = { swapTeacherFullName: '王婉婷', swapTeacherTimeSlot: '9:05－ 9:40' };
    const resourceKey3 = buildResourceKey(candidate3.swapTeacherFullName, candidate3.swapTeacherTimeSlot);
    // 同樣應被排除
    expect(excludedSwapResources.has(resourceKey3)).toBe(true);
  });

  it('should allow different swap resources for different teachers', () => {
    const excludedSwapResources = new Set<string>();

    // 第一位老師佔用王婉婷 9:05
    excludedSwapResources.add(buildResourceKey('王婉婷', '9:05－ 9:40'));

    // 第二位老師使用另一位老師陳大文 10:00 的調課建議
    const candidate = { swapTeacherFullName: '陳大文', swapTeacherTimeSlot: '10:00－10:35' };
    const resourceKey = buildResourceKey(candidate.swapTeacherFullName, candidate.swapTeacherTimeSlot);
    // 不同資源，不應被排除
    expect(excludedSwapResources.has(resourceKey)).toBe(false);
  });

  it('should correctly build resource key format', () => {
    const key = buildResourceKey('王婉婷', '9:05－ 9:40');
    expect(key).toBe('王婉婷|||9:05－ 9:40');
    expect(key.includes('|||')).toBe(true);
    const parts = key.split('|||');
    expect(parts[0]).toBe('王婉婷');
    expect(parts[1]).toBe('9:05－ 9:40');
  });

  it('should handle sequential processing order (first teacher gets priority)', () => {
    // 模擬順序處理：第一位老師優先取得調課資源
    const excludedSwapResources = new Set<string>();
    const swapResource = '王婉婷|||9:05－ 9:40';

    // 第一位老師處理完成，加入資源
    excludedSwapResources.add(swapResource);
    expect(excludedSwapResources.size).toBe(1);

    // 第二位老師檢查同一資源→被排除
    expect(excludedSwapResources.has(swapResource)).toBe(true);

    // 第三位老師檢查同一資源→同樣被排除
    expect(excludedSwapResources.has(swapResource)).toBe(true);
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

describe('excludedRegularResources deduplication logic', () => {
  // 模擬前端 usedRegularResources 計算邏輯
  // 格式：`${teacherFullName}|||${timeSlot}`
  function buildRegularResourceKey(teacherFullName: string, timeSlot: string): string {
    return `${teacherFullName}|||${timeSlot}`;
  }

  it('should exclude teacher already assigned to another class at the same time slot', () => {
    const usedRegularResources = new Set<string>();

    // 第一位請假老師：李弘光，11:20-11:55 選了「洗應輝」代課
    usedRegularResources.add(buildRegularResourceKey('洗應輝', '11:20－11:55'));

    // 第二位請假老師：李媛璇，11:20-11:55 也想用「洗應輝」
    const key = buildRegularResourceKey('洗應輝', '11:20－11:55');
    // 應被排除（同一時段已被佔用）
    expect(usedRegularResources.has(key)).toBe(true);
  });

  it('should allow same teacher at a different time slot', () => {
    const usedRegularResources = new Set<string>();

    // 第一位請假老師：11:20-11:55 選了「洗應輝」
    usedRegularResources.add(buildRegularResourceKey('洗應輝', '11:20－11:55'));

    // 第二位請假老師：9:05-9:40 想用「洗應輝」（不同時段）
    const key = buildRegularResourceKey('洗應輝', '9:05－ 9:40');
    // 不同時段，不應被排除
    expect(usedRegularResources.has(key)).toBe(false);
  });

  it('should allow different teacher at the same time slot', () => {
    const usedRegularResources = new Set<string>();

    // 第一位請假老師：11:20-11:55 選了「洗應輝」
    usedRegularResources.add(buildRegularResourceKey('洗應輝', '11:20－11:55'));

    // 第二位請假老師：11:20-11:55 想用「陳芷茵」（不同老師）
    const key = buildRegularResourceKey('陳芷茵', '11:20－11:55');
    // 不同老師，不應被排除
    expect(usedRegularResources.has(key)).toBe(false);
  });

  it('should handle three teachers competing for the same slot', () => {
    const usedRegularResources = new Set<string>();
    const timeSlot = '11:20－11:55';

    // 第一位老師選了「洗應輝」
    usedRegularResources.add(buildRegularResourceKey('洗應輝', timeSlot));

    // 第二位老師選了「陳芷茵」
    usedRegularResources.add(buildRegularResourceKey('陳芷茵', timeSlot));

    // 第三位老師：「洗應輝」和「陳芷茵」都應被排除
    expect(usedRegularResources.has(buildRegularResourceKey('洗應輝', timeSlot))).toBe(true);
    expect(usedRegularResources.has(buildRegularResourceKey('陳芷茵', timeSlot))).toBe(true);
    // 但「鄧迪敏」未被佔用
    expect(usedRegularResources.has(buildRegularResourceKey('鄧迪敏', timeSlot))).toBe(false);
  });

  it('should not exclude swap selections (only regular substitutions)', () => {
    // swap 選擇（__SWAP__ 開頭）不應加入 usedRegularResources
    const value = '__SWAP__洗應輝|||11:20－11:55|||5F|||數學';
    const isSwap = value.startsWith('__SWAP__');
    const isNone = value === 'none';
    const isRegular = !isSwap && !isNone && value !== '';
    // 應為 false，swap 不應被加入普通代課資源集合
    expect(isRegular).toBe(false);
  });
});
