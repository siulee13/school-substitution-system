import { useState } from 'react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, ChevronRight, Loader2 } from 'lucide-react';
import ClassConfirmation from '@/components/ClassConfirmation';
import SubstitutionSelection from '@/components/SubstitutionSelection';
import SubstitutionReport from '@/components/SubstitutionReport';

type WorkflowStep = 'input' | 'confirmation' | 'substitution' | 'report';

export default function SubstitutionSystem() {
  const [step, setStep] = useState<WorkflowStep>('input');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedTeacher, setSelectedTeacher] = useState<string>('');
  const [substitutionData, setSubstitutionData] = useState<any>(null);
  const [finalReport, setFinalReport] = useState<any>(null);

  // 查詢所有老師
  const { data: teachers = [], isLoading: teachersLoading } = trpc.substitution.getAllTeachers.useQuery();

  // 查詢該老師當日課堂
  const { data: classesByDate, isLoading: classesLoading } = trpc.substitution.getTeacherClasses.useQuery(
    {
      teacherFullName: selectedTeacher,
      date: selectedDate || new Date(),
    },
    {
      enabled: step === 'confirmation' && !!selectedTeacher && !!selectedDate,
    }
  );

  // 查詢代課建議
  const { data: suggestions, isLoading: suggestionsLoading } =
    trpc.substitution.generateSuggestions.useQuery(
      {
        date: selectedDate || new Date(),
        absentTeacherFullName: selectedTeacher,
      },
      {
        enabled: step === 'substitution' && !!selectedTeacher && !!selectedDate,
      }
    );

  const handleProceedToConfirmation = () => {
    if (selectedDate && selectedTeacher) {
      setStep('confirmation');
    }
  };

  const handleConfirmClasses = () => {
    if (selectedDate && selectedTeacher) {
      setSubstitutionData({
        date: selectedDate,
        teacher: selectedTeacher,
        classes: classesByDate,
      });
      setStep('substitution');
    }
  };

  const handleCompleteSubstitution = (report: any) => {
    setFinalReport(report);
    setStep('report');
  };

  const handleReset = () => {
    setStep('input');
    setSelectedDate(new Date());
    setSelectedTeacher('');
    setSubstitutionData(null);
    setFinalReport(null);
  };

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
              <CardTitle>第一步：選擇日期和老師</CardTitle>
              <CardDescription>
                請選擇請假日期和老師，系統將自動顯示該老師當日的課堂安排
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
                        ? format(selectedDate, 'yyyy年MM月dd日 (EEEE)', { locale: zhCN })
                        : '選擇日期'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    />
                  </PopoverContent>
                </Popover>
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
                        className="flex items-center space-x-3 p-3 rounded-lg hover:bg-blue-100 cursor-pointer transition-colors"
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

              {/* 確認按鈕 */}
              <Button
                onClick={handleProceedToConfirmation}
                disabled={!selectedDate || !selectedTeacher}
                className="w-full"
                size="lg"
              >
                下一步：確認課堂 <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 'confirmation' && selectedTeacher && selectedDate && (
          <ClassConfirmation
            teacher={selectedTeacher}
            date={selectedDate}
            classes={classesByDate || []}
            isLoading={classesLoading}
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

        {step === 'report' && finalReport && (
          <SubstitutionReport
            report={finalReport}
            onReset={handleReset}
          />
        )}
      </div>
    </div>
  );
}
