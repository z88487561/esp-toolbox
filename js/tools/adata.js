import {delay,write,remember,saved,hasBLE} from '../core/ble.js';
import {toast,esc} from '../core/ui.js';
const JDY=['0000ffe0-0000-1000-8000-00805f9b34fb','0000ffe1-0000-1000-8000-00805f9b34fb'];
const RAC='0000ae00-0000-1000-8000-00805f9b34fb',RW='0000ae01-0000-1000-8000-00805f9b34fb';
const G=[['電源 / 亮度',[['⏻ 開 / 關（切換）',0x21,'wide'],['10%',0x2B],['50%',0x2C],['100%',0x2D],['亮度 −',0x23],['亮度 ＋',0x22]]],
['色溫',[['暖白',0x2A],['自然光',0x29],['冷白',0x28],['色溫 −',0x25],['色溫 ＋',0x24]]],
['情境模式',[['晚安',0x27],['星空',0x26],['派對',0x2F]]],['RGB 彩燈',[['開啟 RGB',0xF8],['關閉 RGB',0xF9]]]];
const NK='tb.adata.name.';
export default{
id:'adata',cat:'燈光',icon:'💡',name:'威剛燈具',sub:'BEAMY 系列 BLE 燈具',tags:['BLE','單裝置'],
guide:[
{h:'怎麼配對',li:['點「連接燈具」，瀏覽器的選擇器<b>只會列出名稱開頭為 <code>BEAMY</code></b> 的藍牙裝置。','一次只連一盞；要換燈請先斷線再重新選。','首次選過之後，瀏覽器會記住授權，下次開啟自動重連（需 Chrome 的 <code>getDevices</code> 支援）。','燈具通常同一時間只接受一個藍牙連線，請先關閉原廠 App。']},
{h:'模組型態（自動偵測）',li:['先試 <b>JDY-19</b>：服務 <code>FFE0</code>、特徵 <code>FFE1</code>（寫入與通知共用）。','失敗再試 <b>RACER03</b>：服務 <code>AE00</code>，寫入 <code>AE01</code>、通知 <code>AE02</code>。']},
{h:'命名規則',li:['自訂名稱只存在<b>這台瀏覽器</b>（以藍牙裝置 ID 為鍵），不會寫進燈具；換瀏覽器或清除資料就會消失。','為避免個資外洩，工具箱內<b>不內建任何 MAC 位址對照表</b>。']},
{h:'指令限制',li:['每個按鈕送出 1 byte 指令；開關是「切換」，無法讀回目前狀態。','RGB 顏色送出序列 <code>FB R FC G FD B</code>，每 byte 間隔 60 ms。']}],
mount(root){
  let dev,wc,alive=true;
  root.innerHTML=`${hasBLE?'':'<div class="note warn">此瀏覽器不支援 Web Bluetooth</div>'}<div class="card"><div class="row"><button class="btn pri" id="c">連接燈具</button><button class="btn" id="d">斷線</button></div>
  <div class="status"><i class="dot" id="dot"></i><span id="st">尚未連接</span></div>
  <div class="row" id="rn" hidden><input type="text" id="nm" placeholder="自訂此燈名稱，例如：客廳主燈"><button class="btn sm" id="sv">儲存</button></div></div>`+
  G.map(([h,bs])=>`<div class="card"><h3>${h}</h3><div class="row wrap">${bs.map(([l,c,w])=>`<button class="btn ${w||''}" data-c="${c}">${l}</button>`).join('')}</div></div>`).join('')+
  `<div class="card"><h3>RGB 顏色</h3><div class="row"><input type="color" id="pk" value="#ff8800" style="flex:1;height:44px;border:0;background:none"><button class="btn" id="rg">套用顏色</button></div></div>`;
  const $=s=>root.querySelector(s);
  const set=(s,t)=>{$('#dot').className='dot '+s;$('#st').textContent=t};
  const lab=()=>{const n=localStorage.getItem(NK+dev.id);return n?`${n}（${dev.name||'燈具'}）`:(dev.name||dev.id)};
  async function open(d){
    dev=d;d.addEventListener('gattserverdisconnected',()=>{if(!alive)return;wc=null;set('err','已斷線');$('#rn').hidden=true});
    set('','連接中…');const s=await d.gatt.connect();
    try{wc=await(await s.getPrimaryService(JDY[0])).getCharacteristic(JDY[1])}
    catch{wc=await(await s.getPrimaryService(RAC)).getCharacteristic(RW)}
    remember('adata',d.id);$('#nm').value=localStorage.getItem(NK+d.id)||'';$('#rn').hidden=false;set('on','已連接：'+lab());
  }
  const send=async v=>{if(!wc)return toast('尚未連接');try{await write(wc,Uint8Array.of(v&255))}catch(e){toast('送出失敗：'+e.message)}};
  $('#c').onclick=async()=>{try{await open(await navigator.bluetooth.requestDevice({filters:[{namePrefix:'BEAMY'}],optionalServices:[JDY[0],RAC]}))}
    catch(e){set('err','連接失敗');if(e.name!=='NotFoundError')toast(e.message)}};
  $('#d').onclick=()=>dev?.gatt.disconnect();
  $('#sv').onclick=()=>{if(!dev)return;const n=$('#nm').value.trim();n?localStorage.setItem(NK+dev.id,n):localStorage.removeItem(NK+dev.id);set('on','已連接：'+lab())};
  root.onclick=e=>{const b=e.target.closest('[data-c]');if(b)send(+b.dataset.c)};
  $('#rg').onclick=async()=>{const h=$('#pk').value,[r,g,b]=[1,3,5].map(i=>parseInt(h.substr(i,2),16));for(const v of[0xFB,r,0xFC,g,0xFD,b]){await send(v);await delay(60)}};
  saved('adata').then(l=>l[0]&&alive&&open(l[0]).catch(()=>set('','自動重連失敗，請手動連接')));
  return()=>{alive=false;try{dev?.gatt.disconnect()}catch{}};
}};
