import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const dbDir = path.join(process.cwd(), '..');

// 初始化資料庫連接
function getTeacherDb() {
  return new Database(path.join(dbDir, 'timetable.db'));
}

function getClassDb() {
  return new Database(path.join(dbDir, 'class_timetable.db'));
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
    const db = getTeacherDb();
    const stmt = db.prepare('SELECT full_name, short_name FROM teacher_names ORDER BY full_name');
    const rows = stmt.all() as any[];
    db.close();
    return rows.map(row => ({ fullName: row.full_name, shortName: row.short_name }));
  } catch (error) {
    console.error('Error fetching teachers:', error);
    return [];
  }
}

// 根據日期及老師查詢當日課堂
export async function getTeacherClassesByDate(
  teacherFullName: string,
  date: Date
): Promise<Array<{ timeSlot: string; class: string; subject: string; location?: string }>> {
  try {
    const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];

    const db = getTeacherDb();
    const stmt = db.prepare(`
      SELECT Time as timeSlot, Content as subject FROM timetable 
      WHERE Teacher = ? AND Day = ?
      ORDER BY Time
    `);
    const rows = stmt.all(teacherFullName, dayOfWeek) as any[];
    db.close();

    return rows.map(row => ({
      timeSlot: row.timeSlot,
      class: 'N/A', // 從 timetable 表無法直接獲得班別，需要從 Content 中解析
      subject: row.subject,
    }));
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

    const db = getTeacherDb();
    const stmt = db.prepare(`
      SELECT DISTINCT full_name, short_name FROM teacher_names 
      WHERE full_name NOT IN (
        SELECT Teacher FROM timetable 
        WHERE Day = ? AND Time = ?
      )
      ORDER BY full_name
    `);
    const rows = stmt.all(dayOfWeek, timeSlot) as any[];
    db.close();

    return rows.map(row => ({ fullName: row.full_name, shortName: row.short_name }));
  } catch (error) {
    console.error('Error fetching available teachers:', error);
    return [];
  }
}

// 根據班別查詢科任老師
export async function getSubjectTeachersForClass(
  className: string
): Promise<Array<{ fullName: string; shortName: string; subjects: string[] }>> {
  try {
    const mappings = loadSubjectTeacherMappings();
    const classMapping = mappings[className];

    if (!classMapping) {
      return [];
    }

    // 獲取所有老師的簡稱到全名的映射
    const teachers = await getAllTeachers();
    const shortToFull = new Map(teachers.map(t => [t.shortName, t.fullName]));

    // 將簡稱轉換為全名，並聚合科目
    const subjectTeachers = new Map<string, { fullName: string; shortName: string; subjects: Set<string> }>();

    for (const [subject, shortName] of Object.entries(classMapping)) {
      const fullName = shortToFull.get(shortName as string);
      if (fullName) {
        if (!subjectTeachers.has(fullName)) {
          subjectTeachers.set(fullName, {
            fullName,
            shortName: shortName as string,
            subjects: new Set(),
          });
        }
        subjectTeachers.get(fullName)!.subjects.add(subject);
      }
    }

    return Array.from(subjectTeachers.values()).map(t => ({
      fullName: t.fullName,
      shortName: t.shortName,
      subjects: Array.from(t.subjects),
    }));
  } catch (error) {
    console.error('Error fetching subject teachers:', error);
    return [];
  }
}

// 生成代課建議
export async function generateSubstitutionSuggestions(
  date: Date,
  absentTeacherFullName: string
): Promise<
  Array<{
    timeSlot: string;
    class: string;
    subject: string;
    subjectTeachers: Array<{ fullName: string; shortName: string; subjects: string[] }>;
    otherTeachers: Array<{ fullName: string; shortName: string }>;
  }>
> {
  try {
    // 1. 獲取請假老師當日課堂
    const absentClasses = await getTeacherClassesByDate(absentTeacherFullName, date);

    // 2. 為每一堂課生成建議
    const suggestions = await Promise.all(
      absentClasses.map(async (lesson) => {
        // 獲取該時段空堂老師
        const availableTeachers = await getAvailableTeachers(date, lesson.timeSlot);

        // 獲取該班別的科任老師
        const subjectTeachers = await getSubjectTeachersForClass(lesson.class);

        // 篩選出該時段空堂的科任老師
        const availableSubjectTeachers = subjectTeachers.filter((st) =>
          availableTeachers.some((at) => at.fullName === st.fullName)
        );

        // 其他空堂老師（不是科任老師）
        const otherTeachers = availableTeachers.filter(
          (at) => !subjectTeachers.some((st) => st.fullName === at.fullName)
        );

        return {
          timeSlot: lesson.timeSlot,
          class: lesson.class,
          subject: lesson.subject,
          subjectTeachers: availableSubjectTeachers,
          otherTeachers,
        };
      })
    );

    return suggestions;
  } catch (error) {
    console.error('Error generating substitution suggestions:', error);
    return [];
  }
}
