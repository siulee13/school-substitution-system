import type { ReportRow } from "@/components/SubstitutionReport";
import { decodeSwapValue } from "@/components/SubstitutionSelection";
import type {
  AbsentTeacherEntry,
  AllSelections,
  LessonItem,
  MultiTeacherSuggestionResult,
  TeacherOption,
} from "./types";

export function getNextWeekday(): Date {
  const date = new Date();
  const day = date.getDay();

  if (day === 6) {
    date.setDate(date.getDate() + 2);
  } else if (day === 0) {
    date.setDate(date.getDate() + 1);
  }

  return date;
}

export function makeId() {
  return Math.random().toString(36).slice(2, 9);
}

export function toLocalDateStr(selectedDate?: Date) {
  if (!selectedDate) return "";

  return `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`;
}

export function parseTimeToMinutes(value: string) {
  const match = value.trim().match(/(\d{1,2}):(\d{2})/);
  if (!match) return 0;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

export function isSlotInRange(
  timeSlot: string,
  startTime?: string,
  endTime?: string
) {
  if (!startTime && !endTime) return true;

  const parts = timeSlot.split(/[-－]/);
  if (parts.length < 2) return true;

  const slotStart = parseTimeToMinutes(parts[0]);
  const slotEnd = parseTimeToMinutes(parts[parts.length - 1]);
  const rangeStart = startTime ? parseTimeToMinutes(startTime) : 0;
  const rangeEnd = endTime ? parseTimeToMinutes(endTime) : 24 * 60;

  return slotStart < rangeEnd && slotEnd > rangeStart;
}

export function filterClassesByAbsenceWindow(
  classes: LessonItem[],
  teacher?: Pick<AbsentTeacherEntry, "absenceType" | "startTime" | "endTime">
) {
  if (!teacher || teacher.absenceType === "fullday") return classes;
  return classes.filter(lesson =>
    isSlotInRange(lesson.timeSlot, teacher.startTime, teacher.endTime)
  );
}

export function buildTeacherQueryOptions(absentTeachers: AbsentTeacherEntry[]) {
  return absentTeachers.filter(teacher => teacher.fullName);
}

export function buildMultiSuggestionsInput(
  dateStr: string,
  absentTeachers: AbsentTeacherEntry[],
  allowSwap: boolean
) {
  return {
    dateStr,
    absentTeachers: absentTeachers.map(teacher => ({
      fullName: teacher.fullName,
      ...(teacher.absenceType === "partial" && teacher.startTime
        ? { startTime: teacher.startTime }
        : {}),
      ...(teacher.absenceType === "partial" && teacher.endTime
        ? { endTime: teacher.endTime }
        : {}),
    })),
    allowSwap,
  };
}

export function filterTeachersBySearch(
  teachers: TeacherOption[],
  searchValue: string
) {
  const query = searchValue.trim().toLowerCase();
  if (!query) return teachers;

  return teachers.filter(
    teacher =>
      teacher.fullName.toLowerCase().includes(query) ||
      teacher.shortName.toLowerCase().includes(query)
  );
}

export function canProceedToConfirmation(
  selectedDate: Date | undefined,
  absentTeachers: AbsentTeacherEntry[]
) {
  if (!selectedDate || absentTeachers.length === 0) return false;

  return absentTeachers.every(
    teacher =>
      teacher.fullName &&
      (teacher.absenceType === "fullday" ||
        (teacher.startTime && teacher.endTime))
  );
}

export function getUsedSwapResources(
  allowSwap: boolean,
  allSelections: AllSelections,
  results: MultiTeacherSuggestionResult[] | undefined,
  substitutionTeacherIdx: number
) {
  const used = new Set<string>();
  if (!allowSwap || !results) return used;

  for (
    let teacherIdx = 0;
    teacherIdx < substitutionTeacherIdx;
    teacherIdx += 1
  ) {
    const teacherSelections = allSelections[teacherIdx] || {};
    const teacherSuggestions = results[teacherIdx]?.suggestions || [];

    for (const [idxStr, value] of Object.entries(teacherSelections)) {
      const suggestion = teacherSuggestions[Number(idxStr)];
      if (!suggestion || !value.startsWith("__SWAP__")) continue;

      const [swapTeacherFullName, swapTeacherTimeSlot] = value
        .slice("__SWAP__".length)
        .split("|||");
      if (swapTeacherFullName && swapTeacherTimeSlot) {
        used.add(`${swapTeacherFullName}|||${swapTeacherTimeSlot}`);
      }
    }
  }

  return used;
}

export function getUsedRegularResources(
  allSelections: AllSelections,
  results: MultiTeacherSuggestionResult[] | undefined,
  substitutionTeacherIdx: number
) {
  const used = new Set<string>();
  if (!results) return used;

  for (
    let teacherIdx = 0;
    teacherIdx < substitutionTeacherIdx;
    teacherIdx += 1
  ) {
    const teacherSelections = allSelections[teacherIdx] || {};
    const teacherSuggestions = results[teacherIdx]?.suggestions || [];

    for (const [idxStr, value] of Object.entries(teacherSelections)) {
      const suggestion = teacherSuggestions[Number(idxStr)];
      if (
        !suggestion ||
        !value ||
        value === "none" ||
        value.startsWith("__SWAP__")
      )
        continue;
      used.add(`${value}|||${suggestion.timeSlot}`);
    }
  }

  return used;
}

export function buildFinalReport(
  absentTeachers: AbsentTeacherEntry[],
  multiSuggestions: MultiTeacherSuggestionResult[] | undefined,
  allSelections: AllSelections
): ReportRow[] {
  const report: ReportRow[] = [];
  const isMultiTeacher = absentTeachers.length > 1;

  absentTeachers.forEach((teacher, teacherIdx) => {
    const teacherSuggestions =
      multiSuggestions?.find(
        result => result.teacherFullName === teacher.fullName
      )?.suggestions || [];
    const teacherSelections = allSelections[teacherIdx] || {};

    teacherSuggestions.forEach((suggestion, suggestionIdx) => {
      const value = teacherSelections[suggestionIdx];
      if (!value) return;

      const swapInfo = decodeSwapValue(value);
      if (swapInfo.isSwap) {
        report.push({
          timeSlot: suggestion.timeSlot,
          class: suggestion.className,
          subject: suggestion.subject,
          substitutionTeacher: swapInfo.swapTeacherFullName || "",
          absentTeacher: isMultiTeacher ? teacher.fullName : undefined,
          isSwap: true,
          swapNote: `${teacher.fullName} 於 ${swapInfo.swapTeacherTimeSlot} 先代 ${swapInfo.swapTeacherClassName} ${swapInfo.swapTeacherSubject}`,
        });
        return;
      }

      if (value === "none") {
        report.push({
          timeSlot: suggestion.timeSlot,
          class: suggestion.className,
          subject: suggestion.subject,
          substitutionTeacher: "無需代課",
          absentTeacher: isMultiTeacher ? teacher.fullName : undefined,
          isSwap: false,
        });
        return;
      }

      report.push({
        timeSlot: suggestion.timeSlot,
        class: suggestion.className,
        subject: suggestion.subject,
        substitutionTeacher: value,
        absentTeacher: isMultiTeacher ? teacher.fullName : undefined,
        isSwap: false,
      });
    });
  });

  return report;
}
