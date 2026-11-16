import {Link} from '../core/link.js';
import {delay} from '../core/ble.js';
import {toast,esc} from '../core/ui.js';
const rng=(n,f)=>Array.from({length:n},(_,i)=>f(i)),cc=s=>s.charCodeAt(0)+'';
const C2=['CTRL+C 複製','CTRL+V 貼上','CTRL+X 剪下','CTRL+Z 復原','CTRL+Y 取消復原','CTRL+S 儲存','CTRL+A 全選','CTRL+F 搜尋','CTRL+W 關閉分頁','CTRL+T 新分頁','ALT+F4 關閉','ALT+TAB 切換','GUI+D 桌面','GUI+L 鎖定','GUI+E 檔案總管'];
const C3=[['CTRL+SHIFT+ESC','工作管理員'],['CTRL+ALT+DEL',''],['CTRL+SHIFT+T','還原分頁'],['CTRL+SHIFT+N','無痕視窗'],['CTRL+SHIFT+I','開發工具'],['GUI+SHIFT+S','截圖'],['ALT+SHIFT+TAB','反向切換']];
const MED=[['⏯ 播放／暫停','PLAY'],['⏹ 停止','STOP'],['⏭ 下一首','NEXT'],['⏮ 上一首','PREV'],['🔊 音量增加','VUP'],['🔉 音量減少','VDN'],['🔇 靜音','MUTE']];
const ENC=[['🔊 音量增加','VUP'],['🔉 音量減少','VDN'],['🔇 靜音','MUTE'],['⏭ 下一首','NEXT'],['⏮ 上一首','PREV'],['⏯ 播放／暫停','PLAY'],['⏹ 停止','STOP'],['☀ 亮度增加','BUP'],['🌑 亮度減少','BDN'],['⬆ 向上滾動','SCROLLUP'],['⬇ 向下滾動','SCROLLDN'],['🔍 放大','ZIN'],['🔎 縮小','ZOUT']];
const opts=c=>[['英文字母',rng(26,i=>[String.fromCharCode(65+i),cc(String.fromCharCode(97+i))])],['數字',rng(10,i=>[''+i,cc(''+i)])],
['功能鍵',[['Enter','10'],['Space','32'],['Tab','9'],['Backspace','8'],['Escape',c.esc]]],['符號',[...'!@#$%^&*()-=[]/.'].map(x=>[x,cc(x)])],
['F 鍵',rng(12,i=>['F'+(i+1),'M:K:F'+(i+1)])],['方向鍵',[['↑ 上','UP'],['↓ 下','DOWN'],['← 左','LEFT'],['→ 右','RIGHT']].map(([a,b])=>[a,'M:K:'+b])],
['導航鍵',[['Delete','DEL'],['Insert','INS'],['Home','HOME'],['End','END'],['Page Up','PGUP'],['Page Down','PGDN'],['Print Screen','PRTSC']].map(([a,b])=>[a,'M:K:'+b])],
['修飾鍵',c.mods.map(([a,b])=>[a,'M:K:'+b])],['兩鍵組合',C2.map(x=>[x.replace('GUI','Win'),'M:C:'+x.split(' ')[0]])],
['三鍵組合',C3.map(([k,n])=>[k.replace('GUI','Win')+(n?' '+n:''),'M:C3:'+k])],['媒體控制',MED.map(([a,b])=>[a,'M:'+b])],
['Layer 切換（長按）',rng(c.layers-1,i=>['長按 → Layer '+(i+1),'L:'+(i+1)])],['Macro 字串',[['📝 自訂字串...','T:']]],['(無動作)',[['— 無動作 —','']]]];
const TAGS=[['⏳ 延遲','[WAIT:500]'],['⇥ Tab','\\t'],['⇤ STab','[STAB]'],['↵ Enter','\\n'],['⌫ BSPC','[BSPC]'],['⎋ ESC','[ESC]'],['🔊','[VUP]'],['🔉','[VDN]'],['🔇','[MUTE]']];
const UART=['6e400001-b5a3-f393-e0a9-e50e24dcca9e','6e400002-b5a3-f393-e0a9-e50e24dcca9e','6e400003-b5a3-f393-e0a9-e50e24dcca9e'];
const escM=s=>s.replace(/,/g,'\\c').replace(/\^/g,'\\p').replace(/\|/g,'\\v').replace(/;/g,'\\s');

function make(c){return{id:c.id,icon:c.icon,name:c.name,sub:c.sub,tags:c.ble?['USB','BLE']:['USB'],guide:c.guide,
mount(root){
  const O=opts(c);let link=null,wait=null,N=c.keys||0,pins=[],data=[],enc=['VUP','VDN'],cur=0,alive=true;
  const lab=v=>{if(!v)return'—';if(v.startsWith('T:'))return`📝 "${v.slice(2)}"`;for(const[,it]of O){const f=it.find(x=>x[1]===v);if(f)return f[0]}return v};
  const defaults=()=>{if(!N)return;data=rng(c.layers,l=>rng(N,i=>({tap:l?'':97+i+'',hold:c.hw&&!l&&i<3?'L:'+(i+1):''})))};
  root.innerHTML=`<div class="card" id="cn"><div id="cinfo"><h3>連線到鍵盤</h3><div class="sub">${c.ble?'選擇連線方式（同時只用一條通道）':'透過 USB 連線'}${c.hw?'<br><b class="warnc">請先在實體鍵盤輸入手勢解鎖，再進行讀取</b>':''}</div></div>
   <div class="row wrap"><button class="btn pri" id="usb">🔌 USB 連線</button>${c.ble?'<button class="btn pri" id="ble">📶 BLE 連線</button>':''}<button class="btn dan" id="off" hidden>斷線</button></div><div class="status"><i class="dot" id="dot"></i><span id="cs">未連線</span></div></div>
  <div id="ed" hidden>
  ${c.hw?`<div class="card"><h3>🔐 解鎖手勢 PIN（只寫不讀）</h3><div class="sub" id="pd"></div><div class="row"><input type="text" id="pin" placeholder="例如 1,3,2（留空代表取消）"><button class="btn sm" id="ps">更新</button><button class="btn sm dan" id="pc">取消密碼</button></div></div>`:''}
  <div class="card"><div class="row wrap"><span class="sub" style="flex:1">設定檔</span><button class="btn sm" id="ex">⬇ 匯出 JSON</button><button class="btn sm" id="im">⬆ 匯入 JSON</button><button class="btn sm" id="rd">🔄 重新讀取</button><input type="file" id="fi" accept=".json" hidden></div></div>
  ${c.enc?`<div class="card"><h3>旋鈕功能（所有層共用）</h3><div class="row"><label class="f" style="flex:1;flex-direction:column">↻ 順時針<select id="cw"></select></label><label class="f" style="flex:1;flex-direction:column">↺ 逆時針<select id="ccw"></select></label></div></div>`:''}
  <div class="seg" id="lt" style="margin-bottom:12px">${rng(c.layers,l=>`<button data-l="${l}" class="${l?'':'on'}">Layer ${l}</button>`).join('')}</div><div id="kg"></div>
  <div class="savebar" id="sb" hidden><button class="btn" id="rs">↺ 恢復預設</button><span class="sub">有未儲存的變更</span><button class="btn pri" id="sv">💾 寫入鍵盤</button></div></div>`;
  const $=s=>root.querySelector(s);
  const conn=(t,on)=>{$('#cs').textContent=t;$('#dot').className='dot'+(on?' on':'')};
  const mark=()=>$('#sb').hidden=false;
  const onLine=l=>{if(wait){const w=wait;wait=null;w(l)}};
  const req=(line,ms=5000)=>new Promise((ok,no)=>{const t=setTimeout(()=>{wait=null;no('timeout')},ms);wait=r=>{clearTimeout(t);ok(r)};link.send(line).catch(e=>{clearTimeout(t);wait=null;no(e)})});
  const shown=on=>{$('#ed').hidden=!on;$('#cinfo').hidden=on;$('#usb').hidden=on;if(c.ble)$('#ble').hidden=on;$('#off').hidden=!on;if(!on)$('#sb').hidden=true};
  const onClose=()=>{link=null;shown(false);conn('已斷線');toast('連線已中斷')};
  async function after(l,label){link=l;shown(true);conn(label,true);await delay(1500);await read()}
  $('#usb').onclick=async()=>{try{const l=new Link(onLine,onClose);await l.usb(await navigator.serial.requestPort());await after(l,'USB 已連線')}catch(e){toast('USB 連線失敗：'+(e.message||e))}};
  if(c.ble)$('#ble').onclick=async()=>{try{const d=await navigator.bluetooth.requestDevice({filters:[{name:c.ble}],optionalServices:[UART[0]]});const l=new Link(onLine,onClose);await l.ble(d,UART[0],UART[1],UART[2],{gap:30});await after(l,'BLE 已連線')}catch(e){toast('BLE 連線失敗，請確認鍵盤已開啟')}};
  $('#off').onclick=async()=>{const l=link;link=null;await l?.close();shown(false);conn('已斷線')};
  const ser=()=>rng(c.layers,l=>data[l].map(k=>{let t=k.tap,h=k.hold;if(c.escape){if(t.startsWith('T:'))t='T:'+escM(t.slice(2));if(h.startsWith('T:'))h='T:'+escM(h.slice(2))}return t+'^'+h}).join(',')).join('|')+';'+(c.enc?enc[0]+';'+enc[1]:'NOENC;NOENC');
  function parse(s){const s2=s.lastIndexOf(';'),s1=s2>0?s.lastIndexOf(';',s2-1):-1;if(s1<0||s1===s2)return null;
    const L=s.slice(0,s1).split('|'),d=rng(c.layers,l=>{const tk=(L[l]||'').split(',');return rng(N,i=>{const t=tk[i]||'',k=t.indexOf('^');return{tap:k<0?t:t.slice(0,k),hold:k<0?'':t.slice(k+1)}})});
    return{d,cw:s.slice(s1+1,s2).trim(),ccw:s.slice(s2+1).trim()}}
  async function read(){toast('讀取設定中…');
    try{if(c.hw){const r=await req('GET_HW',4000);if(r==='ERR:LOCKED')return toast('❌ 實體鍵盤未解鎖，請先輸入手勢');if(!r.startsWith('HW:'))throw 0;
        r.slice(3).split(';').forEach(p=>{if(p.startsWith('KEYS='))N=+p.slice(5);if(p.startsWith('PINS='))pins=p.slice(5).split(',').map(Number)});$('#pd').textContent=`請輸入數字（1~${N}），以半形逗號隔開；留空或按「取消密碼」關閉開機鎖定。`}
      const r=await req('GET2',6000);if(r.startsWith('CFG2:')){const p=parse(r.slice(5));if(p){data=p.d;enc=[p.cw,p.ccw];build();return toast(`✅ 已載入${c.hw?` ${N} 鍵`:'設定'}`)}}toast('讀取格式異常，顯示預設值')}
    catch{toast('讀取逾時'+(c.hw?'（請確認已在鍵盤輸入手勢解鎖）':''))}
    defaults();build()}
  const collect=(l=cur)=>{root.querySelectorAll('#kg select').forEach(s=>{const i=+s.dataset.i,t=s.dataset.k;let v=s.value;if(v==='T:')v='T:'+root.querySelector(`input[data-m="${t}"][data-i="${i}"]`).value;data[l][i][t]=v})};
  function build(){
    if(c.enc)['cw','ccw'].forEach((id,k)=>{$('#'+id).innerHTML=ENC.map(([a,b])=>`<option value="${b}" ${b===enc[k]?'selected':''}>${a}</option>`).join('')});
    const card=i=>{const k=data[cur][i];return`<div class="kc"><div class="kb">K${i+1}${pins[i]!=null?`<span class="chip">GP${pins[i]}</span>`:''}</div>`+['tap','hold'].map(t=>{const v=k[t],m=v.startsWith('T:');
      return`<div class="th"><span class="lb ${t}">${t==='tap'?'Tap':'Hold'}</span><select data-k="${t}" data-i="${i}">${O.map(([g,it])=>`<optgroup label="${g}">${it.map(([a,b])=>`<option value="${esc(b)}" ${b===(m?'T:':v)?'selected':''}>${esc(a)}</option>`).join('')}</optgroup>`).join('')}</select></div>
      <div class="mw" ${m?'':'hidden'}><input type="text" data-m="${t}" data-i="${i}" maxlength="${c.macroMax}" placeholder="輸入字串（最多 ${c.macroMax} 字元）" value="${esc(m?v.slice(2):'')}">${c.escape?`<div class="tg">${TAGS.map(([a,b])=>`<button type="button" data-ins="${esc(b)}">${a}</button>`).join('')}</div>`:''}</div>`}).join('')+'</div>'};
    $('#kg').innerHTML=c.rows?[2,1,0].map(r=>`<h2>按鍵 ${r*4+1} – ${r*4+4}</h2><div class="kgrid">${rng(4,j=>card(r*4+j)).join('')}</div>`).join(''):`<div class="kgrid">${rng(N,card).join('')}</div>`}
  $('#kg').onchange=e=>{const s=e.target;if(s.tagName==='SELECT'){s.parentElement.nextElementSibling.hidden=s.value!=='T:'}mark()};
  $('#kg').oninput=mark;
  $('#kg').onclick=e=>{const b=e.target.closest('[data-ins]');if(!b)return;const i=b.closest('.mw').querySelector('input');const p=i.selectionStart??i.value.length;i.value=i.value.slice(0,p)+b.dataset.ins+i.value.slice(i.selectionEnd??p);i.focus();mark()};
  $('#lt').onclick=e=>{const b=e.target.closest('button');if(!b)return;collect();cur=+b.dataset.l;root.querySelectorAll('#lt button').forEach(x=>x.classList.toggle('on',x===b));build()};
  if(c.enc)['cw','ccw'].forEach((id,k)=>$('#'+id).onchange=e=>{enc[k]=e.target.value;mark()});
  $('#rd').onclick=read;
  $('#rs').onclick=()=>{if(!confirm('確定要恢復所有按鍵為預設值嗎？\n（僅還原目前畫面，尚未寫入鍵盤）'))return;defaults();build();mark();toast('已恢復預設值（請記得寫入鍵盤）')};
  $('#sv').onclick=async()=>{if(!link)return;$('#sv').disabled=true;toast('寫入中…');collect();
    try{const r=await req('CFG2:'+ser(),6000);if(r==='OK'){$('#sb').hidden=true;toast('✅ 設定已儲存到鍵盤！')}else toast(r==='ERR:LOCKED'?'❌ 實體鍵盤尚未解鎖！':'寫入失敗：'+r)}catch{toast('寫入逾時，請重試')}
    $('#sv').disabled=false};
  if(c.hw){const pin=async v=>{if(!link)return toast('請先連線到鍵盤');
      if(v&&v!=='NONE'){const a=v.split(',').map(x=>x.trim()).filter(Boolean);if(!a.length||a.some(x=>!(+x>=1&&+x<=N)))return toast(`❌ PIN 數字必須介於 1 到 ${N}`)}
      const s=v||'NONE';try{const r=await req('SETPIN:'+s,6000);toast(r==='OK:PIN_UPDATED'?(s==='NONE'?'🔓 密碼已取消':'🔐 PIN 已更新'):r==='ERR:LOCKED'?'❌ 實體鍵盤尚未解鎖！':r==='ERR:PIN_INVALID'?`❌ PIN 必須介於 1~${N}`:'更新失敗：'+r);if(r==='OK:PIN_UPDATED')$('#pin').value=''}catch{toast('更新逾時，請重試')}};
    $('#ps').onclick=()=>pin($('#pin').value.trim());$('#pc').onclick=()=>pin('NONE')}
  $('#ex').onclick=()=>{collect();const L=data.map(l=>l.map((k,i)=>({key:'K'+(i+1),...(c.hw?{gpio:'GP'+pins[i]}:{}),tap:k.tap,tap_label:lab(k.tap),hold:k.hold,hold_label:lab(k.hold)})));
    const o={_note:c.note,_version:c.ver,...(c.hw?{_keys:N}:{encCW:enc[0],encCW_label:ENC.find(x=>x[1]===enc[0])?.[0]||enc[0],encCCW:enc[1],encCCW_label:ENC.find(x=>x[1]===enc[1])?.[0]||enc[1]}),layers:L};
    const a=Object.assign(document.createElement('a'),{href:URL.createObjectURL(new Blob([JSON.stringify(o,null,2)],{type:'application/json'})),download:`${c.file}_${new Date().toISOString().slice(0,10)}.json`});a.click();URL.revokeObjectURL(a.href);toast('✅ 設定已匯出')};
  $('#im').onclick=()=>$('#fi').click();
  $('#fi').onchange=e=>{const f=e.target.files[0];e.target.value='';if(!f)return;const r=new FileReader();r.onload=()=>{try{const j=JSON.parse(r.result);
    if(j._version===1&&c.v1){if(!Array.isArray(j.keys)||j.keys.length!==N)throw Error('v1 格式：keys 欄位不正確（需 12 個）');data.forEach((L,l)=>L.forEach((k,i)=>{k.tap=l?'':String(j.keys[i]||'');k.hold=''}))}
    else{if(j._version!==c.ver)throw Error('不支援的版本：_version='+j._version);if(!Array.isArray(j.layers)||j.layers.length!==c.layers)throw Error('layers 欄位格式不正確');
      j.layers.forEach((L,l)=>{if(!Array.isArray(L)||L.length!==N)throw Error(`Layer ${l} 按鍵數量不正確（需 ${N} 個）`);L.forEach((k,i)=>{data[l][i].tap=String(k.tap||'');data[l][i].hold=String(k.hold||'')})})}
    if(c.enc)enc=[j.encCW||'VUP',j.encCCW||'VDN'];build();mark();toast('✅ 設定已匯入，請確認後寫入鍵盤')}catch(x){toast('❌ 匯入失敗：'+x.message)}};r.readAsText(f)};
  if(!N&&!c.hw)N=12;defaults();if(N)build();
  return()=>{alive=false;link?.close()};
}}}

export const kbMini=make({id:'kbd-minikb',icon:'⌨️',name:'MiniKB',sub:'nRF52840：3 層 × 12 鍵＋旋鈕，USB / BLE',ble:'MiniKB',layers:3,keys:12,enc:true,rows:true,esc:'27',macroMax:46,ver:2,v1:true,file:'miniKB_v2',note:'SuperMini nRF52840 v2 鍵盤設定檔',
 mods:[['Ctrl','CTRL'],['Shift','SHIFT'],['Alt','ALT'],['Win/Cmd','GUI']],
 guide:[{h:'連線方式',li:['<b>USB</b>：Web Serial 115200；連線後等 1.5 秒再讀設定。','<b>BLE</b>：名稱 <code>MiniKB</code>，Nordic UART 服務 <code>6e400001-…</code>；每包 20 bytes，連線後等 1.5 秒再讀。','兩種連線二選一（同時只用一條通道）。']},
 {h:'設定規則',li:['<code>GET2</code> 讀、<code>CFG2:…</code> 寫，寫入成功回 <code>OK</code>。','3 層（Layer 0–2）× 12 鍵，每鍵有 Tap / Hold；Hold 可設「長按切層」；旋鈕順／逆時針所有層共用。','Macro 字串最多 46 字元。','匯入支援舊版 v1（只有 Layer 0 的 Tap）。']}]});
export const kbRp=make({id:'kbd-rp2040',icon:'🎹',name:'RP2040 通用鍵盤',sub:'4 層、PIN 手勢解鎖、Macro 語法，僅 USB',ble:null,hw:true,layers:4,enc:false,esc:'M:K:ESC',macroMax:45,escape:true,ver:3,file:'rp2040_key',note:'RP2040 鍵盤設定檔',
 mods:[['Ctrl (左)','LCTRL'],['Ctrl (右)','RCTRL'],['Shift (左)','LSHIFT'],['Shift (右)','RSHIFT'],['Alt (左)','LALT'],['AltGr (右Alt)','RALT'],['Win/Cmd (左)','LGUI'],['Win/Cmd (右)','RGUI']],
 guide:[{h:'連線與解鎖規則',li:['只支援 <b>USB（Web Serial）</b>。','<b>讀寫前必須先在實體鍵盤輸入解鎖手勢</b>，否則裝置回 <code>ERR:LOCKED</code>。','連線後先送 <code>GET_HW</code> 取得按鍵數與 GPIO，再用 <code>GET2</code> 讀設定。']},
 {h:'設定規則',li:['4 層（Layer 0–3）；每鍵 Tap / Hold，Hold 可設長按切層。','PIN 只寫不讀：數字 1～鍵數，以半形逗號分隔；留空或「取消密碼」關閉開機鎖定。','Macro 字串最多 45 字元；<code>, ^ | ;</code> 寫入時會自動轉義。']},
 {h:'Macro 語法',li:['<code>\\t</code> Tab、<code>\\n</code> Enter、<code>\\\\</code> 反斜線。','<code>[BSPC]</code> <code>[DEL]</code> <code>[ESC]</code> <code>[SPACE]</code> <code>[ENTER]</code> <code>[STAB]</code>（Shift+Tab）。','<code>[F1]</code>～<code>[F12]</code>、<code>[VUP]</code> <code>[VDN]</code> <code>[MUTE]</code>。','<code>[WAIT:ms]</code> 延遲，例：<code>cmd[WAIT:500]\\n</code>。']}]});
