import type { ReportRow } from "@/components/SubstitutionReport";

export type WorkflowStep = "input" | "confirmation" | "substitution" | "report";
export type AbsenceType = "fullday" | "partial";

export interface TeacherOption {
  fullName: string;
  shortName: string;
}

export interface AbsentTeacherEntry {
  id: string;
  fullName: string;
  absenceType: AbsenceType;
  startTime: string;
  endTime: string;
}

export interface LessonItem {
  timeSlot: string;
  className: string;
  subject: string;
}

export interface SwapCandidate {
  swapTeacherFullName: string;
  swapTeacherShortName: string;
  swapTeacherTimeSlot: string;
  swapTeacherClassName: string;
  swapTeacherSubject: string;
  absentTeacherTimeSlot: string;
  absentTeacherClassName: string;
  absentTeacherSubject: string;
  swapTeacherAllClasses?: string[];
  absentTeacherAllClasses?: string[];
}

export interface SuggestionTeacher extends TeacherOption {
  subject?: string;
}

export interface SuggestionItem extends LessonItem {
  priorityTeachers: SuggestionTeacher[];
  otherTeachers: TeacherOption[];
  swapCandidates: SwapCandidate[];
}

export interface MultiTeacherSuggestionResult {
  teacherFullName: string;
  suggestions: SuggestionItem[];
}

export type TeacherSelections = Record<number, string>;
export type AllSelections = Record<number, TeacherSelections>;
export type FinalReport = ReportRow[];
