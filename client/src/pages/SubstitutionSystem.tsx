import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, ChevronRight, ChevronLeft, Loader2, Clock, ArrowLeftRight, Plus, X, Users } from 'lucide-react';
import ClassConfirmation from '@/components/ClassConfirmation';
import SubstitutionSelection, { decodeSwapValue } from '@/components/SubstitutionSelection';
import SubstitutionReport, { type ReportRow } from '@/components/SubstitutionReport';

type WorkflowStep = 'input' | 'confirmation' | 'substitution' | 'report';
type AbsenceType = 'fullday' | 'partial';

interface AbsentTeacherEntry {
  id: string; // unique key
  fullName: string;
  absenceType: AbsenceType;
  startTime: string;
  endTime: string;
}

// 所有課堂時間段（按順序排列）
const TIME_SLOTS = [
  { label: '07:45', value: '7:45' },
  { label: '08:10', value: '8:10' },
  { label: '08:30', value: '8:30' },
  { label: '09:05', value: '9:05' },
  { label: '09:40', value: '9:40' },
  { label: '09:50', value: '9:50' },
  { label: '10:25', value: '10:25' },
  { label: '11:00', value: '11:00' },
  { label: '11:20', value: '11:20' },
  { label: '11:55', value: '11:55' },
  { label: '12:30', value: '12:30' },
  { label: '13:05', value: '13:05' },
  { label: '13:35', value: '13:35' },
  { label: '14:00', value: '14:00' },
  { label: '14:30', value: '14:30' },
  { label: '15:00', value: '15:00' },
  { label: '15:05', value: '15:05' },
  { label: '15:40', value: '15:40' },
];

function getNextWeekday(): Date {
  const d = new Date();
  const day = d.getDay();
  if (day === 6) d.setDate(d.getDate() + 2);
  else if (day === 0) d.setDate(d.getDate() + 1);
  return d;
}

function makeId() {
  return Math.random().toString(36).slice(2, 9);
}

export default function SubstitutionSystem() {
  const [step, setStep] = useState<WorkflowStep>('input');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(() => getNextWeekday());
  const [allowSwap, setAllowSwap] = useState<boolean>(false);
  const [finalReport, setFinalReport] = useState<ReportRow[]>([]);

  // 多位請假老師列表
  const [absentTeachers, setAbsentTeachers] = useState<AbsentTeacherEntry[]>([
    { id: makeId(), fullName: '', absenceType: 'fullday', startTime: '', endTime: '' },
  ]);

  // 第二步：目前確認哪位老師（索引）
  const [confirmationIdx, setConfirmationIdx] = useState(0);

  // 第三步：目前編排哪位老師（索引）
  const [substitutionTeacherIdx, setSubstitutionTeacherIdx] = useState(0);

  // 儲存每位老師的代課選擇（key: teacherIdx, value: selections map）
  const [allSelections, setAllSelections] = useState<Record<number, Record<number, string>>>({});

  // 查詢所有老師
  const { data: teachers = [], isLoading: teachersLoading } = trpc.substitution.getAllTeachers.useQuery();

  const localDateStr = useMemo(() => selectedDate
    ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`
    : '', [selectedDate]);

  // 第二步：查詢當前確認老師的課堂
  const currentConfirmTeacher = absentTeachers[confirmationIdx];
  const { data: classesByDate, isLoading: classesLoading } = trpc.substitution.getTeacherClasses.useQuery(
    {
      teacherFullName: currentConfirmTeacher?.fullName || '',
      dateStr: localDateStr,
    },
    {
      enabled: step === 'confirmation' && !!currentConfirmTeacher?.fullName && !!selectedDate,
    }
  );

  // 第三步：使用 generateSuggestionsMulti 查詢所有老師的代課建議
  const validTeachers = absentTeachers.filter(t => t.fullName);
  const multiSuggestionsInput = useMemo(() => ({
    dateStr: localDateStr,
    absentTeachers: validTeachers.map(t => ({
      fullName: t.fullName,
      ...(t.absenceType === 'partial' && t.startTime ? { startTime: t.startTime } : {}),
      ...(t.absenceType === 'partial' && t.endTime ? { endTime: t.endTime } : {}),
    })),
    allowSwap,
  }), [localDateStr, JSON.stringify(validTeachers), allowSwap]);

  const { data: multiSuggestions, isLoading: multiSuggestionsLoading } =
    trpc.substitution.generateSuggestionsMulti.useQuery(
      multiSuggestionsInput,
      {
        enabled: step === 'substitution' && validTeachers.length > 0 && !!selectedDate,
      }
    );

  // 當前編排老師的建議
  const currentSubstTeacher = absentTeachers[substitutionTeacherIdx];
  const currentSuggestions = multiSuggestions?.find(
    r => r.teacherFullName === currentSubstTeacher?.fullName
  )?.suggestions || [];

  // 更新某位老師的欄位
  const updateTeacher = (id: string, field: keyof AbsentTeacherEntry, value: string) => {
    setAbsentTeachers(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const addTeacher = () => {
    setAbsentTeachers(prev => [...prev, { id: makeId(), fullName: '', absenceType: 'fullday', startTime: '', endTime: '' }]);
  };

  const removeTeacher = (id: string) => {
    if (absentTeachers.length <= 1) return;
    setAbsentTeachers(prev => prev.filter(t => t.id !== id));
  };

  const handleProceedToConfirmation = () => {
    const valid = absentTeachers.every(t =>
      t.fullName && (t.absenceType === 'fullday' || (t.startTime && t.endTime))
    );
    if (selectedDate && valid) {
      setConfirmationIdx(0);
      setStep('confirmation');
    }
  };

  const handleConfirmCurrentTeacher = () => {
    if (confirmationIdx < absentTeachers.length - 1) {
      setConfirmationIdx(confirmationIdx + 1);
    } else {
      setSubstitutionTeacherIdx(0);
      setAllSelections({});
      setStep('substitution');
    }
  };

  const handleCompleteSubstitutionForTeacher = (selections: Record<number, string>) => {
    const newAllSelections = { ...allSelections, [substitutionTeacherIdx]: selections };
    setAllSelections(newAllSelections);

    if (substitutionTeacherIdx < absentTeachers.length - 1) {
      // 還有下一位老師
      setSubstitutionTeacherIdx(substitutionTeacherIdx + 1);
    } else {
      // 所有老師都完成，生成最終報告
      const report: ReportRow[] = [];
      const isMulti = absentTeachers.length > 1;

      absentTeachers.forEach((teacher, tIdx) => {
        const teacherSuggestions = multiSuggestions?.find(
          r => r.teacherFullName === teacher.fullName
        )?.suggestions || [];
        const teacherSelections = newAllSelections[tIdx] || {};

        teacherSuggestions.forEach((suggestion, idx) => {
          const value = teacherSelections[idx];
          if (!value) return;
          const swapInfo = decodeSwapValue(value);
          if (swapInfo.isSwap) {
            report.push({
              timeSlot: suggestion.timeSlot,
              class: suggestion.className,
              subject: suggestion.subject,
              substitutionTeacher: swapInfo.swapTeacherFullName || '',
              absentTeacher: isMulti ? teacher.fullName : undefined,
              isSwap: true,
              swapNote: `${teacher.fullName} 於 ${swapInfo.swapTeacherTimeSlot} 先代 ${swapInfo.swapTeacherClassName} ${swapInfo.swapTeacherSubject}`,
            });
          } else if (value === 'none') {
            report.push({
              timeSlot: suggestion.timeSlot,
              class: suggestion.className,
              subject: suggestion.subject,
              substitutionTeacher: '無需代課',
              absentTeacher: isMulti ? teacher.fullName : undefined,
              isSwap: false,
            });
          } else {
            report.push({
              timeSlot: suggestion.timeSlot,
              class: suggestion.className,
              subject: suggestion.subject,
              substitutionTeacher: value,
              absentTeacher: isMulti ? teacher.fullName : undefined,
              isSwap: false,
            });
          }
        });
      });

      setFinalReport(report);
      setStep('report');
    }
  };

  const handleReset = () => {
    setStep('input');
    setSelectedDate(getNextWeekday());
    setAllowSwap(false);
    setFinalReport([]);
    setAbsentTeachers([{ id: makeId(), fullName: '', absenceType: 'fullday', startTime: '', endTime: '' }]);
    setConfirmationIdx(0);
    setSubstitutionTeacherIdx(0);
    setAllSelections({});
  };

  const canProceed = selectedDate && absentTeachers.length > 0 && absentTeachers.every(t =>
    t.fullName && (t.absenceType === 'fullday' || (t.startTime && t.endTime))
  );

  const isMultiTeacher = absentTeachers.length > 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* 標題 */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            校園代課編排系統
          </h1>
          <p className="text-gray-600">
            快速安排老師請假時的代課事宜
          </p>
        </div>

        {/* 進度指示器 */}
        <div className="mb-8 flex items-center justify-between">
          {['input', 'confirmation', 'substitution', 'report'].map((s, idx) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  step === s
                    ? 'bg-blue-600 text-white'
                    : ['confirmation', 'substitution', 'report'].includes(step) &&
                      ['confirmation', 'substitution', 'report'].indexOf(step) > idx
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-300 text-gray-600'
                }`}
              >
                {idx + 1}
              </div>
              {idx < 3 && (
                <div
                  className={`w-16 h-1 mx-2 ${
                    ['confirmation', 'substitution', 'report'].includes(step) &&
                    ['confirmation', 'substitution', 'report'].indexOf(step) > idx
                      ? 'bg-green-600'
                      : 'bg-gray-300'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* 第一步：輸入 */}
        {step === 'input' && (
          <Card>
            <CardHeader>
              <CardTitle>第一步：選擇日期、老師及請假時段</CardTitle>
              <CardDescription>
                請選擇請假日期及老師，可同時安排多位老師請假
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 日期選擇器 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  選擇日期 *
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate
                        ? format(selectedDate, 'yyyy年MM月dd日 (EEEE)', { locale: zhTW })
                        : '選擇日期'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      disabled={(date) => {
                        const day = date.getDay();
                        return day === 0 || day === 6;
                      }}
                    />
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-gray-500 mt-1">只能選擇週一至週五（學校工作日）</p>
              </div>

              {/* 容許調課選項 */}
              <div>
                <label
                  className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                    allowSwap ? 'border-purple-400 bg-purple-50' : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={allowSwap}
                    onChange={(e) => setAllowSwap(e.target.checked)}
                    className={`mt-0.5 w-4 h-4 cursor-pointer rounded border-2 ${allowSwap ? 'accent-purple-600' : ''}`}
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

              {/* 請假老師列表 */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700">
                    <Users className="inline-block mr-1 h-4 w-4" />
                    請假老師 *
                    {isMultiTeacher && (
                      <Badge variant="secondary" className="ml-2">{absentTeachers.length} 位</Badge>
                    )}
                  </label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addTeacher}
                    className="text-blue-600 border-blue-300 hover:bg-blue-50"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    新增老師
                  </Button>
                </div>

                <div className="space-y-4">
                  {absentTeachers.map((entry, entryIdx) => (
                    <div
                      key={entry.id}
                      className="border border-gray-200 rounded-lg p-4 bg-white space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-600">
                          {isMultiTeacher ? `老師 ${entryIdx + 1}` : '請假老師'}
                        </span>
                        {isMultiTeacher && (
                          <button
                            onClick={() => removeTeacher(entry.id)}
                            className="text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      {/* 老師選擇 */}
                      {teachersLoading ? (
                        <div className="flex items-center py-2">
                          <Loader2 className="h-4 w-4 animate-spin text-blue-600 mr-2" />
                          <span className="text-sm text-gray-600">載入老師列表中...</span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto border border-gray-100 rounded-lg p-2 bg-gray-50">
                          {teachers.map((teacher) => (
                            <label
                              key={teacher.fullName}
                              className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors text-sm ${
                                entry.fullName === teacher.fullName
                                  ? 'bg-blue-100 border border-blue-300'
                                  : 'hover:bg-blue-50'
                              }`}
                            >
                              <input
                                type="radio"
                                name={`teacher-${entry.id}`}
                                value={teacher.fullName}
                                checked={entry.fullName === teacher.fullName}
                                onChange={(e) => updateTeacher(entry.id, 'fullName', e.target.value)}
                                className="w-3.5 h-3.5 text-blue-600 cursor-pointer"
                              />
                              <span className="font-medium text-gray-900">{teacher.fullName}</span>
                              <span className="text-gray-500">({teacher.shortName})</span>
                            </label>
                          ))}
                        </div>
                      )}

                      {/* 請假時段 */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-2">
                          <Clock className="inline-block mr-1 h-3.5 w-3.5" />
                          請假時段
                        </label>
                        <div className="flex gap-2 mb-2">
                          <label className={`flex-1 flex items-center gap-1.5 p-2 rounded-lg border-2 cursor-pointer transition-colors text-sm ${entry.absenceType === 'fullday' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                            <input
                              type="radio"
                              name={`absenceType-${entry.id}`}
                              value="fullday"
                              checked={entry.absenceType === 'fullday'}
                              onChange={() => {
                                updateTeacher(entry.id, 'absenceType', 'fullday');
                                updateTeacher(entry.id, 'startTime', '');
                                updateTeacher(entry.id, 'endTime', '');
                              }}
                              className="w-3.5 h-3.5 text-blue-600"
                            />
                            <span className="font-medium">全日</span>
                          </label>
                          <label className={`flex-1 flex items-center gap-1.5 p-2 rounded-lg border-2 cursor-pointer transition-colors text-sm ${entry.absenceType === 'partial' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                            <input
                              type="radio"
                              name={`absenceType-${entry.id}`}
                              value="partial"
                              checked={entry.absenceType === 'partial'}
                              onChange={() => updateTeacher(entry.id, 'absenceType', 'partial')}
                              className="w-3.5 h-3.5 text-blue-600"
                            />
                            <span className="font-medium">指定時段</span>
                          </label>
                        </div>

                        {entry.absenceType === 'partial' && (
                          <div className="flex gap-2 items-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="flex-1">
                              <label className="block text-xs text-gray-600 mb-1">開始</label>
                              <Select
                                value={entry.startTime}
                                onValueChange={(v) => {
                                  updateTeacher(entry.id, 'startTime', v);
                                  if (entry.endTime && v >= entry.endTime) updateTeacher(entry.id, 'endTime', '');
                                }}
                              >
                                <SelectTrigger className="bg-white h-8 text-sm">
                                  <SelectValue placeholder="開始時間" />
                                </SelectTrigger>
                                <SelectContent>
                                  {TIME_SLOTS.map(t => (
                                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="text-gray-400 mt-4 text-xs">至</div>
                            <div className="flex-1">
                              <label className="block text-xs text-gray-600 mb-1">結束</label>
                              <Select
                                value={entry.endTime}
                                onValueChange={(v) => updateTeacher(entry.id, 'endTime', v)}
                                disabled={!entry.startTime}
                              >
                                <SelectTrigger className="bg-white h-8 text-sm">
                                  <SelectValue placeholder="結束時間" />
                                </SelectTrigger>
                                <SelectContent>
                                  {TIME_SLOTS.filter(t => {
                                    if (!entry.startTime) return true;
                                    const startMin = parseInt(entry.startTime.split(':')[0]) * 60 + parseInt(entry.startTime.split(':')[1]);
                                    const tMin = parseInt(t.value.split(':')[0]) * 60 + parseInt(t.value.split(':')[1]);
                                    return tMin > startMin;
                                  }).map(t => (
                                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 選擇摘要 */}
              {selectedDate && absentTeachers.some(t => t.fullName) && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                  <strong>已選擇：</strong>
                  {format(selectedDate, 'yyyy年MM月dd日 (EEEE)', { locale: zhTW })}
                  {allowSwap && <span className="ml-2 text-purple-700 font-medium">（已開啟調課）</span>}
                  <div className="mt-1 space-y-0.5">
                    {absentTeachers.filter(t => t.fullName).map(t => (
                      <div key={t.id} className="text-xs">
                        {t.fullName}：{t.absenceType === 'fullday' ? '全日' : t.startTime && t.endTime ? `${t.startTime} – ${t.endTime}` : '時段未填寫'}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button
                onClick={handleProceedToConfirmation}
                disabled={!canProceed}
                className="w-full"
                size="lg"
              >
                下一步：確認課堂 <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 第二步：確認課堂（分頁） */}
        {step === 'confirmation' && currentConfirmTeacher && selectedDate && (
          <div className="space-y-3">
            {isMultiTeacher && (
              <div className="flex items-center justify-between bg-white rounded-lg px-4 py-2 border border-gray-200 text-sm text-gray-600">
                <span>確認課堂：第 {confirmationIdx + 1} / {absentTeachers.length} 位老師</span>
                <div className="flex gap-1">
                  {absentTeachers.map((t, i) => (
                    <div
                      key={t.id}
                      className={`w-2 h-2 rounded-full ${i < confirmationIdx ? 'bg-green-500' : i === confirmationIdx ? 'bg-blue-500' : 'bg-gray-300'}`}
                    />
                  ))}
                </div>
              </div>
            )}
            <ClassConfirmation
              teacher={currentConfirmTeacher.fullName}
              date={selectedDate}
              classes={classesByDate || []}
              isLoading={classesLoading}
              absenceType={currentConfirmTeacher.absenceType}
              startTime={currentConfirmTeacher.startTime}
              endTime={currentConfirmTeacher.endTime}
              allowSwap={allowSwap}
              onConfirm={handleConfirmCurrentTeacher}
              onBack={() => {
                if (confirmationIdx > 0) setConfirmationIdx(confirmationIdx - 1);
                else setStep('input');
              }}
            />
          </div>
        )}

        {/* 第三步：代課選擇（分位老師） */}
        {step === 'substitution' && currentSubstTeacher && (
          <div className="space-y-3">
            {isMultiTeacher && (
              <div className="flex items-center justify-between bg-white rounded-lg px-4 py-2 border border-gray-200 text-sm text-gray-600">
                <span>編排代課：第 {substitutionTeacherIdx + 1} / {absentTeachers.length} 位老師</span>
                <div className="flex gap-1">
                  {absentTeachers.map((t, i) => (
                    <div
                      key={t.id}
                      className={`w-2 h-2 rounded-full ${allSelections[i] ? 'bg-green-500' : i === substitutionTeacherIdx ? 'bg-blue-500' : 'bg-gray-300'}`}
                    />
                  ))}
                </div>
              </div>
            )}
            <SubstitutionSelection
              absentTeacher={currentSubstTeacher.fullName}
              date={selectedDate || new Date()}
              suggestions={currentSuggestions}
              isLoading={multiSuggestionsLoading}
              onConfirm={handleCompleteSubstitutionForTeacher}
              onBack={() => {
                if (substitutionTeacherIdx > 0) {
                  setSubstitutionTeacherIdx(substitutionTeacherIdx - 1);
                } else {
                  setConfirmationIdx(absentTeachers.length - 1);
                  setStep('confirmation');
                }
              }}
            />
          </div>
        )}

        {/* 第四步：報告 */}
        {step === 'report' && finalReport.length > 0 && (
          <SubstitutionReport
            report={finalReport}
            onReset={handleReset}
          />
        )}
      </div>
    </div>
  );
}
