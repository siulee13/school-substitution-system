import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, ChevronLeft, ChevronRight, Loader2, ArrowLeftRight } from 'lucide-react';

interface SwapCandidate {
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

interface SuggestionItem {
  timeSlot: string;
  className: string;
  subject: string;
  priorityTeachers: Array<{ fullName: string; shortName: string; subject: string; dailyLessonCount: number }>;
  otherTeachers: Array<{ fullName: string; shortName: string; dailyLessonCount: number }>;
  swapCandidates: SwapCandidate[];
}

interface SubstitutionSelectionProps {
  absentTeacher: string;
  date: Date;
  suggestions: SuggestionItem[];
  isLoading: boolean;
  excludedSwapResources?: Set<string>; // 已被前一位老師佔用的調課資源，格式：`${swapTeacherFullName}|||${swapTeacherTimeSlot}`
  excludedRegularResources?: Set<string>; // 已被前一位老師佔用的普通代課資源，格式：`${teacherFullName}|||${timeSlot}`
  usedTeacherCounts?: Map<string, number>; // 当前流程中已代課的次數，格式： teacherFullName -> 次數
  onConfirm: (selections: Record<number, string>) => void;
  onBack: () => void;
}

// 調課選項的特殊值前綴
const SWAP_PREFIX = '__SWAP__';

function encodeSwapValue(candidate: SwapCandidate): string {
  return `${SWAP_PREFIX}${candidate.swapTeacherFullName}|||${candidate.swapTeacherTimeSlot}|||${candidate.swapTeacherClassName}|||${candidate.swapTeacherSubject}`;
}

export function decodeSwapValue(value: string): { isSwap: boolean; swapTeacherFullName?: string; swapTeacherTimeSlot?: string; swapTeacherClassName?: string; swapTeacherSubject?: string } {
  if (!value.startsWith(SWAP_PREFIX)) return { isSwap: false };
  const parts = value.slice(SWAP_PREFIX.length).split('|||');
  return {
    isSwap: true,
    swapTeacherFullName: parts[0],
    swapTeacherTimeSlot: parts[1],
    swapTeacherClassName: parts[2],
    swapTeacherSubject: parts[3],
  };
}

export default function SubstitutionSelection({
  absentTeacher,
  date,
  suggestions,
  isLoading,
  excludedSwapResources,
  excludedRegularResources,
  usedTeacherCounts,
  onConfirm,
  onBack,
}: SubstitutionSelectionProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selections, setSelections] = useState<Record<number, string>>({});

  const currentSuggestion = suggestions[currentIndex];

  const handleSelectTeacher = (value: string) => {
    setSelections(prev => ({ ...prev, [currentIndex]: value }));
  };

  const handleNext = () => {
    if (currentIndex < suggestions.length - 1) setCurrentIndex(currentIndex + 1);
  };

  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  };

  const handleConfirm = () => {
    onConfirm(selections);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">載入代課建議中...</span>
        </CardContent>
      </Card>
    );
  }

  if (!currentSuggestion) {
    return (
      <Card>
        <CardContent className="py-8">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>無法載入代課建議，請返回重試。</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // 過濾已被前一位老師佔用的調課候選
  const availableSwapCandidates = currentSuggestion.swapCandidates?.filter(swap => {
    if (!excludedSwapResources) return true;
    const key = `${swap.swapTeacherFullName}|||${swap.swapTeacherTimeSlot}`;
    return !excludedSwapResources.has(key);
  }) || [];
  const hasSwapCandidates = availableSwapCandidates.length > 0;
  const currentValue = selections[currentIndex] || '';
  const selectedSwap = currentValue.startsWith(SWAP_PREFIX) ? decodeSwapValue(currentValue) : null;

  // 過濾已被前一位老師佔用的普通代課老師（同一時段不能同時代兩班）
  const isTeacherExcluded = (teacherFullName: string) => {
    if (!excludedRegularResources) return false;
    return excludedRegularResources.has(`${teacherFullName}|||${currentSuggestion.timeSlot}`);
  };

  // 獲取老師已代課次數（功能二）
  const getUsedCount = (teacherFullName: string): number => {
    return usedTeacherCounts?.get(teacherFullName) ?? 0;
  };

  // 生成老師顯示文字（包含節數和已代課標示）
  const formatTeacherLabel = (fullName: string, shortName: string, dailyLessonCount: number, extra?: string): string => {
    const lessonStr = `${dailyLessonCount}堂`;
    const usedCount = getUsedCount(fullName);
    const usedStr = usedCount > 0 ? ` ⚠已代${usedCount}堂` : '';
    const extraStr = extra ? ` — ${extra}` : '';
    return `${fullName} (${shortName}) [${lessonStr}${usedStr}]${extraStr}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>第三步：選擇代課老師</CardTitle>
        <CardDescription>
          為 {absentTeacher} 的每一節課選擇代課老師
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 當前課節資訊 */}
        <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-3 gap-4 border border-gray-200">
          <div>
            <p className="text-sm text-gray-600">時間</p>
            <p className="font-semibold text-lg">{currentSuggestion.timeSlot}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">班別</p>
            <p className="font-semibold text-lg">{currentSuggestion.className}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">科目</p>
            <p className="font-semibold text-lg">{currentSuggestion.subject}</p>
          </div>
        </div>

        {/* 調課建議區塊（優先顯示） */}
        {hasSwapCandidates && (
          <div className="rounded-lg border-2 border-purple-300 bg-purple-50 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 bg-purple-100 border-b border-purple-200">
              <ArrowLeftRight className="h-4 w-4 text-purple-700" />
              <span className="text-sm font-semibold text-purple-800">調課建議（優先）</span>
            </div>
            <div className="p-3 space-y-2">
              {availableSwapCandidates.map((swap, idx) => {
                const swapValue = encodeSwapValue(swap);
                const isSelected = currentValue === swapValue;
                return (
                  <button
                    key={idx}
                    onClick={() => handleSelectTeacher(isSelected ? '' : swapValue)}
                    className={`w-full text-left rounded-lg p-3 border-2 transition-colors ${
                      isSelected
                        ? 'border-purple-500 bg-purple-100'
                        : 'border-purple-200 bg-white hover:border-purple-400 hover:bg-purple-50'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${isSelected ? 'border-purple-600 bg-purple-600' : 'border-gray-400'}`}>
                        {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        {/* 調課說明：請假老師去代 A 老師的課 */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-purple-900">
                            {swap.swapTeacherFullName}（{swap.swapTeacherShortName}）
                          </span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-purple-200 text-purple-800">調課</span>
                        </div>
                        {/* 步驟一：請假老師去代 A 老師的課 */}
                        <p className="text-xs text-gray-600 mt-1">
                          <span className="font-medium text-blue-700">{absentTeacher}</span>
                          {' '}先於 {swap.swapTeacherTimeSlot} 代替{' '}
                          <span className="font-medium">{swap.swapTeacherFullName}</span>
                          {' '}上 {swap.swapTeacherClassName} {swap.swapTeacherSubject}
                        </p>
                        {/* 步驟二：A 老師代請假老師的課 */}
                        <p className="text-xs text-gray-600 mt-0.5">
                          <span className="font-medium text-purple-700">{swap.swapTeacherFullName}</span>
                          {' '}於 {swap.absentTeacherTimeSlot} 代替{' '}
                          <span className="font-medium">{absentTeacher}</span>
                          {' '}上 {swap.absentTeacherClassName} {swap.absentTeacherSubject}
                        </p>
                        <p className="text-xs text-amber-700 mt-1 font-medium">
                          ⚠ 需要 {absentTeacher} 在請假前於 {swap.swapTeacherTimeSlot} 完成調課
                        </p>
                        {/* 雙方同日班別說明 */}
                        {(swap.swapTeacherAllClasses?.length || swap.absentTeacherAllClasses?.length) ? (
                          <div className="mt-2 pt-2 border-t border-purple-100 grid grid-cols-2 gap-2">
                            {swap.swapTeacherAllClasses && swap.swapTeacherAllClasses.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-purple-700">{swap.swapTeacherFullName} 同日教：</p>
                                <p className="text-xs text-gray-600">{swap.swapTeacherAllClasses.join('、')}</p>
                              </div>
                            )}
                            {swap.absentTeacherAllClasses && swap.absentTeacherAllClasses.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-blue-700">{absentTeacher} 同日教：</p>
                                <p className="text-xs text-gray-600">{swap.absentTeacherAllClasses.join('、')}</p>
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 已選調課時的提示 */}
        {selectedSwap && selectedSwap.isSwap && (
          <div className="flex items-start gap-2 p-3 bg-purple-50 border border-purple-200 rounded-lg text-sm text-purple-800">
            <ArrowLeftRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>已選擇調課方案。最終報告將顯示調課安排詳情。</span>
          </div>
        )}

        {/* 代課老師選擇下拉選單 */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">
            {hasSwapCandidates ? '或選擇普通代課老師' : '選擇代課老師'}
          </label>
          <Select
            value={currentValue.startsWith(SWAP_PREFIX) ? '' : currentValue}
            onValueChange={handleSelectTeacher}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="選擇代課老師或無需代課" />
            </SelectTrigger>
            <SelectContent>
              {/* 無需代課選項 */}
              <SelectItem value="none">✗ 無需代課</SelectItem>

              {/* 科任老師（首選） */}
              {currentSuggestion.priorityTeachers.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-xs font-semibold text-green-700 bg-green-50">
                    ★ 首選：該班科任老師
                  </div>
                  {currentSuggestion.priorityTeachers.map((teacher) => {
                    const excluded = isTeacherExcluded(teacher.fullName);
                    return (
                      <SelectItem key={teacher.fullName} value={teacher.fullName} disabled={excluded}>
                        {excluded
                          ? `${teacher.fullName} (${teacher.shortName}) — ${teacher.subject} 【此時段已被佔用】`
                          : formatTeacherLabel(teacher.fullName, teacher.shortName, teacher.dailyLessonCount, teacher.subject)
                        }
                      </SelectItem>
                    );
                  })}
                </>
              )}

              {/* 其他空堂老師（次選） */}
              {currentSuggestion.otherTeachers.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-xs font-semibold text-gray-700 bg-gray-50">
                    次選：其他空堂老師
                  </div>
                  {currentSuggestion.otherTeachers.map((teacher) => {
                    const excluded = isTeacherExcluded(teacher.fullName);
                    return (
                      <SelectItem key={teacher.fullName} value={teacher.fullName} disabled={excluded}>
                        {excluded
                          ? `${teacher.fullName} (${teacher.shortName}) 【此時段已被佔用】`
                          : formatTeacherLabel(teacher.fullName, teacher.shortName, teacher.dailyLessonCount)
                        }
                      </SelectItem>
                    );
                  })}
                </>
              )}
            </SelectContent>
          </Select>

          {/* 無可用老師警告 */}
          {!hasSwapCandidates &&
            currentSuggestion.priorityTeachers.length === 0 &&
            currentSuggestion.otherTeachers.length === 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  此時段無空堂老師可用。請選擇「無需代課」或手動指派。
                </AlertDescription>
              </Alert>
            )}
        </div>

        {/* 進度條 */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / suggestions.length) * 100}%` }}
          />
        </div>
        <p className="text-center text-sm text-gray-600">
          第 {currentIndex + 1} / {suggestions.length} 節課
        </p>

        {/* 導航按鈕 */}
        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={handlePrev} disabled={currentIndex === 0} className="flex-1">
            <ChevronLeft className="mr-2 h-4 w-4" />上一節
          </Button>
          {currentIndex < suggestions.length - 1 ? (
            <Button onClick={handleNext} className="flex-1">
              下一節<ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleConfirm} className="flex-1 bg-green-600 hover:bg-green-700">
              確認並生成報告<ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>

        <Button variant="outline" onClick={onBack} className="w-full">返回</Button>
      </CardContent>
    </Card>
  );
}
