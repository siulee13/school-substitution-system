import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import { Calendar, Users, ClipboardCheck, BarChart3 } from "lucide-react";

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <Card className="border-0 shadow-lg">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl">校園代課編排系統</CardTitle>
              <CardDescription>
                快速安排老師請假時的代課事宜
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-blue-600 mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900">靈活的日期選擇</p>
                    <p className="text-sm text-gray-600">月曆介面輕鬆選擇代課日期</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Users className="h-5 w-5 text-blue-600 mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900">智能推薦系統</p>
                    <p className="text-sm text-gray-600">優先推薦該班科任老師</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <ClipboardCheck className="h-5 w-5 text-blue-600 mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900">快速確認流程</p>
                    <p className="text-sm text-gray-600">逐堂選擇代課老師</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <BarChart3 className="h-5 w-5 text-blue-600 mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900">完整報告輸出</p>
                    <p className="text-sm text-gray-600">生成可下載的代課總表</p>
                  </div>
                </div>
              </div>

              <Button
                onClick={() => window.location.href = getLoginUrl()}
                size="lg"
                className="w-full"
              >
                登入開始使用
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* 歡迎標題 */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            歡迎，{user?.name || '用戶'}！
          </h1>
          <p className="text-gray-600">
            校園代課編排系統 - 快速安排老師請假時的代課事宜
          </p>
        </div>

        {/* 主要功能卡片 */}
        <Card className="mb-8 border-0 shadow-lg">
          <CardHeader>
            <CardTitle>開始編排代課</CardTitle>
            <CardDescription>
              選擇請假日期和老師，系統將自動推薦合適的代課老師
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              size="lg"
              onClick={() => navigate('/substitution')}
              className="w-full md:w-auto"
            >
              進入代課編排系統
            </Button>
          </CardContent>
        </Card>

        {/* 功能特點 */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <Calendar className="h-8 w-8 text-blue-600 mb-2" />
              <CardTitle>日期選擇</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                提供月曆介面供選擇，自動換算星期幾，確保日期準確無誤。
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Users className="h-8 w-8 text-blue-600 mb-2" />
              <CardTitle>老師選擇</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                下拉式選單列出所有老師，同時顯示全名及簡稱，方便快速查找。
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <ClipboardCheck className="h-8 w-8 text-blue-600 mb-2" />
              <CardTitle>課堂確認</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                顯示該老師當日所有課堂，讓用戶確認後才進入代課編排流程。
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <BarChart3 className="h-8 w-8 text-blue-600 mb-2" />
              <CardTitle>智能推薦</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                自動篩選空堂老師，優先推薦該班科任老師，次選其他老師。
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
