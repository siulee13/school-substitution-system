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

// 根據日期及老師查詢當日課堂
export async function getTeacherClassesByDate(
  teacherFullName: string,
  date: Date
): Promise<Array<{ timeSlot: string; className: string; subject: string }>> {
  try {
    // 使用 UTC 日期以避免時區問題
    const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getUTCDay()];
    const db = await getTeacherDb();
    
    const result = db.exec(
      `SELECT Time as timeSlot, Content as content FROM timetable WHERE Teacher = '${teacherFullName.replace(/'/g, "''")}' AND Day = '${dayOfWeek}'`
    );
    
    if (!result || result.length === 0) return [];
    
    const rows = result[0].values.map((row: any[]) => {
      const { className, subject } = parseClassAndSubject(row[1] as string);
      return {
        timeSlot: row[0] as string,
        className,
        subject,
      };
    });
    
    rows.sort((a: { timeSlot: string; className: string; subject: string }, b: { timeSlot: string; className: string; subject: string }) => parseTimeForSorting(a.timeSlot) - parseTimeForSorting(b.timeSlot));
    return rows;
  } catch (error) {
    console.error('[DB] Error fetching teacher classes:', error);
    return [];
  }
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
        // 映射中存的是簡稱，用簡稱查全名
        const result = db.exec(
          `SELECT full_name, short_name FROM teacher_names WHERE short_name = '${shortName.replace(/'/g, "''")}'`
        );
        if (result && result.length > 0 && result[0].values.length > 0) {
          const row = result[0].values[0];
          teachers.push({
            fullName: row[0] as string,
            shortName: row[1] as string,
            subject,
          });
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
  if (!startTime && !endTime) return true; // 全日，不篩選
  
  // timeSlot 格式如 "9:05－ 9:40" 或 "7:45 - 8:10"
  // 取開始時間和結束時間
  const parts = timeSlot.split(/[-－]/);
  if (parts.length < 2) return true;
  
  const slotStart = parseTimeToMinutes(parts[0]);
  const slotEnd = parseTimeToMinutes(parts[parts.length - 1]);
  
  const rangeStart = startTime ? parseTimeToMinutes(startTime) : 0;
  const rangeEnd = endTime ? parseTimeToMinutes(endTime) : 24 * 60;
  
  // 課堂時間與指定範圍有重疊（課堂開始在範圍結束前，且課堂結束在範圍開始後）
  return slotStart < rangeEnd && slotEnd > rangeStart;
}

// 生成代課建議（核心邏輯）
export async function generateSuggestions(
  date: Date,
  absentTeacherFullName: string,
  startTime?: string,
  endTime?: string
): Promise<Array<{
  timeSlot: string;
  className: string;
  subject: string;
  priorityTeachers: Array<{ fullName: string; shortName: string; subject: string }>;
  otherTeachers: Array<{ fullName: string; shortName: string }>;
}>> {
  try {
    // 使用 UTC 日期以避免時區問題
    const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getUTCDay()];
    
    // 獲取請假老師當日課堂
    const classes = await getTeacherClassesByDate(absentTeacherFullName, date);
    console.log(`[Suggestions] ${absentTeacherFullName} on ${dayOfWeek}: ${classes.length} classes`);
    
    const suggestions = [];
    
    for (const cls of classes) {
      // 如果指定時段，篩選出該時段內的課堂
      if (!isSlotInRange(cls.timeSlot, startTime, endTime)) {
        continue;
      }
      
      // 獲取該時段空堂老師（使用原始時間格式）
      const availableTeachers = await getAvailableTeachersForSlot(dayOfWeek, cls.timeSlot);
      console.log(`[Suggestions] ${cls.timeSlot} ${cls.className}: ${availableTeachers.length} available teachers`);
      
      // 如果是 N/A（非班別課堂，如早會、當值），仍列出空堂老師
      let priorityTeachers: Array<{ fullName: string; shortName: string; subject: string }> = [];
      let otherTeachers = availableTeachers;
      
      if (cls.className !== 'N/A') {
        // 獲取該班別科任老師
        const subjectTeachers = await getSubjectTeachersForClassInternal(cls.className);
        const subjectTeacherMap = new Map(subjectTeachers.map(st => [st.fullName, st]));
        
        // 篩選優先老師（科任老師中的空堂老師）
        priorityTeachers = availableTeachers
          .filter(t => subjectTeacherMap.has(t.fullName))
          .map(t => ({
            fullName: t.fullName,
            shortName: t.shortName,
            subject: subjectTeacherMap.get(t.fullName)?.subject || 'N/A',
          }));
        
        // 其他空堂老師（非科任）
        const priorityNames = new Set(priorityTeachers.map(pt => pt.fullName));
        otherTeachers = availableTeachers.filter(t => !priorityNames.has(t.fullName));
        
        console.log(`[Suggestions] ${cls.className}: ${priorityTeachers.length} priority, ${otherTeachers.length} others`);
      }
      
      suggestions.push({
        timeSlot: cls.timeSlot,
        className: cls.className,
        subject: cls.subject,
        priorityTeachers,
        otherTeachers,
      });
    }
    
    return suggestions;
  } catch (error) {
    console.error('[DB] Error generating suggestions:', error);
    return [];
  }
}
