// 尚未改寫成統一風格的工具：原頁面放在 legacy/ 以 iframe 執行（同源，Web Serial / Bluetooth 權限共用）。
// 之後改寫完成就把它從這裡移到 js/tools/ 並在 registry.js 換掉即可。
const L=o=>({...o,legacy:true,mount(root){
  const f=document.createElement('iframe');f.className='legacy';f.src=o.file;f.allow='bluetooth; serial';
  root.innerHTML='<div class="note">此工具暫時以原頁面執行，介面風格尚未統一，功能與原本相同。</div>';root.append(f);return()=>f.remove();}});
export default[
L({id:'usbplug',cat:'插座',icon:'🔌',name:'智慧 USB 插座',sub:'插座排程、PIN、遙控器群組',tags:['BLE','PIN'],file:'legacy/usbplug.html',guide:[
{h:'怎麼配對（瀏覽器 ↔ 裝置）',li:['BLE 選擇器依服務 UUID <code>69bb3531-…</code> 篩選；<b>插座與遙控器共用同一服務</b>，連上後由韌體回傳 <code>PLUG_INFO</code> 或 <code>REMOTE_INFO</code>，頁面自動顯示插座或遙控器面板。','連線後先送 <code>CHECK_AUTH</code>：回 <code>AUTH:NONE</code> 直接進入；回 <code>AUTH:REQUIRED</code> 需輸入 <b>4–10 位數字 PIN</b>。','驗證通過後自動把瀏覽器時間寫入裝置，並讀取狀態。']},
{h:'插座 ↔ 遙控器 配對規則',li:['<b>遙控器</b>只需設定自己屬於「遙控器 1–10（Group）」。','<b>插座</b>要設定兩項：「對應遙控器」（Group 1–10）與「對應組別號碼」（第 1–4 組）。','設定成功的提示為：現在由 [遙控器 N] 的 [第 M 組] 控制。兩邊的 Group 要一致才會對上。']},
{h:'其他設定',li:['排程分平日（週一–五＋補班日）與假日（週六日＋放假日）；可另外登錄特殊日期，列出未來 180 天清單。','Wi-Fi 僅用於每日定時 NTP 對時；上電預設可選 關 / 開 / 恢復斷電前狀態。','改名上限 20 bytes，送出後插座重啟，需重新連線。']}]}),
L({id:'mailbox',cat:'感測',icon:'📬',name:'信箱巡邏控制台',sub:'超音波信箱 Hub：狀態、歷史、推播日誌',tags:['USB','BLE','自動連線'],file:'legacy/mailbox.html',guide:[
{h:'連線方式',li:['<b>USB</b>：Web Serial，115200 baud。首次要按「USB 連線」授權；之後開啟頁面或重新插上，會自動接回。','<b>藍牙</b>：名稱必須是 <code>PWR_SENSOR</code>，服務 <code>4fafc201-…</code>。','自動連線順序：已授權的 <b>USB 優先</b>，其次藍牙。']},
{h:'配對與重連規則',li:['第一次一定要手動按連線鈕讓瀏覽器取得授權，之後才能自動連線。','藍牙意外斷線後，頁面用 <code>watchAdvertisements</code> 等 Hub 重新廣播，收到就連，失敗每 3 秒重試；<b>手動按「斷線」會取消自動重連</b>。','Hub 韌體必須在斷線後重新廣播。','與 IR Hub 共用同一組服務／特徵 UUID，靠<b>裝置名稱</b>區分，兩者不要混用。']},
{h:'讀數說明',li:['電池為 LiFePO4，電壓無法線性對應電量：≥3.20 V 正常、3.00–3.20 V 偏低、&lt;3.00 V 請充電。','資訊最多延遲 1 小時（Hub 定時回報）。']}]}),
L({id:'irhub',cat:'遙控',icon:'📡',name:'IR 遙控器 Hub',sub:'學習、IRDB 選碼、群組與實體按鍵',tags:['USB','BLE','自動連線'],file:'legacy/irhub.html',guide:[
{h:'連線方式',li:['<b>USB</b>：Web Serial，115200 baud；授權一次後下次自動連線。','<b>藍牙</b>：名稱 <code>ESP32-IR-Hub</code>，服務與信箱 Hub 相同，靠名稱區分。','快捷鍵：F1 = USB、F2 = BLE、Esc = 斷線、Ctrl+L = 學習。']},
{h:'資料同步規則',li:['連線後送 <code>READ_ALL</code>，<b>裝置（NVS）資料為準</b>，會覆蓋網頁本機的群組與按鍵。','群組編號 0–9（最多 10 組），每組 4 個按鍵；刪除群組不重排編號。','學習或從 IRDB 指定的碼會同步寫入裝置，<b>實體按鍵才發得出來</b>；匯入 JSON 只存在網頁，需逐顆重新指定才會寫回。','冷氣等狀態型協定只能存到裝置，網頁無法即時測試發射。']},
{h:'IRDB 選碼',li:['目前只能換算 NEC 家族與 Sony SIRC，其他協定請改用「開始學習」。']}]}),
L({id:'kbd-minikb',cat:'鍵盤',icon:'⌨️',name:'MiniKB（nRF52840）',sub:'3 層 × 12 鍵＋旋鈕，USB / BLE 設定',tags:['USB','BLE'],file:'legacy/kbd-minikb.html',guide:[
{h:'連線方式',li:['<b>USB</b>：Web Serial 115200；開啟後等 1.5 秒再讀設定。','<b>BLE</b>：名稱 <code>MiniKB</code>，Nordic UART 服務 <code>6e400001-…</code>；每包 20 bytes，連線後等 1.5 秒再讀。','兩種連線二選一（同時只用一條通道）。']},
{h:'設定規則',li:['指令 <code>GET2</code> 讀、<code>CFG2:…</code> 寫，寫入成功回 <code>OK</code>。','3 層（Layer 0–2）× 12 鍵，每鍵有 Tap / Hold；Hold 可設「長按切層」；旋鈕順／逆時針所有層共用。','Macro 字串最多 46 字元。']}]}),
L({id:'kbd-rp2040',cat:'鍵盤',icon:'🎹',name:'RP2040 通用鍵盤',sub:'4 層、PIN 手勢解鎖、Macro 語法',tags:['USB'],file:'legacy/kbd-rp2040.html',guide:[
{h:'連線與解鎖規則',li:['只支援 <b>USB（Web Serial）</b>。','<b>讀寫前必須先在實體鍵盤輸入解鎖手勢</b>，否則裝置回 <code>ERR:LOCKED</code>。','連線後先送 <code>GET_HW</code> 取得按鍵數與 GPIO，再用 <code>GET2</code> 讀設定。']},
{h:'設定規則',li:['4 層（Layer 0–3）；每鍵 Tap / Hold，Hold 可設長按切層。','PIN 只寫不讀：數字 1～鍵數，以半形逗號分隔；留空或「取消密碼」關閉開機鎖定。','Macro 字串最多 45 字元，頁內有語法對照表（<code>\\t</code>、<code>[WAIT:ms]</code> 等）。']}]})
];
