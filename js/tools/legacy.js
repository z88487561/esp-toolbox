// 尚未改寫成統一風格的工具：原頁面放在 legacy/ 以 iframe 執行（同源，Web Serial / Bluetooth 權限共用）。
// 之後改寫完成就把它從這裡移到 js/tools/ 並在 registry.js 換掉即可。
const L=o=>({...o,legacy:true,mount(root){
  const f=document.createElement('iframe');f.className='legacy';f.src=o.file;f.allow='bluetooth; serial';
  root.innerHTML='<div class="note">此工具暫時以原頁面執行，介面風格尚未統一，功能與原本相同。</div>';root.append(f);return()=>f.remove();}});
export default[
L({id:'irhub',cat:'遙控',icon:'📡',name:'IR 遙控器 Hub',sub:'學習、IRDB 選碼、群組與實體按鍵',tags:['USB','BLE','自動連線'],file:'legacy/irhub.html',guide:[
{h:'連線方式',li:['<b>USB</b>：Web Serial，115200 baud；授權一次後下次自動連線。','<b>藍牙</b>：名稱 <code>ESP32-IR-Hub</code>，服務與信箱 Hub 相同，靠名稱區分。','快捷鍵：F1 = USB、F2 = BLE、Esc = 斷線、Ctrl+L = 學習。']},
{h:'資料同步規則',li:['連線後送 <code>READ_ALL</code>，<b>裝置（NVS）資料為準</b>，會覆蓋網頁本機的群組與按鍵。','群組編號 0–9（最多 10 組），每組 4 個按鍵；刪除群組不重排編號。','學習或從 IRDB 指定的碼會同步寫入裝置，<b>實體按鍵才發得出來</b>；匯入 JSON 只存在網頁，需逐顆重新指定才會寫回。','冷氣等狀態型協定只能存到裝置，網頁無法即時測試發射。']},
{h:'IRDB 選碼',li:['目前只能換算 NEC 家族與 Sony SIRC，其他協定請改用「開始學習」。']}]})
];
