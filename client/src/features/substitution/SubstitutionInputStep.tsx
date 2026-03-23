import { format } from "date-fns";
import { zhTW } from "date-fns/locale";
import {
  ArrowLeftRight,
  CalendarIcon,
  Clock,
  Loader2,
  Plus,
  Search,
  Users,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TIME_SLOTS } from "./constants";
import { filterTeachersBySearch } from "./utils";
import type { AbsentTeacherEntry, TeacherOption } from "./types";

interface SubstitutionInputStepProps {
  selectedDate?: Date;
  allowSwap: boolean;
  absentTeachers: AbsentTeacherEntry[];
  teacherSearchMap: Record<string, string>;
  teachers: TeacherOption[];
  teachersLoading: boolean;
  teachersFetching: boolean;
  canProceed: boolean;
  isMultiTeacher: boolean;
  onSelectedDateChange: (date: Date | undefined) => void;
  onAllowSwapChange: (enabled: boolean) => void;
  onAddTeacher: () => void;
  onRemoveTeacher: (id: string) => void;
  onTeacherSearchChange: (id: string, value: string) => void;
  onTeacherChange: (
    id: string,
    field: keyof AbsentTeacherEntry,
    value: string
  ) => void;
  onProceed: () => void;
}

export default function SubstitutionInputStep({
  selectedDate,
  allowSwap,
  absentTeachers,
  teacherSearchMap,
  teachers,
  teachersLoading,
  teachersFetching,
  canProceed,
  isMultiTeacher,
  onSelectedDateChange,
  onAllowSwapChange,
  onAddTeacher,
  onRemoveTeacher,
  onTeacherSearchChange,
  onTeacherChange,
  onProceed,
}: SubstitutionInputStepProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>第一步：選擇日期、老師及請假時段</CardTitle>
        <CardDescription>
          請選擇請假日期及老師，可同時安排多位老師請假
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            選擇日期 *
          </label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate
                  ? format(selectedDate, "yyyy年MM月dd日 (EEEE)", {
                      locale: zhTW,
                    })
                  : "選擇日期"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={onSelectedDateChange}
                disabled={date => date.getDay() === 0 || date.getDay() === 6}
              />
            </PopoverContent>
          </Popover>
          <p className="text-xs text-gray-500 mt-1">
            只能選擇週一至週五（學校工作日）
          </p>
        </div>

        <div>
          <label
            className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
              allowSwap
                ? "border-purple-400 bg-purple-50"
                : "border-gray-200 hover:border-gray-300 bg-white"
            }`}
          >
            <input
              type="checkbox"
              checked={allowSwap}
              onChange={event => onAllowSwapChange(event.target.checked)}
              className={`mt-0.5 w-4 h-4 cursor-pointer rounded border-2 ${allowSwap ? "accent-purple-600" : ""}`}
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="h-4 w-4 text-purple-600" />
                <span className="font-medium text-gray-900">容許調課</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                系統會檢查同日是否有其他老師可與請假老師互換課堂，並優先推薦調課方案。
              </p>
            </div>
          </label>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-gray-700">
              <Users className="inline-block mr-1 h-4 w-4" />
              請假老師 *
              {isMultiTeacher && (
                <Badge variant="secondary" className="ml-2">
                  {absentTeachers.length} 位
                </Badge>
              )}
            </label>
            <Button
              variant="outline"
              size="sm"
              onClick={onAddTeacher}
              className="text-blue-600 border-blue-300 hover:bg-blue-50"
            >
              <Plus className="h-4 w-4 mr-1" />
              新增老師
            </Button>
          </div>

          <div className="space-y-4">
            {absentTeachers.map((entry, entryIdx) => {
              const searchValue = teacherSearchMap[entry.id] || "";
              const filteredTeachers = filterTeachersBySearch(
                teachers,
                searchValue
              );

              return (
                <div
                  key={entry.id}
                  className="border border-gray-200 rounded-lg p-4 bg-white space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">
                      {isMultiTeacher ? `老師 ${entryIdx + 1}` : "請假老師"}
                    </span>
                    {isMultiTeacher && (
                      <button
                        onClick={() => onRemoveTeacher(entry.id)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {teachersLoading || teachersFetching ? (
                    <div className="flex items-center py-2">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600 mr-2" />
                      <span className="text-sm text-gray-600">
                        載入老師列表中...
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                        <Input
                          type="text"
                          placeholder="搜尋老師姓名或簡稱..."
                          value={searchValue}
                          onChange={event =>
                            onTeacherSearchChange(entry.id, event.target.value)
                          }
                          className="pl-8 h-8 text-sm bg-white"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto border border-gray-100 rounded-lg p-2 bg-gray-50">
                        {filteredTeachers.length === 0 ? (
                          <div className="col-span-2 py-4 text-center text-sm text-gray-400">
                            {searchValue.trim() ? (
                              `找不到符合「${searchValue.trim()}」的老師`
                            ) : teachers.length === 0 ? (
                              <span className="flex items-center justify-center gap-1">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                載入中...
                              </span>
                            ) : (
                              "無老師資料"
                            )}
                          </div>
                        ) : (
                          filteredTeachers.map(teacher => (
                            <label
                              key={teacher.fullName}
                              className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors text-sm ${
                                entry.fullName === teacher.fullName
                                  ? "bg-blue-100 border border-blue-300"
                                  : "hover:bg-blue-50"
                              }`}
                            >
                              <input
                                type="radio"
                                name={`teacher-${entry.id}`}
                                value={teacher.fullName}
                                checked={entry.fullName === teacher.fullName}
                                onChange={event =>
                                  onTeacherChange(
                                    entry.id,
                                    "fullName",
                                    event.target.value
                                  )
                                }
                                className="w-3.5 h-3.5 text-blue-600 cursor-pointer"
                              />
                              <span className="font-medium text-gray-900">
                                {teacher.fullName}
                              </span>
                              <span className="text-gray-500">
                                ({teacher.shortName})
                              </span>
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-2">
                      <Clock className="inline-block mr-1 h-3.5 w-3.5" />
                      請假時段
                    </label>
                    <div className="flex gap-2 mb-2">
                      <label
                        className={`flex-1 flex items-center gap-1.5 p-2 rounded-lg border-2 cursor-pointer transition-colors text-sm ${
                          entry.absenceType === "fullday"
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`absenceType-${entry.id}`}
                          value="fullday"
                          checked={entry.absenceType === "fullday"}
                          onChange={() => {
                            onTeacherChange(entry.id, "absenceType", "fullday");
                            onTeacherChange(entry.id, "startTime", "");
                            onTeacherChange(entry.id, "endTime", "");
                          }}
                          className="w-3.5 h-3.5 text-blue-600"
                        />
                        <span className="font-medium">全日</span>
                      </label>
                      <label
                        className={`flex-1 flex items-center gap-1.5 p-2 rounded-lg border-2 cursor-pointer transition-colors text-sm ${
                          entry.absenceType === "partial"
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`absenceType-${entry.id}`}
                          value="partial"
                          checked={entry.absenceType === "partial"}
                          onChange={() =>
                            onTeacherChange(entry.id, "absenceType", "partial")
                          }
                          className="w-3.5 h-3.5 text-blue-600"
                        />
                        <span className="font-medium">指定時段</span>
                      </label>
                    </div>

                    {entry.absenceType === "partial" && (
                      <div className="flex gap-2 items-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex-1">
                          <label className="block text-xs text-gray-600 mb-1">
                            開始
                          </label>
                          <Select
                            value={entry.startTime}
                            onValueChange={value => {
                              onTeacherChange(entry.id, "startTime", value);
                              if (entry.endTime && value >= entry.endTime) {
                                onTeacherChange(entry.id, "endTime", "");
                              }
                            }}
                          >
                            <SelectTrigger className="bg-white h-8 text-sm">
                              <SelectValue placeholder="開始時間" />
                            </SelectTrigger>
                            <SelectContent>
                              {TIME_SLOTS.map(timeSlot => (
                                <SelectItem
                                  key={timeSlot.value}
                                  value={timeSlot.value}
                                >
                                  {timeSlot.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="text-gray-400 mt-4 text-xs">至</div>
                        <div className="flex-1">
                          <label className="block text-xs text-gray-600 mb-1">
                            結束
                          </label>
                          <Select
                            value={entry.endTime}
                            onValueChange={value =>
                              onTeacherChange(entry.id, "endTime", value)
                            }
                            disabled={!entry.startTime}
                          >
                            <SelectTrigger className="bg-white h-8 text-sm">
                              <SelectValue placeholder="結束時間" />
                            </SelectTrigger>
                            <SelectContent>
                              {TIME_SLOTS.filter(timeSlot => {
                                if (!entry.startTime) return true;
                                const [startHour, startMinute] = entry.startTime
                                  .split(":")
                                  .map(Number);
                                const [timeHour, timeMinute] = timeSlot.value
                                  .split(":")
                                  .map(Number);
                                return (
                                  timeHour * 60 + timeMinute >
                                  startHour * 60 + startMinute
                                );
                              }).map(timeSlot => (
                                <SelectItem
                                  key={timeSlot.value}
                                  value={timeSlot.value}
                                >
                                  {timeSlot.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {selectedDate && absentTeachers.some(teacher => teacher.fullName) && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
            <strong>已選擇：</strong>
            {format(selectedDate, "yyyy年MM月dd日 (EEEE)", { locale: zhTW })}
            {allowSwap && (
              <span className="ml-2 text-purple-700 font-medium">
                （已開啟調課）
              </span>
            )}
            <div className="mt-1 space-y-0.5">
              {absentTeachers
                .filter(teacher => teacher.fullName)
                .map(teacher => (
                  <div key={teacher.id} className="text-xs">
                    {teacher.fullName}：
                    {teacher.absenceType === "fullday"
                      ? "全日"
                      : teacher.startTime && teacher.endTime
                        ? `${teacher.startTime} – ${teacher.endTime}`
                        : "時段未填寫"}
                  </div>
                ))}
            </div>
          </div>
        )}

        <Button
          onClick={onProceed}
          disabled={!canProceed}
          className="w-full"
          size="lg"
        >
          下一步：確認課堂
        </Button>
      </CardContent>
    </Card>
  );
}
