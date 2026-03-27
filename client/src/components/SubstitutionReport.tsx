import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { CheckCircle, Download, RotateCcw, ArrowLeftRight, Save, CheckCheck, Pencil } from 'lucide-react';
import { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc';

export interface ReportRow {
  timeSlot: string;
  class: string;
  subject: string;
  substitutionTeacher: string;
  /** 請假老師姓名（多位老師時用於區分） */
  absentTeacher?: string;
  /** 是否為調課安排 */
  isSwap?: boolean;
  /** 調課說明（請假老師需要在哪個時段代哪班） */
  swapNote?: string;
}

interface SubstitutionReportProps {
  report: ReportRow[];
  dateStr: string; // YYYY-MM-DD 格式
  onReset: () => void;
  onUpdateRow?: (idx: number, newTeacher: string) => void;
}

interface EditDialogState {
  open: boolean;
  rowIdx: number;
  row: ReportRow | null;
  newTeacher: string;
  searchQuery: string;
}

export default function SubstitutionReport({ report, dateStr, onReset, onUpdateRow }: SubstitutionReportProps) {
  const swapCount = report.filter(r => r.isSwap).length;
  const normalCount = report.filter(r => !r.isSwap && r.substitutionTeacher !== '無需代課').length;
  const hasMultiTeacher = report.some(r => r.absentTeacher);

  // 計算每位代課老師在當日被分配的次數（排除「無需代課」）
  const substitutionCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of report) {
      if (row.substitutionTeacher && row.substitutionTeacher !== '無需代課') {
        map.set(row.substitutionTeacher, (map.get(row.substitutionTeacher) ?? 0) + 1);
      }
    }
    return map;
  }, [report]);

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // 修改對話框狀態
  const [editDialog, setEditDialog] = useState<EditDialogState>({
    open: false,
    rowIdx: -1,
    row: null,
    newTeacher: '',
    searchQuery: '',
  });

  // 查詢所有老師（用於修改對話框的選擇）
  const { data: allTeachers = [] } = trpc.substitution.getAllTeachers.useQuery(
    undefined,
    { staleTime: Infinity }
  );

  // 根據搜尋關鍵字篩選老師
  const filteredTeachers = useMemo(() => {
    const q = editDialog.searchQuery.trim().toLowerCase();
    if (!q) return allTeachers;
    return allTeachers.filter(t =>
      t.fullName.toLowerCase().includes(q) || t.shortName.toLowerCase().includes(q)
    );
  }, [allTeachers, editDialog.searchQuery]);

  const saveRecord = trpc.substitution.saveRecord.useMutation({
    onSuccess: () => setSaveStatus('saved'),
    onError: () => setSaveStatus('error'),
  });

  const handleSave = async () => {
    setSaveStatus('saving');
    await saveRecord.mutateAsync({
      dateStr,
      items: report.map(row => ({
        absentTeacher: row.absentTeacher || '',
        timeSlot: row.timeSlot,
        className: row.class,
        subject: row.subject,
        substitutionTeacher: row.substitutionTeacher,
        isSwap: row.isSwap ? 1 : 0,
        swapNote: row.swapNote,
      })),
    });
  };

  const handleDownload = () => {
    const headers = hasMultiTeacher
      ? ['請假老師', '時間', '班別', '科目', '代課/調課老師', '備註']
      : ['時間', '班別', '科目', '代課/調課老師', '備註'];
    const csvContent = [
      headers.join(','),
      ...report.map((row) => {
        const base = [
          row.timeSlot,
          row.class,
          row.subject,
          row.substitutionTeacher,
          row.isSwap ? `調課 - ${row.swapNote || ''}` : '',
        ];
        return hasMultiTeacher ? [row.absentTeacher || '', ...base].join(',') : base.join(',');
      }),
    ].join('\n');

    const element = document.createElement('a');
    element.setAttribute('href', `data:text/csv;charset=utf-8,\uFEFF${encodeURIComponent(csvContent)}`);
    element.setAttribute('download', `代課安排_${new Date().toISOString().split('T')[0]}.csv`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const openEditDialog = (idx: number, row: ReportRow) => {
    setEditDialog({
      open: true,
      rowIdx: idx,
      row,
      newTeacher: row.substitutionTeacher === '無需代課' ? 'none' : row.substitutionTeacher,
      searchQuery: '',
    });
  };

  const closeEditDialog = () => {
    setEditDialog(prev => ({ ...prev, open: false, searchQuery: '' }));
  };

  const handleConfirmEdit = () => {
    if (editDialog.rowIdx < 0 || !onUpdateRow) return;
    const teacherValue = editDialog.newTeacher === 'none' ? '無需代課' : editDialog.newTeacher;
    onUpdateRow(editDialog.rowIdx, teacherValue);
    // 儲存狀態重置（因為報告已修改）
    setSaveStatus('idle');
    closeEditDialog();
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
              {hasMultiTeacher && <TableHead className="text-center">請假老師</TableHead>}
              <TableHead className="text-center">時間</TableHead>
              <TableHead className="text-center">班別</TableHead>
              <TableHead className="text-center">科目</TableHead>
              <TableHead className="text-center">代課/調課老師</TableHead>
              <TableHead className="text-center">備註</TableHead>
              {onUpdateRow && <TableHead className="text-center w-16">修改</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.map((row, idx) => (
              <TableRow
                key={idx}
                className={row.isSwap ? 'bg-purple-50 hover:bg-purple-100' : 'hover:bg-gray-50'}
              >
                {hasMultiTeacher && (
                  <TableCell className="text-center text-xs font-medium text-gray-700">{row.absentTeacher || ''}</TableCell>
                )}
                <TableCell className="text-center font-medium">{row.timeSlot}</TableCell>
                <TableCell className="text-center">{row.class}</TableCell>
                <TableCell className="text-center">{row.subject}</TableCell>
                <TableCell className="text-center">
                  {(() => {
                    const count = substitutionCountMap.get(row.substitutionTeacher) ?? 0;
                    const isMulti = count > 1;
                    if (row.isSwap) {
                      return (
                        <span className={`inline-flex items-center gap-1 font-semibold ${
                          isMulti ? 'text-orange-700' : 'text-purple-700'
                        }`}>
                          <ArrowLeftRight className="h-3.5 w-3.5" />
                          {row.substitutionTeacher}
                          {isMulti && (
                            <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-orange-100 text-orange-700 border border-orange-300">
                              ×{count}
                            </span>
                          )}
                        </span>
                      );
                    }
                    if (row.substitutionTeacher === '無需代課') {
                      return <span className="font-semibold text-gray-400">{row.substitutionTeacher}</span>;
                    }
                    return (
                      <span className={`inline-flex items-center gap-1 font-semibold ${
                        isMulti ? 'text-orange-700' : 'text-blue-600'
                      }`}>
                        {row.substitutionTeacher}
                        {isMulti && (
                          <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-orange-100 text-orange-700 border border-orange-300">
                            ×{count}
                          </span>
                        )}
                      </span>
                    );
                  })()}
                </TableCell>
                <TableCell className="text-center text-xs text-gray-500">
                  {row.isSwap ? (
                    <span className="text-purple-600 font-medium">{row.swapNote}</span>
                  ) : '—'}
                </TableCell>
                {onUpdateRow && (
                  <TableCell className="text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                      onClick={() => openEditDialog(idx, row)}
                      title="修改代課老師"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                )}
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
          <Button
            onClick={handleSave}
            disabled={saveStatus === 'saving' || saveStatus === 'saved'}
            variant={saveStatus === 'saved' ? 'outline' : 'default'}
            className={`flex-1 ${
              saveStatus === 'saved' ? 'border-green-500 text-green-600' :
              saveStatus === 'error' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {saveStatus === 'saving' && <>儲存中…</>}
            {saveStatus === 'saved' && <><CheckCheck className="mr-2 h-4 w-4" />已儲存至資料庫</>}
            {saveStatus === 'error' && <>儲存失敗，請重試</>}
            {saveStatus === 'idle' && <><Save className="mr-2 h-4 w-4" />確認並儲存</>}
          </Button>
          <Button onClick={onReset} variant="outline" className="flex-1">
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

      {/* 個別修改對話框 */}
      <Dialog open={editDialog.open} onOpenChange={(open) => { if (!open) closeEditDialog(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>修改代課老師</DialogTitle>
            {editDialog.row && (
              <DialogDescription>
                {editDialog.row.timeSlot}・{editDialog.row.class}・{editDialog.row.subject}
                {editDialog.row.absentTeacher && ` （請假：${editDialog.row.absentTeacher}）`}
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* 搜尋框 */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">搜尋老師</label>
              <Input
                placeholder="輸入姓名或簡稱…"
                value={editDialog.searchQuery}
                onChange={e => setEditDialog(prev => ({ ...prev, searchQuery: e.target.value }))}
                className="mb-2"
              />
            </div>

            {/* 老師選擇 */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">選擇代課老師</label>
              <Select
                value={editDialog.newTeacher}
                onValueChange={val => setEditDialog(prev => ({ ...prev, newTeacher: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="請選擇代課老師…" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="none">
                    <span className="text-gray-400">無需代課</span>
                  </SelectItem>
                  {filteredTeachers.map(t => (
                    <SelectItem key={t.fullName} value={t.fullName}>
                      {t.fullName}（{t.shortName}）
                    </SelectItem>
                  ))}
                  {filteredTeachers.length === 0 && editDialog.searchQuery && (
                    <div className="py-2 px-3 text-sm text-gray-400">找不到符合「{editDialog.searchQuery}」的老師</div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* 調課提示 */}
            {editDialog.row?.isSwap && (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                ⚠ 此行原為調課安排。修改後將改為普通代課，調課備註將被清除。
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeEditDialog}>取消</Button>
            <Button
              onClick={handleConfirmEdit}
              disabled={!editDialog.newTeacher}
            >
              確認修改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
