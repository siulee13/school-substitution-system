import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle, Download, RotateCcw, ArrowLeftRight } from 'lucide-react';

export interface ReportRow {
  timeSlot: string;
  class: string;
  subject: string;
  substitutionTeacher: string;
  /** 是否為調課安排 */
  isSwap?: boolean;
  /** 調課說明（請假老師需要在哪個時段代哪班） */
  swapNote?: string;
}

interface SubstitutionReportProps {
  report: ReportRow[];
  onReset: () => void;
}

export default function SubstitutionReport({ report, onReset }: SubstitutionReportProps) {
  const swapCount = report.filter(r => r.isSwap).length;
  const normalCount = report.filter(r => !r.isSwap && r.substitutionTeacher !== '無需代課').length;

  const handleDownload = () => {
    const csvContent = [
      ['時間', '班別', '科目', '代課/調課老師', '備註'].join(','),
      ...report.map((row) =>
        [
          row.timeSlot,
          row.class,
          row.subject,
          row.substitutionTeacher,
          row.isSwap ? `調課 - ${row.swapNote || ''}` : '',
        ].join(',')
      ),
    ].join('\n');

    const element = document.createElement('a');
    element.setAttribute('href', `data:text/csv;charset=utf-8,\uFEFF${encodeURIComponent(csvContent)}`);
    element.setAttribute('download', `代課安排_${new Date().toISOString().split('T')[0]}.csv`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <CheckCircle className="h-8 w-8 text-green-600" />
          <div>
            <CardTitle>代課編排完成</CardTitle>
            <CardDescription>
              已成功為 {report.length} 節課完成安排
              {swapCount > 0 && `（其中 ${swapCount} 節為調課）`}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 調課說明提示 */}
        {swapCount > 0 && (
          <div className="flex items-start gap-2 p-3 bg-purple-50 border border-purple-200 rounded-lg text-sm text-purple-800">
            <ArrowLeftRight className="h-4 w-4 mt-0.5 flex-shrink-0 text-purple-600" />
            <span>
              <strong>調課安排說明：</strong>帶有「調課」標記的課節，表示請假老師在請假前需先完成調課，
              然後由另一位老師代替其請假時段的課堂。詳情請參閱各行備註。
            </span>
          </div>
        )}

        {/* 代課總表 */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-center">時間</TableHead>
              <TableHead className="text-center">班別</TableHead>
              <TableHead className="text-center">科目</TableHead>
              <TableHead className="text-center">代課/調課老師</TableHead>
              <TableHead className="text-center">備註</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.map((row, idx) => (
              <TableRow
                key={idx}
                className={row.isSwap ? 'bg-purple-50 hover:bg-purple-100' : 'hover:bg-gray-50'}
              >
                <TableCell className="text-center font-medium">{row.timeSlot}</TableCell>
                <TableCell className="text-center">{row.class}</TableCell>
                <TableCell className="text-center">{row.subject}</TableCell>
                <TableCell className="text-center">
                  {row.isSwap ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-purple-700">
                      <ArrowLeftRight className="h-3.5 w-3.5" />
                      {row.substitutionTeacher}
                    </span>
                  ) : (
                    <span className={`font-semibold ${row.substitutionTeacher === '無需代課' ? 'text-gray-400' : 'text-blue-600'}`}>
                      {row.substitutionTeacher}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-center text-xs text-gray-500">
                  {row.isSwap ? (
                    <span className="text-purple-600 font-medium">{row.swapNote}</span>
                  ) : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* 摘要統計 */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">總課節數</p>
            <p className="text-2xl font-bold text-blue-600">{report.length}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">普通代課</p>
            <p className="text-2xl font-bold text-green-600">{normalCount}</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">調課安排</p>
            <p className="text-2xl font-bold text-purple-600">{swapCount}</p>
          </div>
        </div>

        {/* 操作按鈕 */}
        <div className="flex gap-3 pt-4">
          <Button onClick={handleDownload} variant="outline" className="flex-1">
            <Download className="mr-2 h-4 w-4" />
            下載報告 (CSV)
          </Button>
          <Button onClick={onReset} className="flex-1">
            <RotateCcw className="mr-2 h-4 w-4" />
            編排新的代課
          </Button>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-900">
            💡 提示：請將此報告轉發給相關老師和行政部門，以確保代課安排得以執行。
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
