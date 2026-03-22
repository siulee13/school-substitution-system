import fs from 'fs';
import path from 'path';
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';

const dbDir = path.join(process.cwd(), '..');

let teacherDb: SqlJsDatabase | null = null;
let classDb: SqlJsDatabase | null = null;
let sqlJs: any = null;

// 初始化 sql.js
async function initSql() {
  if (!sqlJs) {
    sqlJs = await initSqlJs();
  }
  return sqlJs;
}

// 初始化資料庫連接
async function getTeacherDb(): Promise<SqlJsDatabase> {
  if (!teacherDb) {
    const sql = await initSql();
    const dbPath = path.join(dbDir, 'timetable.db');
    const fileBuffer = fs.readFileSync(dbPath);
    teacherDb = new sql.Database(fileBuffer) as SqlJsDatabase;
  }
  return teacherDb as SqlJsDatabase;
}

async function getClassDb(): Promise<SqlJsDatabase> {
  if (!classDb) {
    const sql = await initSql();
    const dbPath = path.join(dbDir, 'class_timetable.db');
    const fileBuffer = fs.readFileSync(dbPath);
    classDb = new sql.Database(fileBuffer) as SqlJsDatabase;
  }
  return classDb as SqlJsDatabase;
}

// 加載科任老師映射
function loadSubjectTeacherMappings() {
  const mappingPath = path.join(dbDir, 'subject_teacher_mappings.json');
  if (fs.existsSync(mappingPath)) {
    return JSON.parse(fs.readFileSync(mappingPath, 'utf-8'));
  }
  return {};
}

// 獲取所有老師列表（含全名及簡稱）
export async function getAllTeachers(): Promise<Array<{ fullName: string; shortName: string }>> {
  try {
    const db = await getTeacherDb();
    const stmt = db.prepare('SELECT full_name, short_name FROM teacher_names ORDER BY full_name');
    stmt.bind();
    const rows: Array<{ fullName: string; shortName: string }> = [];
    
    while (stmt.step()) {
      const row = stmt.getAsObject();
      rows.push({
        fullName: row.full_name as string,
        shortName: row.short_name as string,
      });
    }
    stmt.free();
    
    return rows;
  } catch (error) {
    console.error('Error fetching teachers:', error);
    return [];
  }
}

// 根據日期及老師查詢當日課堂
function parseTimeForSorting(timeStr: string): number {
  // 例如 "7:45 - 8:10" 或 "8:10－ 8:30" 或 "09:50－10:25"
  const match = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (match) {
    return parseInt(match[1]) * 60 + parseInt(match[2]);
  }
  return 0;
}

function parseClassAndSubject(content: string): { className: string; subject: string } {
  // 例如 "5A 體育 籃球場1" 或 "2B 體育 操基1" 或 "班主任課"
  const classMatch = content.match(/^([1-6][A-F])\s+(.+)$/);
  if (classMatch) {
    const className = classMatch[1];
    const rest = classMatch[2];
    // 例如 "體育 籃球場1" 或 "體育 操基1"
    const subjectMatch = rest.match(/^([^\s]+)/);
    const subject = subjectMatch ? subjectMatch[1] : rest;
    return { className, subject };
  }
  // 如果沒有班別，可能是特殊課程如 "班主任課"
  return { className: 'N/A', subject: content };
}

export async function getTeacherClassesByDate(
  teacherFullName: string,
  date: Date
): Promise<Array<{ timeSlot: string; className: string; subject: string; location?: string }>> {
  try {
    const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];

    const db = await getTeacherDb();
    const stmt = db.prepare(`
      SELECT Time as timeSlot, Content as content FROM timetable 
      WHERE Teacher = ? AND Day = ?
    `);
    stmt.bind([teacherFullName, dayOfWeek]);
    const rows: Array<{ timeSlot: string; className: string; subject: string }> = [];
    
    while (stmt.step()) {
      const row = stmt.getAsObject();
      const { className, subject } = parseClassAndSubject(row.content as string);
      rows.push({
        timeSlot: row.timeSlot as string,
        className,
        subject,
      });
    }
    stmt.free();
    
    // 按時間排序
    rows.sort((a, b) => parseTimeForSorting(a.timeSlot) - parseTimeForSorting(b.timeSlot));
    
    return rows;
  } catch (error) {
    console.error('Error fetching teacher classes:', error);
    return [];
  }
}

// 根據日期及時間段查詢空堂老師
export async function getAvailableTeachers(
  date: Date,
  timeSlot: string
): Promise<Array<{ fullName: string; shortName: string }>> {
  try {
    const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];

    const db = await getTeacherDb();
    const stmt = db.prepare(`
      SELECT DISTINCT full_name, short_name FROM teacher_names 
      WHERE full_name NOT IN (
        SELECT Teacher FROM timetable 
        WHERE Day = ? AND Time = ?
      )
      ORDER BY full_name
    `);
    stmt.bind([dayOfWeek, timeSlot]);
    const rows: Array<{ fullName: string; shortName: string }> = [];
    
    while (stmt.step()) {
      const row = stmt.getAsObject();
      rows.push({
        fullName: row.full_name as string,
        shortName: row.short_name as string,
      });
    }
    stmt.free();
    
    return rows;
  } catch (error) {
    console.error('Error fetching available teachers:', error);
    return [];
  }
}

// 根據班別查詢科任老師
export async function getSubjectTeachersForClass(
  className: string
): Promise<Array<{ fullName: string; shortName: string; subject: string }>> {
  try {
    const mappings = loadSubjectTeacherMappings();
    const classMapping = mappings[className] || {};
    
    const db = await getTeacherDb();
    const stmt = db.prepare('SELECT full_name, short_name FROM teacher_names WHERE full_name = ?');
    
    const teachers: Array<{ fullName: string; shortName: string; subject: string }> = [];
    
    for (const [subject, teacherName] of Object.entries(classMapping)) {
      if (typeof teacherName === 'string') {
        stmt.bind([teacherName]);
        if (stmt.step()) {
          const row = stmt.getAsObject();
          teachers.push({
            fullName: row.full_name as string,
            shortName: row.short_name as string,
            subject: subject,
          });
        }
        stmt.reset();
      }
    }
    stmt.free();
    
    return teachers;
  } catch (error) {
    console.error('Error fetching subject teachers:', error);
    return [];
  }
}

// 生成代課建議
export async function generateSuggestions(
  date: Date,
  absentTeacherFullName: string
): Promise<Array<{
  timeSlot: string;
  className: string;
  subject: string;
  priorityTeachers: Array<{ fullName: string; shortName: string; subject: string }>;
  otherTeachers: Array<{ fullName: string; shortName: string }>;
}>> {
  try {
    // 獲取請假老師當日課堂
    const classes = await getTeacherClassesByDate(absentTeacherFullName, date);
    
    const suggestions = [];
    
    for (const cls of classes) {
      // 獲取該時段空堂老師
      const availableTeachers = await getAvailableTeachers(date, cls.timeSlot);
      
      // 獲取該班別科任老師
      const subjectTeachers = await getSubjectTeachersForClass(cls.className);
      
      // 篩選優先老師（科任老師中的空堂老師）
      const priorityTeachers = availableTeachers.filter(t =>
        subjectTeachers.some(st => st.fullName === t.fullName)
      );
      
      // 其他空堂老師
      const otherTeachers = availableTeachers.filter(t =>
        !priorityTeachers.some(pt => pt.fullName === t.fullName)
      );
      
      suggestions.push({
        timeSlot: cls.timeSlot,
        className: cls.className,
        subject: cls.subject,
        priorityTeachers: priorityTeachers.map(t => ({
          fullName: t.fullName,
          shortName: t.shortName,
          subject: subjectTeachers.find(st => st.fullName === t.fullName)?.subject || 'N/A',
        })),
        otherTeachers,
      });
    }
    
    return suggestions;
  } catch (error) {
    console.error('Error generating suggestions:', error);
    return [];
  }
}
