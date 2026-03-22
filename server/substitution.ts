import fs from 'fs';
import path from 'path';
// @ts-ignore - use asm version to avoid wasm loading issues in server environment
import initSqlJs from 'sql.js/dist/sql-asm.js';
type SqlJsDatabase = any;

const dbDir = path.join(process.cwd(), '..');

let teacherDb: SqlJsDatabase | null = null;
let sqlJs: any = null;

// 初始化 sql.js
async function initSql() {
  if (!sqlJs) {
    sqlJs = await initSqlJs();
  }
  return sqlJs;
}

// 初始化資料庫連接（每次重新讀取，避免快取問題）
async function getTeacherDb(): Promise<SqlJsDatabase> {
  if (!teacherDb) {
    const sql = await initSql();
    const dbPath = path.join(dbDir, 'timetable.db');
    const fileBuffer = fs.readFileSync(dbPath);
    teacherDb = new sql.Database(fileBuffer) as SqlJsDatabase;
    console.log('[DB] timetable.db loaded successfully');
  }
  return teacherDb as SqlJsDatabase;
}

// 加載科任老師映射
function loadSubjectTeacherMappings(): Record<string, Record<string, string>> {
  const mappingPath = path.join(dbDir, 'subject_teacher_mappings.json');
  if (fs.existsSync(mappingPath)) {
    return JSON.parse(fs.readFileSync(mappingPath, 'utf-8'));
  }
  console.warn('[DB] subject_teacher_mappings.json not found at', mappingPath);
  return {};
}

// 解析時間字串，用於排序
function parseTimeForSorting(timeStr: string): number {
  const match = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (match) {
    return parseInt(match[1]) * 60 + parseInt(match[2]);
  }
  return 0;
}

// 解析班別和科目
function parseClassAndSubject(content: string): { className: string; subject: string } {
  const classMatch = content.match(/^([1-6][A-F])\s+(.+)$/);
  if (classMatch) {
    const className = classMatch[1];
    const rest = classMatch[2];
    const subjectMatch = rest.match(/^([^\s]+)/);
    const subject = subjectMatch ? subjectMatch[1] : rest;
    return { className, subject };
  }
  return { className: 'N/A', subject: content };
}

// 獲取所有老師列表（含全名及簡稱）
export async function getAllTeachers(): Promise<Array<{ fullName: string; shortName: string }>> {
  try {
    const db = await getTeacherDb();
    const result = db.exec('SELECT full_name, short_name FROM teacher_names ORDER BY full_name');
    if (!result || result.length === 0) return [];
    
    return result[0].values.map((row: any[]) => ({
      fullName: row[0] as string,
      shortName: row[1] as string,
    }));
  } catch (error) {
    console.error('[DB] Error fetching teachers:', error);
    return [];
  }
}

// 根據日期及老師查詢當日課堂（含完整 content）
async function getTeacherClassesByDateRaw(
  teacherFullName: string,
  dayOfWeek: string
): Promise<Array<{ timeSlot: string; className: string; subject: string; rawContent: string }>> {
  try {
    const db = await getTeacherDb();
    const result = db.exec(
      `SELECT Time, Content FROM timetable WHERE Teacher = '${teacherFullName.replace(/'/g, "''")}' AND Day = '${dayOfWeek}'`
    );
    if (!result || result.length === 0) return [];
    const rows = result[0].values.map((row: any[]) => {
      const { className, subject } = parseClassAndSubject(row[1] as string);
      return { timeSlot: row[0] as string, className, subject, rawContent: row[1] as string };
    });
    rows.sort((a: any, b: any) => parseTimeForSorting(a.timeSlot) - parseTimeForSorting(b.timeSlot));
    return rows;
  } catch (error) {
    console.error('[DB] Error fetching teacher classes raw:', error);
    return [];
  }
}

// 根據日期及老師查詢當日課堂（公開 API）
export async function getTeacherClassesByDate(
  teacherFullName: string,
  date: Date
): Promise<Array<{ timeSlot: string; className: string; subject: string }>> {
  const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
  const rows = await getTeacherClassesByDateRaw(teacherFullName, dayOfWeek);
  return rows.map(r => ({ timeSlot: r.timeSlot, className: r.className, subject: r.subject }));
}

// 根據日期及時間段查詢空堂老師（使用原始時間格式）
async function getAvailableTeachersForSlot(
  dayOfWeek: string,
  timeSlot: string
): Promise<Array<{ fullName: string; shortName: string }>> {
  try {
    const db = await getTeacherDb();
    const result = db.exec(
      `SELECT DISTINCT full_name, short_name FROM teacher_names 
       WHERE full_name NOT IN (
         SELECT Teacher FROM timetable 
         WHERE Day = '${dayOfWeek}' AND Time = '${timeSlot.replace(/'/g, "''")}'
       )
       ORDER BY full_name`
    );
    if (!result || result.length === 0) return [];
    return result[0].values.map((row: any[]) => ({
      fullName: row[0] as string,
      shortName: row[1] as string,
    }));
  } catch (error) {
    console.error('[DB] Error fetching available teachers:', error);
    return [];
  }
}

// 根據班別查詢科任老師（從 JSON 映射中讀取，映射中儲存的是簡稱）
async function getSubjectTeachersForClassInternal(
  className: string
): Promise<Array<{ fullName: string; shortName: string; subject: string }>> {
  try {
    const mappings = loadSubjectTeacherMappings();
    const classMapping = mappings[className] || {};
    const db = await getTeacherDb();
    const teachers: Array<{ fullName: string; shortName: string; subject: string }> = [];
    for (const [subject, shortName] of Object.entries(classMapping)) {
      if (typeof shortName === 'string') {
        const result = db.exec(
          `SELECT full_name, short_name FROM teacher_names WHERE short_name = '${shortName.replace(/'/g, "''")}'`
        );
        if (result && result.length > 0 && result[0].values.length > 0) {
          const row = result[0].values[0];
          teachers.push({ fullName: row[0] as string, shortName: row[1] as string, subject });
        }
      }
    }
    return teachers;
  } catch (error) {
    console.error('[DB] Error fetching subject teachers:', error);
    return [];
  }
}

// 公開 API：根據班別查詢科任老師
export async function getSubjectTeachersForClass(
  className: string
): Promise<Array<{ fullName: string; shortName: string; subject: string }>> {
  return getSubjectTeachersForClassInternal(className);
}

// 解析時間字串為分鐘數（支援 7:45 、 8:10、 9:05 等格式）
function parseTimeToMinutes(timeStr: string): number {
  const match = timeStr.trim().match(/(\d{1,2}):(\d{2})/);
  if (match) {
    return parseInt(match[1]) * 60 + parseInt(match[2]);
  }
  return 0;
}

// 判斷某一時段是否在指定時間範圍內
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
// 調課偵測邏輯
// ─────────────────────────────────────────────

/**
 * 調課候選結果：
 * - swapTeacherFullName / shortName：願意調課的老師（即「A 老師」）
 * - swapTeacherTimeSlot：A 老師原本上課的時段（請假老師在該時段空堂，可去代）
 * - swapTeacherClassName / subject：A 老師在 swapTeacherTimeSlot 上的班別及科目
 *   （即請假老師需要去代的課）
 * - absentTeacherTimeSlot：請假老師原本要上的時段（A 老師在該時段空堂，可去代）
 * - absentTeacherClassName / subject：請假老師在 absentTeacherTimeSlot 的班別及科目
 *   （即 A 老師需要去代的課）
 */
export interface SwapCandidate {
  swapTeacherFullName: string;
  swapTeacherShortName: string;
  /** A 老師原本上課的時段（請假老師空堂，可去代 A 老師的課） */
  swapTeacherTimeSlot: string;
  /** A 老師在 swapTeacherTimeSlot 上的班別 */
  swapTeacherClassName: string;
  /** A 老師在 swapTeacherTimeSlot 上的科目 */
  swapTeacherSubject: string;
  /** 請假老師原本要上的時段（A 老師空堂，可去代請假老師的課） */
  absentTeacherTimeSlot: string;
  /** 請假老師在 absentTeacherTimeSlot 上的班別 */
  absentTeacherClassName: string;
  /** 請假老師在 absentTeacherTimeSlot 上的科目 */
  absentTeacherSubject: string;
  /** A 老師在同日所有教的班別（用於 UI 顯示互教關係） */
  swapTeacherAllClasses: string[];
  /** 請假老師在同日所有教的班別（用於 UI 顯示互教關係） */
  absentTeacherAllClasses: string[];
}

/**
 * 尋找可調課的候選方案：
 * 條件：
 * 1. A 老師在某時段 T1 上某班 C_A 的課
 * 2. 請假老師在 T1 是空堂
 * 3. A 老師在請假老師需要代課的時段 T2 是空堂
 * 4. T1 < T2（調課必須在請假時段之前）
 * 5. 互教對方班別（雙向，不論科目）：
 *    - A 老師在同日必須有教請假老師在 T2 要上的班別（C_absent）
 *    - 請假老師在同日必須有教 A 老師在 T1 要上的班別（C_A）
 */
async function findSwapCandidates(
  dayOfWeek: string,
  absentTeacherFullName: string,
  absentClasses: Array<{ timeSlot: string; className: string; subject: string }>,
  /** 已被其他請假老師佔用的調課資源，格式：`${swapTeacherFullName}|||${swapTeacherTimeSlot}` */
  excludedSwapResources: Set<string> = new Set()
): Promise<SwapCandidate[]> {
  const db = await getTeacherDb();

  // 請假老師當日所有課堂的時段集合（用於判斷哪些時段是空堂）
  const absentTeacherBusySlots = new Set(absentClasses.map(c => c.timeSlot));

  /**
   * 檢查 teacherFullName 在同日是否有教 className 這一班（不論科目）
   * 直接查詢時間表資料庫
   */
  function teacherTeachesClassOnDay(teacherFullName: string, className: string): boolean {
    const result = db.exec(
      `SELECT COUNT(*) FROM timetable 
       WHERE Teacher = '${teacherFullName.replace(/'/g, "''")}' 
         AND Day = '${dayOfWeek}' 
         AND Content LIKE '${className.replace(/'/g, "''")} %'
       LIMIT 1`
    );
    const count = result?.[0]?.values?.[0]?.[0] ?? 0;
    return (count as number) > 0;
  }

  // 預先查詢請假老師在同日所有教的班別
  const absentTeacherDayClassesRaw = db.exec(
    `SELECT DISTINCT Content FROM timetable 
     WHERE Teacher = '${absentTeacherFullName.replace(/'/g, "''")}' AND Day = '${dayOfWeek}'`
  );
  const absentTeacherAllClassesSet = new Set<string>();
  if (absentTeacherDayClassesRaw && absentTeacherDayClassesRaw.length > 0) {
    for (const row of absentTeacherDayClassesRaw[0].values) {
      const { className } = parseClassAndSubject(row[0] as string);
      if (className !== 'N/A') absentTeacherAllClassesSet.add(className);
    }
  }
  const absentTeacherAllClasses = Array.from(absentTeacherAllClassesSet).sort();

  // 用於緩存各 A 老師的同日班別（避免重複查詢）
  const swapTeacherClassCache = new Map<string, string[]>();

  function getSwapTeacherAllClasses(teacherFullName: string): string[] {
    if (swapTeacherClassCache.has(teacherFullName)) {
      return swapTeacherClassCache.get(teacherFullName)!;
    }
    const raw = db.exec(
      `SELECT DISTINCT Content FROM timetable 
       WHERE Teacher = '${teacherFullName.replace(/'/g, "''")}' AND Day = '${dayOfWeek}'`
    );
    const classSet = new Set<string>();
    if (raw && raw.length > 0) {
      for (const row of raw[0].values) {
        const { className } = parseClassAndSubject(row[0] as string);
        if (className !== 'N/A') classSet.add(className);
      }
    }
    const classes = Array.from(classSet).sort();
    swapTeacherClassCache.set(teacherFullName, classes);
    return classes;
  }

  const candidates: SwapCandidate[] = [];

  for (const absentCls of absentClasses) {
    if (absentCls.className === 'N/A') continue; // 跳過非班別課堂

    const absentSlotMinutes = parseTimeForSorting(absentCls.timeSlot);

    // 查詢：在同一天，有哪些老師在某個時段 T1 上課，
    // 且 T1 是請假老師的空堂，且 T1 < T2（absentCls.timeSlot）
    // 且該老師在 T2 是空堂
    const result = db.exec(
      `SELECT t.Teacher, tn.short_name, t.Time, t.Content
       FROM timetable t
       JOIN teacher_names tn ON t.Teacher = tn.full_name
       WHERE t.Day = '${dayOfWeek}'
         AND t.Teacher != '${absentTeacherFullName.replace(/'/g, "''")}'
         AND t.Time NOT IN (
           SELECT Time FROM timetable 
           WHERE Teacher = '${absentTeacherFullName.replace(/'/g, "''")}' AND Day = '${dayOfWeek}'
         )
       ORDER BY t.Time`
    );

    if (!result || result.length === 0) continue;

    for (const row of result[0].values) {
      const otherTeacherName = row[0] as string;
      const otherTeacherShort = row[1] as string;
      const otherTimeSlot = row[2] as string;
      const otherContent = row[3] as string;

      // T1 必須在 T2 之前（調課要在請假前）
      const otherSlotMinutes = parseTimeForSorting(otherTimeSlot);
      if (otherSlotMinutes >= absentSlotMinutes) continue;

      // 請假老師在 T1 必須是空堂
      if (absentTeacherBusySlots.has(otherTimeSlot)) continue;

      // 該老師在 T2（absentCls.timeSlot）必須是空堂
      const busyCheck = db.exec(
        `SELECT COUNT(*) FROM timetable 
         WHERE Teacher = '${otherTeacherName.replace(/'/g, "''")}' 
           AND Day = '${dayOfWeek}' 
           AND Time = '${absentCls.timeSlot.replace(/'/g, "''")}'`
      );
      const busyCount = busyCheck?.[0]?.values?.[0]?.[0] ?? 1;
      if (busyCount > 0) continue;

      const { className: otherClassName, subject: otherSubject } = parseClassAndSubject(otherContent);
      if (otherClassName === 'N/A') continue; // 跳過非班別課堂

      // ── 互教對方班別檢查（雙向，不論科目） ──
      // 條件 A：A 老師在同日必須有教請假老師在 T2 要上的班別（absentCls.className）
      const aTeachesAbsentClass = teacherTeachesClassOnDay(otherTeacherName, absentCls.className);
      if (!aTeachesAbsentClass) continue;

      // 條件 B：請假老師在同日必須有教 A 老師在 T1 要上的班別（otherClassName）
      const absentTeachesAClass = teacherTeachesClassOnDay(absentTeacherFullName, otherClassName);
      if (!absentTeachesAClass) continue;

      // 排除已被其他請假老師佔用的調課資源
      const resourceKey = `${otherTeacherName}|||${otherTimeSlot}`;
      if (excludedSwapResources.has(resourceKey)) continue;

      // 避免重複：同一 (swapTeacher, swapTimeSlot, absentTimeSlot) 組合只記錄一次
      const alreadyExists = candidates.some(
        c =>
          c.swapTeacherFullName === otherTeacherName &&
          c.swapTeacherTimeSlot === otherTimeSlot &&
          c.absentTeacherTimeSlot === absentCls.timeSlot
      );
      if (alreadyExists) continue;

      candidates.push({
        swapTeacherFullName: otherTeacherName,
        swapTeacherShortName: otherTeacherShort,
        swapTeacherTimeSlot: otherTimeSlot,
        swapTeacherClassName: otherClassName,
        swapTeacherSubject: otherSubject,
        absentTeacherTimeSlot: absentCls.timeSlot,
        absentTeacherClassName: absentCls.className,
        absentTeacherSubject: absentCls.subject,
        swapTeacherAllClasses: getSwapTeacherAllClasses(otherTeacherName),
        absentTeacherAllClasses,
      });
    }
  }

  console.log(`[Swap] Found ${candidates.length} swap candidates for ${absentTeacherFullName}`);
  return candidates;
}

// ─────────────────────────────────────────────
// 生成代課建議（核心邏輯）
// ─────────────────────────────────────────────

export interface SuggestionItem {
  timeSlot: string;
  className: string;
  subject: string;
  /** 優先推薦：科任老師（空堂） */
  priorityTeachers: Array<{ fullName: string; shortName: string; subject: string }>;
  /** 其他空堂老師 */
  otherTeachers: Array<{ fullName: string; shortName: string }>;
  /** 調課建議（allowSwap=true 時才有值） */
  swapCandidates: SwapCandidate[];
}

export async function generateSuggestions(
  date: Date,
  absentTeacherFullName: string,
  startTime?: string,
  endTime?: string,
  allowSwap?: boolean,
  /** 已被其他請假老師佔用的調課資源，格式：`${swapTeacherFullName}|||${swapTeacherTimeSlot}` */
  excludedSwapResources: Set<string> = new Set()
): Promise<SuggestionItem[]> {
  try {
    const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];

    // 獲取請假老師當日全部課堂（用於調課偵測）
    const allClasses = await getTeacherClassesByDateRaw(absentTeacherFullName, dayOfWeek);
    console.log(`[Suggestions] ${absentTeacherFullName} on ${dayOfWeek}: ${allClasses.length} classes`);

    // 篩選需要代課的課堂（依時段篩選）
    const targetClasses = allClasses.filter(cls =>
      isSlotInRange(cls.timeSlot, startTime, endTime)
    );

    // 調課候選（allowSwap 時計算）
    let swapCandidatesList: SwapCandidate[] = [];
    if (allowSwap && targetClasses.length > 0) {
      swapCandidatesList = await findSwapCandidates(dayOfWeek, absentTeacherFullName, targetClasses, excludedSwapResources);
    }

    const suggestions: SuggestionItem[] = [];

    for (const cls of targetClasses) {
      // 獲取該時段空堂老師
      const availableTeachers = await getAvailableTeachersForSlot(dayOfWeek, cls.timeSlot);

      let priorityTeachers: Array<{ fullName: string; shortName: string; subject: string }> = [];
      let otherTeachers = availableTeachers;

      if (cls.className !== 'N/A') {
        const subjectTeachers = await getSubjectTeachersForClassInternal(cls.className);
        const subjectTeacherMap = new Map(subjectTeachers.map(st => [st.fullName, st]));

        priorityTeachers = availableTeachers
          .filter(t => subjectTeacherMap.has(t.fullName))
          .map(t => ({
            fullName: t.fullName,
            shortName: t.shortName,
            subject: subjectTeacherMap.get(t.fullName)?.subject || 'N/A',
          }));

        const priorityNames = new Set(priorityTeachers.map(pt => pt.fullName));
        otherTeachers = availableTeachers.filter(t => !priorityNames.has(t.fullName));
      }

      // 本堂的調課建議（只取 absentTeacherTimeSlot 對應本堂的候選）
      const swapForThisSlot = swapCandidatesList.filter(
        s => s.absentTeacherTimeSlot === cls.timeSlot
      );

      suggestions.push({
        timeSlot: cls.timeSlot,
        className: cls.className,
        subject: cls.subject,
        priorityTeachers,
        otherTeachers,
        swapCandidates: swapForThisSlot,
      });
    }

    return suggestions;
  } catch (error) {
    console.error('[DB] Error generating suggestions:', error);
    return [];
  }
}
