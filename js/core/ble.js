// 共用 BLE 工具。每個原生工具用自己的 id 記住「成功連過的裝置」，下次開啟自動重連。
export const hasBLE=!!navigator.bluetooth;
export const delay=ms=>new Promise(r=>setTimeout(r,ms));
export async function write(ch,data){return ch.writeValueWithoutResponse?ch.writeValueWithoutResponse(data):ch.writeValue(data)}
const K=t=>'tb.devs.'+t;
export function remember(tool,devId){
  try{const a=JSON.parse(localStorage.getItem(K(tool))||'[]');if(!a.includes(devId))localStorage.setItem(K(tool),JSON.stringify([...a,devId]))}catch{}
}
export async function saved(tool){
  try{const ids=JSON.parse(localStorage.getItem(K(tool))||'[]');
    return navigator.bluetooth?.getDevices?(await navigator.bluetooth.getDevices()).filter(d=>ids.includes(d.id)):[]}catch{return[]}
}

// ===== 自動連線（所有 BLE 工具共用）=====
export const FLAG='請在 Chrome 網址列輸入 chrome://flags/#enable-web-bluetooth-new-permissions-backend，設為 Enabled 並重新啟動瀏覽器';
// 取出「已授權且是這個工具記住過的」裝置；沒有時用 say() 說明原因（含旗標設定）
export async function permitted(tool,{name,say=()=>{},quietFirst=false}={}){
  if(!navigator.bluetooth){say('此瀏覽器不支援 Web Bluetooth');return[]}
  if(!navigator.bluetooth.getDevices){say('⚠️ 此瀏覽器沒有 getDevices()，無法自動重連藍牙。'+FLAG);return[]}
  let all=[],ids=[];try{all=await navigator.bluetooth.getDevices()}catch{}
  try{ids=JSON.parse(localStorage.getItem(K(tool))||'[]')}catch{}
  const m=all.filter(d=>ids.includes(d.id)||(name&&d.name===name));
  if(!m.length){if(ids.length)say(`⚠️ 瀏覽器沒有保留這個裝置的授權（getDevices 回傳 ${all.length} 筆）。${FLAG}，之後再手動連線一次`);
    else if(!quietFirst)say('首次使用：請先手動連線一次，之後開啟頁面就會自動連上。若重新載入後仍沒有自動連上，'+FLAG)}
  return m}
let chain=Promise.resolve();const serial=f=>(chain=chain.then(f,f));
// 等裝置廣播（不支援時每 3 秒直接試）→ 連線；失敗持續重試。open 丟出 {fatal:true} 的錯誤會停止。回傳停止函式。
export function keepTrying(dev,open,ok=()=>true){
  let stop=false,ctl=null;
  (async()=>{while(!stop&&ok()){
    if(dev.watchAdvertisements){const c=new AbortController();ctl=c;
      try{await new Promise((res,rej)=>{dev.addEventListener('advertisementreceived',res,{once:true});dev.watchAdvertisements({signal:c.signal}).catch(rej)})}catch{}
      c.abort();if(stop)return}
    if(!ok())return;
    try{await serial(()=>open(dev));return}catch(e){if(e?.fatal)return}
    await delay(3000)}})();
  return()=>{stop=true;try{ctl?.abort()}catch{}}}
export const autoGuide=(extra=[])=>({h:'自動連線',li:['成功手動連線過的裝置會被記住；之後開啟本頁會自動連上（裝置需在範圍內並正在廣播）。','連線中斷後會持續自動重連；離開本頁（或手動斷線）就會停止。','<b>需要瀏覽器保留藍牙授權</b>：Chrome 請在網址列輸入 <code>chrome://flags/#enable-web-bluetooth-new-permissions-backend</code>，設為 Enabled 並重新啟動瀏覽器（每個瀏覽器／裝置各設一次）。','授權是依「網址」記錄的；換網址、清除網站資料或用無痕視窗，都要重新手動連線一次。',...extra]});
