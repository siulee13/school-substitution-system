# 校園代課編排系統 (School Substitution System) - TODO

## 後端開發
- [x] 建立資料庫連接層（讀取 timetable.db、class_timetable.db、subject_teacher_mappings.json）
- [x] 實現 tRPC procedure：獲取所有老師列表（含全名及簡稱）
- [x] 實現 tRPC procedure：根據日期及老師查詢當日課堂
- [x] 實現 tRPC procedure：根據日期及時間段查詢空堂老師
- [x] 實現 tRPC procedure：根據班別查詢科任老師
- [x] 實現 tRPC procedure：生成代課建議（整合空堂老師及科任老師篩選邏輯）
- [x] 修復資料庫列名不匹配問題（Teacher、Time、Day、Content 等）
- [ ] 編寫後端單元測試（因 native 模組編譯問題，測試暫時無法執行）

## 前端開發
- [x] 建立主頁面框架及導航結構
- [x] 實現日期選擇器（月曆介面，自動換算星期幾）
- [x] 實現老師選擇下拉選單（含全名及簡稱）
- [x] 實現課堂確認頁面（顯示該老師當日所有課堂）
- [x] 實現代課推薦介面（逐堂顯示空堂老師及科任老師標記）
- [x] 實現代課老師選擇下拉選單（每一堂課一個）
- [x] 實現最終代課總表顯示及導出功能
- [x] 整體 UI/UX 優化及響應式設計

## 系統整合
- [x] 測試日期換算邏輯
- [x] 測試代課推薦邏輯（科任老師優先）
- [x] 測試完整工作流程（從日期選擇到最終總表）
- [ ] 性能優化（查詢效率、快取策略）
- [ ] 錯誤處理及用戶反饋機制

## 交付準備
- [x] 最終檢查及 bug 修復
- [x] 建立項目檢查點
- [ ] 準備用戶文檔

## 新功能：請假時段選擇
- [x] 前端：在第一步新增「全日 / 指定時段」Radio 選項
- [x] 前端：指定時段時顯示開始/結束時間選擇器（下拉式，以課堂時間為單位）
- [x] 後端：修改 generateSuggestions 支援時段篩選參數
- [x] 前端：將時段資訊傳遞到課堂確認及代課選擇頁面

## 新功能：容許調課
- [x] 後端：實現 findSwapCandidates() 函數，偵測同日同班可互換的老師
- [x] 後端：更新 generateSuggestions tRPC procedure，接受 allowSwap 參數並回傳調課建議
- [x] 前端：在第一步加入「容許調課」勾選框
- [x] 前端：在代課選擇頁面顯示調課建議（優先排序、清晰標記）
- [x] 前端：最終報告中區分「調課」與「代課」

## 調課規則收緊：科目對口- [x] 後端： findSwapCandidates 加入雙向科目對口檢查（A 老師需有教請假老師那班的科目，請假老師需有教 A 老師那班的科目）

## Bug 修復：禁止選擇週末
- [x] 前端：日曆預設選擇下一個工作日（而非今天）
- [x] 前端：日曆禁止選擇週末（週六、週日）
- [x] 前端：加入提示說明只能選擇週一至週五

## 調課規則再收窄：互教對方班別
- [x] 後端：findSwapCandidates 改為檢查「A 老師在同日有教 B 老師請假那班」且「B 老師在同日有教 A 老師那班」（不論科目），移除舊有科目對口限制

## 新功能：調課建議班別說明
- [x] 後端：SwapCandidate 加入 swapTeacherAllClasses / absentTeacherAllClasses 欄位（同日所有班別）
- [x] 前端：調課建議卡片顯示「A 老師同日教：X班、Y班」及「請假老師同日教：X班、Y班」

## 新功能：多位老師同日請假
- [x] 後端：generateSuggestions tRPC procedure 支援多位老師（接受 absentTeachers 陣列）
- [x] 前端：第一步支援新增多位請假老師（加入「＋新增老師」按鈕）
- [x] 前端：第二步分別確認每位老師的課堂
- [x] 前端：第三步合並所有老師的代課選擇頁面
- [x] 前端：最終報告合並所有老師的代課總表

## 新功能：老師搜尋篩選
- [x] 前端：老師選擇列表加入搜尋框，支援以全名或簡稱篩選
- [x] 前端：搜尋框即時篩選，不需按確認
- [x] 前端：無結果時顯示「找不到符合的老師」提示

## Bug 修復：無法載入代課建議
- [x] 診斷 generateSuggestionsMulti 失敗原因
- [x] 修復並驗證代課建議正常載入

## Bug 修復：調課資源重複分配
- [x] 後端：generateSuggestionsMulti 在多位老師同日請假時，確保同一老師的同一節課只能被一位請假老師用作調課方案（先到先得，已被分配的調課資源從後續老師的建議中排除）

## Bug 修復：第三步第二位老師無法載入代課建議
- [x] 診斷並修復切換至第二位老師時 currentSuggestions 為空的問題

## Bug 修復：多位老師調課建議重複
- [x] 修復 generateSuggestionsMulti：後續老師的調課建議不應複製前一位老師的調課安排

## Bug 修復：第三位老師無法載入代課建議
- [x] 診斷並修復第 3/3 位老師 currentSuggestions 為空的問題

## 新功能（2026-03-26）

- [x] 功能一：代課老師選單顯示當日有效節數（限 8:30-9:40、9:50-11:00、11:20-13:05、14:00-15:00 時段）
- [x] 功能二：已代過一堂的老師在選單中加入特殊顏色/符號標示（區別於「已被佔用」的禁用狀態）
- [x] 功能三：資料庫記憶功能
  - [x] 新增 substitution_records 資料表（儲存代課記錄）
  - [x] 新增 substitution_record_items 資料表（儲存每堂代課詳情）
  - [x] 後端 API：儲存代課記錄
  - [x] 後端 API：查詢某日代課記錄
  - [x] 後端 API：更新代課記錄
  - [x] 前端：最終報告加入「確認並儲存」按鈕
  - [x] 前端：選擇日期時自動檢查是否有已儲存記錄並提示
  - [x] 前端：已儲存記錄可覆寫更新
- [x] 最終報告每行加入個別修改功能（修改按鈕 + 彈出對話框選擇新代課老師）

## Bug 修復：Production 環境老師列表為空（2026-03-27）
- [x] 診斷根本原因：server/substitution.ts 中 dbDir = process.cwd() + '..' 在 production 環境指向錯誤路徑
- [x] 修復：改為 dbDir = process.cwd()，在 dev 和 production 環境中均指向項目根目錄
- [x] 確認 timetable.db 和 subject_teacher_mappings.json 已在項目根目錄
- [x] 重新建構 production 版本並驗證修復
- [x] 真正根本原因：timetable.db 被 .gitignore 的 *.db 規則排除，production 環境沒有此文件
- [x] 修復：在 .gitignore 加入 !timetable.db 例外規則，並用 git add -f 強制追蹤此文件
