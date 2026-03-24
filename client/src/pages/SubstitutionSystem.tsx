import { useMemo, useState } from "react";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";
import { ChevronLeft } from "lucide-react";
import ClassConfirmation from "@/components/ClassConfirmation";
import SubstitutionReport from "@/components/SubstitutionReport";
import SubstitutionSelection from "@/components/SubstitutionSelection";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { createEmptyTeacherEntry } from "@/features/substitution/constants";
import SubstitutionInputStep from "@/features/substitution/SubstitutionInputStep";
import WorkflowProgress from "@/features/substitution/WorkflowProgress";
import type {
  AbsentTeacherEntry,
  AllSelections,
  FinalReport,
  MultiTeacherSuggestionResult,
  WorkflowStep,
} from "@/features/substitution/types";
import {
  buildFinalReport,
  buildMultiSuggestionsInput,
  buildTeacherQueryOptions,
  canProceedToConfirmation,
  filterClassesByAbsenceWindow,
  getNextWeekday,
  getUsedRegularResources,
  getUsedSwapResources,
  makeId,
  toLocalDateStr,
} from "@/features/substitution/utils";

export default function SubstitutionSystem() {
  const [step, setStep] = useState<WorkflowStep>("input");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(() =>
    getNextWeekday()
  );
  const [allowSwap, setAllowSwap] = useState(false);
  const [finalReport, setFinalReport] = useState<FinalReport>([]);
  const [teacherSearchMap, setTeacherSearchMap] = useState<
    Record<string, string>
  >({});
  const [absentTeachers, setAbsentTeachers] = useState([
    createEmptyTeacherEntry(makeId()),
  ]);
  const [confirmationIdx, setConfirmationIdx] = useState(0);
  const [substitutionTeacherIdx, setSubstitutionTeacherIdx] = useState(0);
  const [allSelections, setAllSelections] = useState<AllSelections>({});
  // 查詢所有老師
  const { data: teachers = [], isLoading: teachersLoading, isFetching: teachersFetching, isError: teachersError, refetch: refetchTeachers } = trpc.substitution.getAllTeachers.useQuery(undefined, { retry: 1 });

  const localDateStr = useMemo(
    () => toLocalDateStr(selectedDate),
    [selectedDate]
  );
  const validTeachers = useMemo(
    () => buildTeacherQueryOptions(absentTeachers),
    [absentTeachers]
  );
  const currentConfirmTeacher = absentTeachers[confirmationIdx];
  const currentSubstitutionTeacher = validTeachers[substitutionTeacherIdx];
  const isMultiTeacher = validTeachers.length > 1;
  const canProceed = useMemo(
    () => canProceedToConfirmation(selectedDate, absentTeachers),
    [selectedDate, absentTeachers]
  );

  const { data: classesByDate = [], isLoading: classesLoading } =
    trpc.substitution.getTeacherClasses.useQuery(
      {
        teacherFullName: currentConfirmTeacher?.fullName || "",
        dateStr: localDateStr,
      },
      {
        enabled:
          step === "confirmation" &&
          !!currentConfirmTeacher?.fullName &&
          !!selectedDate,
      }
    );

  const filteredClassesByDate = useMemo(
    () => filterClassesByAbsenceWindow(classesByDate, currentConfirmTeacher),
    [classesByDate, currentConfirmTeacher]
  );

  const multiSuggestionsInput = useMemo(
    () => buildMultiSuggestionsInput(localDateStr, validTeachers, allowSwap),
    [localDateStr, validTeachers, allowSwap]
  );

  const {
    data: multiSuggestions,
    isLoading: multiSuggestionsLoading,
    isFetching: multiSuggestionsFetching,
  } = trpc.substitution.generateSuggestionsMulti.useQuery(
    multiSuggestionsInput,
    {
      enabled:
        step === "substitution" && validTeachers.length > 0 && !!selectedDate,
      staleTime: Infinity,
    }
  );

  const currentSuggestions =
    multiSuggestions?.[substitutionTeacherIdx]?.suggestions ||
    multiSuggestions?.find(
      result => result.teacherFullName === currentSubstitutionTeacher?.fullName
    )?.suggestions ||
    [];

  const isSuggestionsLoading =
    multiSuggestionsLoading || multiSuggestionsFetching || !multiSuggestions;

  const usedSwapResources = useMemo(
    () =>
      getUsedSwapResources(
        allowSwap,
        allSelections,
        multiSuggestions as MultiTeacherSuggestionResult[] | undefined,
        substitutionTeacherIdx
      ),
    [allowSwap, allSelections, multiSuggestions, substitutionTeacherIdx]
  );

  const usedRegularResources = useMemo(
    () =>
      getUsedRegularResources(
        allSelections,
        multiSuggestions as MultiTeacherSuggestionResult[] | undefined,
        substitutionTeacherIdx
      ),
    [allSelections, multiSuggestions, substitutionTeacherIdx]
  );

  const updateTeacher = (
    id: string,
    field: keyof AbsentTeacherEntry,
    value: string
  ) => {
    setAbsentTeachers(prev =>
      prev.map(teacher =>
        teacher.id === id ? { ...teacher, [field]: value } : teacher
      )
    );
  };

  const addTeacher = () => {
    setAbsentTeachers(prev => [...prev, createEmptyTeacherEntry(makeId())]);
  };

  const removeTeacher = (id: string) => {
    if (absentTeachers.length <= 1) return;

    setAbsentTeachers(prev => prev.filter(teacher => teacher.id !== id));
    setTeacherSearchMap(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const proceedToConfirmation = () => {
    if (!canProceed) return;
    setConfirmationIdx(0);
    setStep("confirmation");
  };

  const confirmCurrentTeacher = () => {
    if (confirmationIdx < absentTeachers.length - 1) {
      setConfirmationIdx(prev => prev + 1);
      return;
    }

    setSubstitutionTeacherIdx(0);
    setAllSelections({});
    setStep("substitution");
  };

  const handleCompleteSubstitutionForTeacher = (
    selections: Record<number, string>
  ) => {
    const nextSelections = {
      ...allSelections,
      [substitutionTeacherIdx]: selections,
    };
    setAllSelections(nextSelections);

    if (substitutionTeacherIdx < validTeachers.length - 1) {
      setSubstitutionTeacherIdx(prev => prev + 1);
      return;
    }

    setFinalReport(
      buildFinalReport(validTeachers, multiSuggestions, nextSelections)
    );
    setStep("report");
  };

  const resetWorkflow = () => {
    setStep("input");
    setSelectedDate(getNextWeekday());
    setAllowSwap(false);
    setFinalReport([]);
    setAbsentTeachers([createEmptyTeacherEntry(makeId())]);
    setTeacherSearchMap({});
    setConfirmationIdx(0);
    setSubstitutionTeacherIdx(0);
    setAllSelections({});
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            校園代課編排系統
          </h1>
          <p className="text-gray-600">快速安排老師請假時的代課事宜</p>
        </div>

        <WorkflowProgress currentStep={step} />

        {step === "input" && (
          <SubstitutionInputStep
            selectedDate={selectedDate}
            allowSwap={allowSwap}
            absentTeachers={absentTeachers}
            teacherSearchMap={teacherSearchMap}
            teachers={teachers}
            teachersLoading={teachersLoading}
            teachersFetching={teachersFetching}
            teachersError={teachersError}
            onRetryTeachers={refetchTeachers}
            canProceed={canProceed}
            isMultiTeacher={isMultiTeacher}
            onSelectedDateChange={setSelectedDate}
            onAllowSwapChange={setAllowSwap}
            onAddTeacher={addTeacher}
            onRemoveTeacher={removeTeacher}
            onTeacherSearchChange={(id, value) =>
              setTeacherSearchMap(prev => ({ ...prev, [id]: value }))
            }
            onTeacherChange={updateTeacher}
            onProceed={proceedToConfirmation}
          />
        )}

        {step === "confirmation" && currentConfirmTeacher && selectedDate && (
          <div className="space-y-3">
            {isMultiTeacher && (
              <div className="flex items-center justify-between bg-white rounded-lg px-4 py-2 border border-gray-200 text-sm text-gray-600">
                <span>
                  確認課堂：第 {confirmationIdx + 1} / {absentTeachers.length}{" "}
                  位老師
                </span>
                <div className="flex gap-1">
                  {absentTeachers.map((teacher, idx) => (
                    <div
                      key={teacher.id}
                      className={`w-2 h-2 rounded-full ${
                        idx < confirmationIdx
                          ? "bg-green-500"
                          : idx === confirmationIdx
                            ? "bg-blue-500"
                            : "bg-gray-300"
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
            <ClassConfirmation
              teacher={currentConfirmTeacher.fullName}
              date={selectedDate}
              classes={filteredClassesByDate}
              isLoading={classesLoading}
              absenceType={currentConfirmTeacher.absenceType}
              startTime={currentConfirmTeacher.startTime}
              endTime={currentConfirmTeacher.endTime}
              allowSwap={allowSwap}
              onConfirm={confirmCurrentTeacher}
              onBack={() => {
                if (confirmationIdx > 0) {
                  setConfirmationIdx(prev => prev - 1);
                  return;
                }
                setStep("input");
              }}
            />
          </div>
        )}

        {step === "substitution" &&
          currentSubstitutionTeacher &&
          selectedDate && (
            <div className="space-y-3">
              {isMultiTeacher && (
                <div className="flex items-center justify-between bg-white rounded-lg px-4 py-2 border border-gray-200 text-sm text-gray-600">
                  <span>
                    代課編排：第 {substitutionTeacherIdx + 1} /{" "}
                    {validTeachers.length} 位老師
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {currentSubstitutionTeacher.fullName}
                    </Badge>
                    <div className="flex gap-1">
                      {validTeachers.map((teacher, idx) => (
                        <div
                          key={teacher.id}
                          className={`w-2 h-2 rounded-full ${
                            idx < substitutionTeacherIdx
                              ? "bg-green-500"
                              : idx === substitutionTeacherIdx
                                ? "bg-blue-500"
                                : "bg-gray-300"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <SubstitutionSelection
                absentTeacher={currentSubstitutionTeacher.fullName}
                date={selectedDate}
                suggestions={currentSuggestions}
                isLoading={isSuggestionsLoading}
                excludedSwapResources={usedSwapResources}
                excludedRegularResources={usedRegularResources}
                onConfirm={handleCompleteSubstitutionForTeacher}
                onBack={() => {
                  if (substitutionTeacherIdx > 0) {
                    setSubstitutionTeacherIdx(prev => prev - 1);
                    return;
                  }
                  setStep("confirmation");
                  setConfirmationIdx(absentTeachers.length - 1);
                }}
              />
            </div>
          )}

        {step === "report" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-gray-500">編排日期</p>
                <p className="font-semibold text-gray-900">
                  {selectedDate
                    ? format(selectedDate, "yyyy年MM月dd日 (EEEE)", {
                        locale: zhTW,
                      })
                    : "未選擇"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="secondary">
                  {validTeachers.length} 位請假老師
                </Badge>
                {allowSwap && (
                  <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">
                    已啟用調課
                  </Badge>
                )}
              </div>
            </div>

            <SubstitutionReport report={finalReport} onReset={resetWorkflow} />

            <Button
              variant="outline"
              onClick={() => setStep("substitution")}
              className="w-full"
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              返回修改代課安排
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
