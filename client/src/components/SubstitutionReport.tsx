import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle, Download, RotateCcw } from 'lucide-react';

interface SubstitutionReportProps {
  report: Array<{
    timeSlot: string;
    class: string;
    subject: string;
    substitutionTeacher: string;
  }>;
  onReset: () => void;
}

export default function SubstitutionReport({ report, onReset }: SubstitutionReportProps) {
  const handleDownload = () => {
    // 生成 CSV 內容
    const csvContent = [
      ['時間', '班別', '科目', '代課老師'].join(','),
      ...report.map((row) =>
        [row.timeSlot, row.class, row.subject, row.substitutionTeacher].join(',')
      ),
    ].join('\n');

    // 創建下載連結
    const element = document.createElement('a');
    element.setAttribute('href', `data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`);
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
              已成功為 {report.length} 節課安排代課老師
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 代課總表 */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-center">時間</TableHead>
              <TableHead className="text-center">班別</TableHead>
              <TableHead className="text-center">科目</TableHead>
              <TableHead className="text-center">代課老師</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.map((row, idx) => (
              <TableRow key={idx} className="hover:bg-gray-50">
                <TableCell className="text-center font-medium">{row.timeSlot}</TableCell>
                <TableCell className="text-center">{row.class}</TableCell>
                <TableCell className="text-center">{row.subject}</TableCell>
                <TableCell className="text-center font-semibold text-blue-600">
                  {row.substitutionTeacher}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* 摘要統計 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">總課節數</p>
            <p className="text-2xl font-bold text-blue-600">{report.length}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">代課完成率</p>
            <p className="text-2xl font-bold text-green-600">100%</p>
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

        {/* 提示 */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-900">
            💡 提示：請將此報告轉發給相關老師和行政部門，以確保代課安排得以執行。
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
