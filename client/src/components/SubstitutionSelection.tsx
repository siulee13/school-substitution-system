import { useState } from 'react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SubstitutionSelectionProps {
  substitutionData: {
    date: Date;
    teacher: string;
    classes: Array<{ timeSlot: string; class: string; subject: string }>;
  };
  suggestions: Array<{
    timeSlot: string;
    class: string;
    subject: string;
    subjectTeachers: Array<{ fullName: string; shortName: string; subjects: string[] }>;
    otherTeachers: Array<{ fullName: string; shortName: string }>;
  }>;
  isLoading: boolean;
  onComplete: (report: any) => void;
  onBack: () => void;
}

export default function SubstitutionSelection({
  substitutionData,
  suggestions,
  isLoading,
  onComplete,
  onBack,
}: SubstitutionSelectionProps) {
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>第三步：編排代課</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">載入代課建議中...</span>
        </CardContent>
      </Card>
    );
  }

  if (suggestions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>第三步：編排代課</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              無法生成代課建議。請檢查日期和老師資訊是否正確。
            </AlertDescription>
          </Alert>
          <Button onClick={onBack} variant="outline" className="mt-4">
            <ChevronLeft className="mr-2 h-4 w-4" />
            上一步
          </Button>
        </CardContent>
      </Card>
    );
  }

  const currentSuggestion = suggestions[currentIndex];
  const currentKey = `${currentIndex}`;
  const currentSelection = selections[currentKey] || '';

  const handleSelectTeacher = (teacherFullName: string) => {
    setSelections({
      ...selections,
      [currentKey]: teacherFullName,
    });
  };

  const handleNext = () => {
    if (currentIndex < suggestions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // 完成所有選擇，生成報告
      const report = suggestions.map((suggestion, idx) => ({
        ...suggestion,
        substitutionTeacher: selections[`${idx}`],
      }));
      onComplete(report);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const allSelectionsComplete = Object.keys(selections).length === suggestions.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>第三步：編排代課</CardTitle>
        <CardDescription>
          請為每一節課選擇代課老師（第 {currentIndex + 1} / {suggestions.length} 節）
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 當前課堂資訊 */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">時間</p>
              <p className="font-semibold text-lg">{currentSuggestion.timeSlot}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">班別</p>
              <p className="font-semibold text-lg">{currentSuggestion.class}</p>
            </div>
            <div className="col-span-2">
              <p className="text-sm text-gray-600">科目</p>
              <p className="font-semibold text-lg">{currentSuggestion.subject}</p>
            </div>
          </div>
        </div>

        {/* 代課老師選擇 */}
        <div className="space-y-4">
          {/* 科任老師（首選） */}
          {currentSuggestion.subjectTeachers.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-green-700 mb-2">
                ★ 首選：該班科任老師
              </label>
              <Select value={currentSelection} onValueChange={handleSelectTeacher}>
                <SelectTrigger className="w-full border-green-300 bg-green-50">
                  <SelectValue placeholder="選擇科任老師" />
                </SelectTrigger>
                <SelectContent>
                  {currentSuggestion.subjectTeachers.map((teacher) => (
                    <SelectItem key={teacher.fullName} value={teacher.fullName}>
                      {teacher.fullName} ({teacher.shortName}) - {teacher.subjects.join('、')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 其他空堂老師（次選） */}
          {currentSuggestion.otherTeachers.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                次選：其他空堂老師
              </label>
              <Select value={currentSelection} onValueChange={handleSelectTeacher}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="選擇其他老師" />
                </SelectTrigger>
                <SelectContent>
                  {currentSuggestion.otherTeachers.map((teacher) => (
                    <SelectItem key={teacher.fullName} value={teacher.fullName}>
                      {teacher.fullName} ({teacher.shortName})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 無可用老師警告 */}
          {currentSuggestion.subjectTeachers.length === 0 &&
            currentSuggestion.otherTeachers.length === 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  此時段無空堂老師可用。請手動指派或調整時間。
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

        {/* 按鈕 */}
        <div className="flex gap-3 pt-4">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            className="flex-1"
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            上一個
          </Button>
          <Button
            onClick={handleNext}
            disabled={!currentSelection}
            className="flex-1"
          >
            {currentIndex === suggestions.length - 1 ? (
              <>
                完成 <ChevronRight className="ml-2 h-4 w-4" />
              </>
            ) : (
              <>
                下一個 <ChevronRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
