import type { AbsenceType, AbsentTeacherEntry, WorkflowStep } from "./types";

export const WORKFLOW_STEPS: WorkflowStep[] = [
  "input",
  "confirmation",
  "substitution",
  "report",
];

export const TIME_SLOTS = [
  { label: "07:45", value: "7:45" },
  { label: "08:10", value: "8:10" },
  { label: "08:30", value: "8:30" },
  { label: "09:05", value: "9:05" },
  { label: "09:40", value: "9:40" },
  { label: "09:50", value: "9:50" },
  { label: "10:25", value: "10:25" },
  { label: "11:00", value: "11:00" },
  { label: "11:20", value: "11:20" },
  { label: "11:55", value: "11:55" },
  { label: "12:30", value: "12:30" },
  { label: "13:05", value: "13:05" },
  { label: "13:35", value: "13:35" },
  { label: "14:00", value: "14:00" },
  { label: "14:30", value: "14:30" },
  { label: "15:00", value: "15:00" },
  { label: "15:05", value: "15:05" },
  { label: "15:40", value: "15:40" },
] as const;

export const DEFAULT_ABSENCE_TYPE: AbsenceType = "fullday";

export function createEmptyTeacherEntry(id: string): AbsentTeacherEntry {
  return {
    id,
    fullName: "",
    absenceType: DEFAULT_ABSENCE_TYPE,
    startTime: "",
    endTime: "",
  };
}
