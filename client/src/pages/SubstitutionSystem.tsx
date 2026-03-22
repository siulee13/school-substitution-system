import { useState } from 'react';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
// Checkbox 改用原生 HTML，避免 Radix UI hooks 衝突
import { CalendarIcon, ChevronRight, Loader2, Clock, ArrowLeftRight } from 'lucide-react';
import ClassConfirmation from '@/components/ClassConfirmation';
import SubstitutionSelection, { decodeSwapValue } from '@/components/SubstitutionSelection';
import SubstitutionReport, { type ReportRow } from '@/components/SubstitutionReport';

type WorkflowStep = 'input' | 'confirmation' | 'substitution' | 'report';
type AbsenceType = 'fullday' | 'partial';

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

export default function SubstitutionSystem() {
  const [step, setStep] = useState<WorkflowStep>('input');

  // 計算下一個工作日（週一至週五）作為預設日期
  const getNextWeekday = () => {
    const d = new Date();
    const day = d.getDay();
    // 如果是週六（day=6）加 2 天，週日（day=0）加 1 天，其他保持當天
    if (day === 6) d.setDate(d.getDate() + 2);
    else if (day === 0) d.setDate(d.getDate() + 1);
    return d;
  };

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(() => getNextWeekday());
  const [selectedTeacher, setSelectedTeacher] = useState<string>('');
  const [absenceType, setAbsenceType] = useState<AbsenceType>('fullday');
  const [startTime, setStartTime] = useState<string>('');
  const [endTime, setEndTime] = useState<string>('');
  const [allowSwap, setAllowSwap] = useState<boolean>(false);
  const [finalReport, setFinalReport] = useState<ReportRow[]>([]);

  // 查詢所有老師
  const { data: teachers = [], isLoading: teachersLoading } = trpc.substitution.getAllTeachers.useQuery();

  // 查詢該老師當日課堂
  // 使用本地日期字串（YYYY-MM-DD），避免 toISOString() 時區偏差
  const localDateStr = selectedDate
    ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`
    : '';

  const { data: classesByDate, isLoading: classesLoading } = trpc.substitution.getTeacherClasses.useQuery(
    {
      teacherFullName: selectedTeacher,
      dateStr: localDateStr,
    },
    {
      enabled: step === 'confirmation' && !!selectedTeacher && !!selectedDate,
    }
  );

  // 查詢代課建議（支援時段篩選及調課）
  const suggestionsInput = {
    dateStr: localDateStr,
    absentTeacherFullName: selectedTeacher,
    ...(absenceType === 'partial' && startTime ? { startTime } : {}),
    ...(absenceType === 'partial' && endTime ? { endTime } : {}),
    allowSwap,
  };

  const { data: suggestions, isLoading: suggestionsLoading } =
    trpc.substitution.generateSuggestions.useQuery(
      suggestionsInput,
      {
        enabled: step === 'substitution' && !!selectedTeacher && !!selectedDate,
      }
    );

  const handleProceedToConfirmation = () => {
    if (selectedDate && selectedTeacher) {
      // 如果是指定時段，驗證時間
      if (absenceType === 'partial' && (!startTime || !endTime)) {
        return;
      }
      setStep('confirmation');
    }
  };

  const handleConfirmClasses = () => {
    if (selectedDate && selectedTeacher) {
      setStep('substitution');
    }
  };

  const handleCompleteSubstitution = (selections: Record<number, string>) => {
    if (!suggestions) return;
    const report: ReportRow[] = suggestions
      .map((suggestion, idx) => {
        const value = selections[idx];
        if (!value) return null;
        const swapInfo = decodeSwapValue(value);
        if (swapInfo.isSwap) {
          return {
            timeSlot: suggestion.timeSlot,
            class: suggestion.className,
            subject: suggestion.subject,
            substitutionTeacher: swapInfo.swapTeacherFullName || '',
            isSwap: true,
            swapNote: `${selectedTeacher} 於 ${swapInfo.swapTeacherTimeSlot} 先代 ${swapInfo.swapTeacherClassName} ${swapInfo.swapTeacherSubject}`,
          } as ReportRow;
        }
        if (value === 'none') {
          return { timeSlot: suggestion.timeSlot, class: suggestion.className, subject: suggestion.subject, substitutionTeacher: '無需代課', isSwap: false } as ReportRow;
        }
        return { timeSlot: suggestion.timeSlot, class: suggestion.className, subject: suggestion.subject, substitutionTeacher: value, isSwap: false } as ReportRow;
      })
      .filter((item): item is ReportRow => item !== null);
    setFinalReport(report);
    setStep('report');
  };

  const handleReset = () => {
    setStep('input');
    setSelectedDate(getNextWeekday());
    setSelectedTeacher('');
    setAbsenceType('fullday');
    setStartTime('');
    setEndTime('');
    setAllowSwap(false);
    setFinalReport([]);
  };

  // 判斷是否可以繼續下一步
  const canProceed = selectedDate && selectedTeacher && (
    absenceType === 'fullday' || (absenceType === 'partial' && startTime && endTime)
  );

  // 過濾結束時間選項（必須在開始時間之後）
  const filteredEndTimes = startTime
    ? TIME_SLOTS.filter(t => {
        const startMin = parseInt(startTime.split(':')[0]) * 60 + parseInt(startTime.split(':')[1]);
        const tMin = parseInt(t.value.split(':')[0]) * 60 + parseInt(t.value.split(':')[1]);
        return tMin > startMin;
      })
    : TIME_SLOTS;

  // 顯示請假時段摘要
  const absenceSummary = absenceType === 'fullday'
    ? '全日'
    : startTime && endTime
      ? `${startTime} – ${endTime}`
      : '指定時段（未完整填寫）';

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

        {/* 主要內容區域 */}
        {step === 'input' && (
          <Card>
            <CardHeader>
              <CardTitle>第一步：選擇日期、老師及請假時段</CardTitle>
              <CardDescription>
                請選擇請假日期、老師及請假時段，系統將自動顯示受影響的課堂安排
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
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
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
                        // 禁止選擇週末（週六=6, 週日=0）
                        return day === 0 || day === 6;
                      }}
                    />
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-gray-500 mt-1">只能選擇週一至週五（學校工作日）</p>
              </div>

              {/* 請假時段選擇 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Clock className="inline-block mr-1 h-4 w-4" />
                  請假時段 *
                </label>
                <div className="flex gap-3 mb-3">
                  <label className={`flex-1 flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-colors ${absenceType === 'fullday' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input
                      type="radio"
                      name="absenceType"
                      value="fullday"
                      checked={absenceType === 'fullday'}
                      onChange={() => { setAbsenceType('fullday'); setStartTime(''); setEndTime(''); }}
                      className="w-4 h-4 text-blue-600"
                    />
                    <div>
                      <div className="font-medium text-gray-900">全日</div>
                      <div className="text-xs text-gray-500">涵蓋當天所有課堂</div>
                    </div>
                  </label>
                  <label className={`flex-1 flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-colors ${absenceType === 'partial' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input
                      type="radio"
                      name="absenceType"
                      value="partial"
                      checked={absenceType === 'partial'}
                      onChange={() => setAbsenceType('partial')}
                      className="w-4 h-4 text-blue-600"
                    />
                    <div>
                      <div className="font-medium text-gray-900">指定時段</div>
                      <div className="text-xs text-gray-500">只涵蓋部分課堂</div>
                    </div>
                  </label>
                </div>

                {/* 指定時段：開始/結束時間 */}
                {absenceType === 'partial' && (  
                  <div className="flex gap-3 items-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-600 mb-1">開始時間</label>
                      <Select value={startTime} onValueChange={(v) => { setStartTime(v); if (endTime && v >= endTime) setEndTime(''); }}>
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="選擇開始時間" />
                        </SelectTrigger>
                        <SelectContent>
                          {TIME_SLOTS.map(t => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="text-gray-400 mt-5">至</div>
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-600 mb-1">結束時間</label>
                      <Select value={endTime} onValueChange={setEndTime} disabled={!startTime}>
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="選擇結束時間" />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredEndTimes.map(t => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              {/* 容許調課選項 */}
              <div>
                <label
                  className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                    allowSwap ? 'border-purple-400 bg-purple-50' : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <input
                    id="allowSwap"
                    type="checkbox"
                    checked={allowSwap}
                    onChange={(e) => setAllowSwap(e.target.checked)}
                    className={`mt-0.5 w-4 h-4 cursor-pointer rounded border-2 ${
                      allowSwap ? 'accent-purple-600' : ''
                    }`}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <ArrowLeftRight className="h-4 w-4 text-purple-600" />
                      <span className="font-medium text-gray-900">容許調課</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      系統會檢查同日是否有其他老師可與請假老師互換課堂，
                      並優先推薦調課方案（請假老師在請假前先代另一老師的課，
                      該老師再代請假老師的課）。
                    </p>
                  </div>
                </label>
              </div>

              {/* 老師選擇平面清單 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  選擇請假老師 *
                </label>
                {teachersLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-600 mr-2" />
                    <span className="text-gray-600">載入老師列表中...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-96 overflow-y-auto border border-gray-200 rounded-lg p-4 bg-gray-50">
                    {teachers.map((teacher) => (
                      <label
                        key={teacher.fullName}
                        className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-colors ${
                          selectedTeacher === teacher.fullName
                            ? 'bg-blue-100 border border-blue-300'
                            : 'hover:bg-blue-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="teacher"
                          value={teacher.fullName}
                          checked={selectedTeacher === teacher.fullName}
                          onChange={(e) => setSelectedTeacher(e.target.value)}
                          className="w-4 h-4 text-blue-600 cursor-pointer"
                        />
                        <span className="flex-1">
                          <span className="font-medium text-gray-900">{teacher.fullName}</span>
                          <span className="text-gray-500 ml-2">({teacher.shortName})</span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                {!teachersLoading && teachers.length === 0 && (
                  <div className="text-center py-8 text-gray-600">
                    無法載入老師列表
                  </div>
                )}
              </div>

              {/* 選擇摘要 */}
              {selectedDate && selectedTeacher && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                  <strong>已選擇：</strong>
                  {format(selectedDate, 'yyyy年MM月dd日 (EEEE)', { locale: zhTW })}，
                  {selectedTeacher} 老師，
                  {absenceSummary}
                  {allowSwap && <span className="ml-2 text-purple-700 font-medium">（已開啟調課）</span>}
                </div>
              )}

              {/* 確認按鈕 */}
              <Button
                onClick={handleProceedToConfirmation}
                disabled={!canProceed}
                className="w-full"
                size="lg"
              >
                下一步：確認課堂 <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
              {absenceType === 'partial' && (!startTime || !endTime) && (
                <p className="text-sm text-amber-600 text-center">請選擇完整的開始及結束時間</p>
              )}
            </CardContent>
          </Card>
        )}

        {step === 'confirmation' && selectedTeacher && selectedDate && (
          <ClassConfirmation
            teacher={selectedTeacher}
            date={selectedDate}
            classes={classesByDate || []}
            isLoading={classesLoading}
            absenceType={absenceType}
            startTime={startTime}
            endTime={endTime}
            allowSwap={allowSwap}
            onConfirm={handleConfirmClasses}
            onBack={() => setStep('input')}
          />
        )}

        {step === 'substitution' && suggestions && (
          <SubstitutionSelection
            absentTeacher={selectedTeacher}
            date={selectedDate || new Date()}
            suggestions={suggestions}
            isLoading={suggestionsLoading}
            onConfirm={handleCompleteSubstitution}
            onBack={() => setStep('confirmation')}
          />
        )}

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
