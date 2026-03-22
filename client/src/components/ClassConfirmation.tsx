import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronLeft, ChevronRight, Loader2, Clock, ArrowLeftRight } from 'lucide-react';

interface ClassConfirmationProps {
  teacher: string;
  date: Date;
  classes: Array<{ timeSlot: string; className: string; subject: string }>;
  isLoading: boolean;
  absenceType?: 'fullday' | 'partial';
  startTime?: string;
  endTime?: string;
  allowSwap?: boolean;
  onConfirm: () => void;
  onBack: () => void;
}

export default function ClassConfirmation({
  teacher,
  date,
  classes,
  isLoading,
  absenceType = 'fullday',
  startTime,
  endTime,
  allowSwap = false,
  onConfirm,
  onBack,
}: ClassConfirmationProps) {
  const dayOfWeek = format(date, 'EEEE', { locale: zhTW });

  const absenceSummary = absenceType === 'fullday'
    ? '全日請假'
    : `指定時段請假（${startTime} – ${endTime}）`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>第二步：確認課堂</CardTitle>
        <CardDescription>
          請確認 {teacher} 在 {format(date, 'yyyy年MM月dd日', { locale: zhTW })} ({dayOfWeek}) 的課堂安排
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 請假時段摘要 */}
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <Clock className="h-4 w-4 flex-shrink-0" />
          <span><strong>{teacher}</strong> — {absenceSummary}</span>
        </div>
        {allowSwap && (
          <div className="flex items-center gap-2 p-3 bg-purple-50 border border-purple-200 rounded-lg text-sm text-purple-800">
            <ArrowLeftRight className="h-4 w-4 flex-shrink-0 text-purple-600" />
            <span>已開啟「容許調課」：系統將在下一步列出可調課的建議方案。</span>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">載入課堂資料中...</span>
          </div>
        ) : classes.length === 0 ? (
          <div className="py-8 text-center text-gray-600">
            該老師在此日期沒有課堂安排
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">時間</TableHead>
                  <TableHead className="text-center">班別</TableHead>
                  <TableHead className="text-center">科目</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classes.map((lesson, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="text-center font-medium">{lesson.timeSlot}</TableCell>
                    <TableCell className="text-center">{lesson.className}</TableCell>
                    <TableCell className="text-center">{lesson.subject}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                共 <span className="font-semibold">{classes.length}</span> 節課需要安排代課
                {absenceType === 'partial' && (
                  <span className="text-blue-600 ml-1">（已根據指定時段篩選）</span>
                )}
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={onBack} className="flex-1">
                <ChevronLeft className="mr-2 h-4 w-4" />
                上一步
              </Button>
              <Button onClick={onConfirm} className="flex-1">
                確認並進行代課編排 <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
