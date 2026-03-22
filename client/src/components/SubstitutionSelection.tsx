import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

interface SubstitutionSelectionProps {
  absentTeacher: string;
  date: Date;
  suggestions: Array<{
    timeSlot: string;
    className: string;
    subject: string;
    priorityTeachers: Array<{ fullName: string; shortName: string; subject: string }>;
    otherTeachers: Array<{ fullName: string; shortName: string }>;
  }>;
  isLoading: boolean;
  onConfirm: (selections: Record<number, string>) => void;
  onBack: () => void;
}

export default function SubstitutionSelection({
  absentTeacher,
  date,
  suggestions,
  isLoading,
  onConfirm,
  onBack,
}: SubstitutionSelectionProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selections, setSelections] = useState<Record<number, string>>({});

  const currentSuggestion = suggestions[currentIndex];

  const handleSelectTeacher = (value: string) => {
    setSelections(prev => ({
      ...prev,
      [currentIndex]: value,
    }));
  };

  const handleNext = () => {
    if (currentIndex < suggestions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
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
          <div className="col-span-1">
            <p className="text-sm text-gray-600">科目</p>
            <p className="font-semibold text-lg">{currentSuggestion.subject}</p>
          </div>
        </div>

        {/* 代課老師選擇 */}
        <div className="space-y-4">
          <label className="block text-sm font-semibold text-gray-700">
            選擇代課老師
          </label>
          <Select value={selections[currentIndex] || ''} onValueChange={handleSelectTeacher}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="選擇代課老師或無需代課" />
            </SelectTrigger>
            <SelectContent>
              {/* 無需代課選項 */}
              <SelectItem value="none">
                ✗ 無需代課
              </SelectItem>

              {/* 科任老師（首選） */}
              {currentSuggestion.priorityTeachers.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-xs font-semibold text-green-700 bg-green-50">
                    ★ 首選：該班科任老師
                  </div>
                  {currentSuggestion.priorityTeachers.map((teacher: any) => (
                    <SelectItem key={teacher.fullName} value={teacher.fullName}>
                      {teacher.fullName} ({teacher.shortName}) - {teacher.subject}
                    </SelectItem>
                  ))}
                </>
              )}

              {/* 其他空堂老師（次選） */}
              {currentSuggestion.otherTeachers.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-xs font-semibold text-gray-700 bg-gray-50">
                    次選：其他空堂老師
                  </div>
                  {currentSuggestion.otherTeachers.map((teacher: any) => (
                    <SelectItem key={teacher.fullName} value={teacher.fullName}>
                      {teacher.fullName} ({teacher.shortName})
                    </SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>

          {/* 無可用老師警告 */}
          {currentSuggestion.priorityTeachers.length === 0 &&
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

        {/* 進度文字 */}
        <p className="text-center text-sm text-gray-600">
          第 {currentIndex + 1} / {suggestions.length} 節課
        </p>

        {/* 導航按鈕 */}
        <div className="flex gap-3 pt-4">
          <Button
            variant="outline"
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="flex-1"
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            上一節
          </Button>

          {currentIndex < suggestions.length - 1 ? (
            <Button onClick={handleNext} className="flex-1">
              下一節
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleConfirm} className="flex-1 bg-green-600 hover:bg-green-700">
              確認並生成報告
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>

        <Button variant="outline" onClick={onBack} className="w-full">
          返回
        </Button>
      </CardContent>
    </Card>
  );
}
