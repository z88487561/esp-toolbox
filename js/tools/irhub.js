import {Link} from '../core/link.js';
import {toast,esc} from '../core/ui.js';
import {permitted,keepTrying,remember,autoGuide} from '../core/ble.js';
const NS='esp32hub_',BPG=4,MAXG=10,UK='tb.ir.usb',SVC='4fafc201-1fb5-459e-8fcc-c5c9c331914b',CH='beb5483e-36e1-4688-b7f5-ea07361b26a8';
const API='https://api.github.com/repos/probonopd/irdb/contents/codes',CDN='https://cdn.jsdelivr.net/gh/probonopd/irdb@master/codes',CMS=6048e5;
const STATE=['PANASONIC_AC','DAIKIN','DAIKIN2','MITSUBISHI_AC','GREE','COOLIX48','HITACHI_AC','FUJITSU_AC'],isState=p=>STATE.includes((p||'').toUpperCase());
const rev=(v,n)=>{v=BigInt(v);let r=0n;for(let i=0;i<n;i++){r=(r<<1n)|(v&1n);v>>=1n}return r};
function nec(a,c){a=BigInt(a)&0xFFFFn;c=rev(BigInt(c)&0xFFn,8);c=(c<<8n)+(c^0xFFn);if(a>0xFFn){return(rev(a,16)<<16n)+c}a=rev(a,8);return(a<<24n)+((a^0xFFn)<<16n)+c}
function sony(n,c,a,e){a=BigInt(a);c=BigInt(c);e=BigInt(e||0);let r;if(n===12)r=a&0x1Fn;else if(n===15)r=a&0xFFn;else if(n===20)r=(a&0x1Fn)|((e&0xFFn)<<5n);else return null;return rev((r<<7n)|(c&0x7Fn),n)}
function convert(p,d,s,f){p=p.toUpperCase();if(p.startsWith('NEC'))return{proto:'NEC',hex:'0x'+nec(s>=0?(d|(s<<8)):d,f).toString(16).toUpperCase(),bits:32};
  const m=p.match(/^SONY(12|15|20)$/);if(m){const n=+m[1],c=sony(n,f,d,s>=0?s:0);return c===null?null:{proto:'SONY',hex:'0x'+c.toString(16).toUpperCase(),bits:n}}return null}
const lg=()=>JSON.parse(localStorage.getItem(NS+'groups'))||[{gIdx:0,name:'遙控器 1',order:[1,2,3,4]}],sg=g=>localStorage.setItem(NS+'groups',JSON.stringify(g));
const K=(g,p)=>NS+'ir_g'+g+'_b'+p,gd=(g,p)=>JSON.parse(localStorage.getItem(K(g,p))),sd=(g,p,v)=>localStorage.setItem(K(g,p),JSON.stringify(v));
const defOrder=()=>Array.from({length:BPG},(_,i)=>i+1);
async function ls(path){const k='irdb_cache_'+path;try{const r=JSON.parse(localStorage.getItem(k));if(r&&Date.now()-r.t<CMS)return r.data}catch{}
  const res=await fetch(API+(path?'/'+path:''));if(!res.ok)throw Error('IRDB API錯誤 '+res.status);const d=(await res.json()).map(i=>({name:i.name,type:i.type}));try{localStorage.setItem(k,JSON.stringify({t:Date.now(),data:d}))}catch{}return d}
export default{
id:'irhub',icon:'📡',name:'IR 遙控器 Hub',sub:'學習、IRDB 選碼、群組與實體按鍵',tags:['USB','BLE','自動連線'],
guide:[
{h:'連線方式',li:['<b>USB</b>：Web Serial，115200 baud；授權一次後下次自動連線（記住 VID/PID）。','<b>藍牙</b>：名稱 <code>ESP32-IR-Hub</code>，服務與信箱 Hub 相同，靠名稱區分。','快捷鍵：F1 = USB、F2 = 藍牙、Esc = 斷線、Ctrl+L = 開始學習。']},
autoGuide(),
{h:'資料同步與配對規則',li:['連線後送 <code>READ_ALL</code>，<b>裝置（NVS）資料為準</b>，會覆蓋網頁本機的群組與按鍵。','群組編號 0–9（最多 10 組），每組 4 個按鍵；刪除群組不重排編號，新增時取第一個空位。','學習或從 IRDB 指定的碼會同步寫入裝置，<b>實體按鍵才發得出來</b>；匯入 JSON 只存在網頁，需逐顆重新指定才會寫回。','冷氣等狀態型協定只能存到裝置，網頁無法即時測試發射。','切換群組時會同步通知裝置（<code>SET_GROUP</code>）。']},
{h:'IRDB 選碼',li:['資料來源為 probonopd/irdb（需要網路）。','目前只能換算 NEC 家族與 Sony SIRC（12/15/20 bit），其他協定請改用「開始學習」。']}],
mount(root){
  let link=null,cur=0,edit=false,sync=null,paused=false,logs=[],alive=true,dev=null,manual=false,stopI=null;
  const BT=(id,t,c='')=>`<button class="btn ${c}" id="${id}">${t}</button>`;
  root.innerHTML=`<div class="card"><div class="row wrap">${BT('usb','🔌 USB')}${BT('ble','📶 藍牙','pri')}${BT('off','✕ 斷線','dan')}</div><div class="status"><i class="dot" id="dot"></i><span id="cs">未連線</span></div><div class="sub" id="ln" style="margin-top:6px">等待指令輸入…</div></div>
  <div class="card"><h3>🎓 學習 / 指定位置</h3><div class="row wrap"><select id="lg"></select><select id="lp"></select><input type="text" id="nm" placeholder="按鍵名稱" style="width:110px;flex:1">${BT('lb','開始學習','pri')}</div></div>
  <div class="card"><h3>📚 從資料庫選擇（IRDB）</h3><div class="row"><select id="b" style="flex:1"><option value="">載入品牌中…</option></select><select id="t" style="flex:1" disabled><option>先選品牌</option></select></div><div class="row"><select id="d" style="flex:1" disabled><option>先選類型</option></select><select id="f" style="flex:1" disabled><option>先選裝置</option></select></div>
   <div class="note" id="inf" style="margin-top:10px">選好功能鍵後，這裡會顯示可指定的協定資訊。</div><div class="row">${BT('as','指定到上方選擇的群組 / 位置','pri').replace('<button','<button disabled')}</div><div class="sub" style="margin-top:6px">冷氣（狀態型協定）目前無法自動換算，請改用學習。</div></div>
  <div class="card"><div class="row"><h3 style="margin:0;flex:1">📱 遙控器面板</h3>${BT('ed','排序模式','sm')}</div><div class="row" style="overflow-x:auto" id="gb"></div><div class="row"><button class="btn sm" id="rn">✏️ 重新命名</button><button class="btn sm dan" id="dg">🗑 刪除此群組</button></div>
   <div class="irg" id="gr" style="margin-top:12px"></div><div class="row"><button class="btn" id="ex">📤 匯出設定</button><button class="btn" id="im">📥 匯入設定</button><input type="file" id="fi" accept=".json" hidden></div></div>
  <div class="card"><div class="row"><h3 style="margin:0;flex:1">🖥️ Serial 日誌 <span class="sub" id="sc">0 / 100</span></h3>${BT('pa','⏸','sm')}${BT('cp','📋','sm')}${BT('cl','🗑','sm')}</div><div class="sl" id="sl" style="margin-top:8px"></div><div class="row"><input type="text" id="si" placeholder="輸入指令，Enter 送出（例：LEARN_ON）" style="flex:1">${BT('ss','送出','sm')}</div></div>`;
  const $=s=>root.querySelector(s);
  const conn=(t,on)=>{$('#cs').textContent=t;$('#dot').className='dot'+(on?' on':'')};
  const row=e=>`<div><span class="ts">${e.ts}</span><span class="${e.d}">${{tx:'→TX',rx:'←RX',sys:'SYS',err:'ERR'}[e.d]} ${esc(e.m)}</span></div>`;
  function slog(d,m){const n=new Date(),e={ts:n.toTimeString().slice(0,8)+'.'+String(n.getMilliseconds()).padStart(3,'0'),d,m};logs.push(e);if(logs.length>100)logs.shift();if(!paused)draw()}
  function draw(){const s=$('#sl'),b=s.scrollHeight-s.scrollTop-s.clientHeight<40;s.innerHTML=logs.map(row).join('');$('#sc').textContent=logs.length+' / 100';if(b)s.scrollTop=s.scrollHeight}
  function say(m){$('#ln').textContent=m;slog(m.startsWith('發送:')?'tx':m.startsWith('收到:')?'rx':/^⚠️|失敗|錯誤/.test(m)?'err':'sys',m)}
  async function cmd(c){if(!link?.kind){say('⚠️ 未連線，請先點擊連線按鈕');conn('未連線');throw Error('未連線')}say('發送: '+c);try{await link.send(c)}catch(e){say('發送失敗: '+e);throw e}}
  const q=async(c)=>{try{await cmd(c)}catch{}};
  const wr=(g,p,d)=>q(d.isState?`SAVE_STATE,${g},${p-1},${d.p},${d.h}`:`SAVE,${g},${p-1},${d.p},${d.h},${d.b},${d.name}`);
  const onClose=k=>{link=null;conn('已斷線');slog('sys',k==='ble'?'📶 BLE 已斷線':'🔌 USB 已中斷');if(k==='ble'&&dev&&!manual&&alive){conn('自動重連中…');stopI=keepTrying(dev,bleOpen,()=>alive&&!manual&&!link?.kind)}};
  async function useLink(l,label){link=l;conn(label,true);slog('sys','✅ '+label);setTimeout(()=>q('READ_ALL'),300)}
  async function openUSB(p,auto){if(link?.kind)return toast('已連線，請先斷線');const l=new Link(handle,onClose);await l.usb(p);try{const i=p.getInfo();localStorage.setItem(UK,JSON.stringify({v:i.usbVendorId,p:i.usbProductId}))}catch{}await useLink(l,auto?'USB 已連線（自動）':'USB 已連線')}
  $('#usb').onclick=async()=>{stopI?.();try{await openUSB(await navigator.serial.requestPort())}catch(e){if(!/No port selected/.test(e.message))say('USB 連線失敗: '+e)}};
  const bleOpen=async d=>{if(!alive||link?.kind)throw Object.assign(Error(),{fatal:true});const l=new Link(handle,onClose);await l.ble(d,SVC,CH,CH);remember('irhub',d.id);dev=d;await useLink(l,'藍牙已連線')};
  $('#ble').onclick=async()=>{if(link?.kind)return toast('已連線，請先斷線');manual=false;stopI?.();try{await bleOpen(await navigator.bluetooth.requestDevice({filters:[{name:'ESP32-IR-Hub'}],optionalServices:[SVC]}))}catch(e){if(!/cancel|No device selected/i.test(e.message))say('BLE 連線失敗: '+e)}};
  const off=async()=>{manual=true;stopI?.();const l=link;link=null;await l?.close();conn('已斷線');slog('sys','🔌 已手動斷線')};$('#off').onclick=off;
  async function auto(){
    try{const ps=navigator.serial?await navigator.serial.getPorts():[];let i=null;try{i=JSON.parse(localStorage.getItem(UK))}catch{}
      const p=i?ps.find(x=>{const y=x.getInfo();return y.usbVendorId===i.v&&y.usbProductId===i.p}):ps[0];if(p){await openUSB(p,true);return}}
    catch(e){slog('sys',/already open/.test(e.message)?'⚠️ 裝置被其他程式占用，請關閉 Serial Monitor':'⚠️ USB 自動連線失敗：'+e.message)}
    const d=(await permitted('irhub',{name:'ESP32-IR-Hub',say:m=>slog('sys',m)}))[0];
    if(d&&alive&&!link?.kind){dev=d;conn('尋找 Hub 中…');slog('sys','找到已授權的藍牙裝置，嘗試連線…');stopI=keepTrying(d,bleOpen,()=>alive&&!manual&&!link?.kind)}}
  const hk=e=>{if(e.key==='F1'){e.preventDefault();$('#usb').click()}else if(e.key==='F2'){e.preventDefault();$('#ble').click()}else if(e.key==='Escape')off();else if(e.ctrlKey&&e.key==='l'){e.preventDefault();learn()}};addEventListener('keydown',hk);
  const lb=(t,c)=>{const b=$('#lb');b.textContent=t;b.className='btn '+(c||'pri')};
  async function learn(){lb('⏳ 等待訊號…','wait');try{await cmd('LEARN_ON')}catch{lb('開始學習')}} $('#lb').onclick=learn;
  function handle(t){say('收到: '+t);const P=t.split(',');
    if(t.startsWith('RECV,')&&P.length>=4){const g=+$('#lg').value,pos=+$('#lp').value,proto=P[1].trim(),d={name:$('#nm').value||'按鈕 '+pos,p:proto,isState:isState(proto)?1:0,h:P.slice(2,-1).join(',').trim(),b:P[P.length-1].trim()};
      sd(g,pos,d);wr(g,pos,d);lb('✅ 學習成功！','okk');setTimeout(()=>lb('開始學習'),2000);if(g===cur)grid();return}
    if(t.startsWith('CURR_GROUP,')){sync={cg:+P[1]||0,groups:[],btn:{}};return}
    if(t.startsWith('GROUP,')&&sync){const g=+P[1];sync.groups.push({gIdx:g,name:P.slice(2).join(',')||'遙控器 '+(g+1),order:defOrder()});return}
    if(t.startsWith('SYNC,')&&sync){if(P.length>=6){const g=+P[1],pos=+P[2]+1;sync.btn[K(g,pos)]={name:P.length>=7?P.slice(6).join(','):'按鍵'+pos,p:P[3],isState:isState(P[3])?1:0,h:P[4],b:P[5]}}return}
    if(t==='SYNC_DONE'&&sync){if(!sync.groups.length)sync.groups.push({gIdx:0,name:'遙控器 1',order:defOrder()});
      Object.keys(localStorage).filter(k=>k.startsWith(NS+'ir_')).forEach(k=>localStorage.removeItem(k));sg(sync.groups);Object.entries(sync.btn).forEach(([k,v])=>localStorage.setItem(k,JSON.stringify(v)));
      cur=sync.groups.some(g=>g.gIdx===sync.cg)?sync.cg:sync.groups[0].gIdx;all();slog('sys',`📡 已從裝置同步：${sync.groups.length} 組資料`);sync=null;return}
    if(t.startsWith('ERR,GROUP_FULL'))return toast('裝置端群組已滿（10 組），建議重新連線以重新同步');
    if(t==='NOTIFY,LEARNING_START')lb('⏳ 等待訊號…','wait');
    else if(t==='NOTIFY,LEARN_TIMEOUT'){lb('⚠️ 超時，重試','wait');setTimeout(()=>lb('開始學習'),2000)}
    else if(t==='OK,IR_SENT')say('✅ IR 已發射');
    else if(t.startsWith('ERR,')&&$('#lb').textContent.includes('等待'))lb('開始學習')}
  function all(){bar();grid();sel()}
  function sel(){const G=lg(),s=$('#lg');s.innerHTML=G.map(g=>`<option value="${g.gIdx}">${esc(g.name)}</option>`).join('');s.value=cur;const p=$('#lp');if(!p.options.length)for(let i=1;i<=BPG;i++)p.add(new Option('位置 '+i,i))}
  $('#lg').onchange=e=>{cur=+e.target.value;bar();grid();q('SET_GROUP,'+cur)};
  function bar(){$('#gb').innerHTML=lg().map(g=>`<button class="gt ${g.gIdx===cur?'on':''}" data-g="${g.gIdx}">${esc(g.name)}</button>`).join('')+'<button class="gt" data-add="1">＋ 新增</button>'}
  $('#gb').onclick=e=>{const b=e.target.closest('button');if(!b)return;
    if(b.dataset.add){const G=lg(),u=new Set(G.map(g=>g.gIdx));let n=-1;for(let i=0;i<MAXG;i++)if(!u.has(i)){n=i;break}if(n<0)return toast(`最多只能建立 ${MAXG} 組`);
      const name=prompt('新群組名稱：','遙控器 '+(G.length+1));if(!name)return;G.push({gIdx:n,name,order:defOrder()});sg(G);cur=n;all();q('ADD_GROUP,'+name)}
    else{cur=+b.dataset.g;all();q('SET_GROUP,'+cur)}};
  $('#rn').onclick=()=>{const G=lg(),g=G.find(x=>x.gIdx===cur);if(!g)return;const n=prompt('新名稱：',g.name);if(!n)return;g.name=n;sg(G);all();q(`RENAME_GROUP,${cur},${n}`)};
  $('#dg').onclick=()=>{const G=lg();if(G.length===1)return toast('至少需要保留一個群組');const g=G.find(x=>x.gIdx===cur);if(!g||!confirm(`確定刪除「${g.name}」及其所有按鈕？`))return;
    g.order.forEach(p=>localStorage.removeItem(K(cur,p)));const r=G.filter(x=>x.gIdx!==cur);sg(r);q('DELETE_GROUP,'+cur);cur=r[0].gIdx;all()};
  function grid(){const G=lg(),g=G.find(x=>x.gIdx===cur)||G[0];
    $('#gr').innerHTML=g.order.map(pos=>{const d=gd(cur,pos);return`<div class="irb ${d?'has':''}" data-p="${pos}"><small>Pos ${pos}</small><b>${d?(d.isState?'❄ ':'')+esc(d.name):'未設定'}</b>${edit?`<div class="ctl"><button class="btn sm" data-a="l">◀</button>${d?'<button class="btn sm" data-a="r">✏️</button>':''}<button class="btn sm" data-a="n">▶</button>${d?'<button class="btn sm dan" data-a="x">✕</button>':''}</div>`:''}</div>`}).join('')}
  $('#gr').onclick=async e=>{const t=e.target.closest('.irb');if(!t)return;const pos=+t.dataset.p,a=e.target.closest('[data-a]')?.dataset.a,d=gd(cur,pos);
    if(a==='r'){const n=prompt(`請輸入位置 ${pos} 的新名稱：`,d.name);if(n===null)return;const nd={...d,name:n.trim()||'按鈕 '+pos};sd(cur,pos,nd);wr(cur,pos,nd);grid()}
    else if(a==='x'){if(confirm(`確定要清除位置 ${pos} 的資料嗎？`)){localStorage.removeItem(K(cur,pos));q(`DELETE,${cur},${pos-1}`);grid()}}
    else if(a==='l'||a==='n'){const G=lg(),g=G.find(x=>x.gIdx===cur),o=g.order,i=o.indexOf(pos),j=i+(a==='l'?-1:1);if(j<0||j>=o.length)return;[o[i],o[j]]=[o[j],o[i]];sg(G);grid()}
    else if(!edit&&d){if(d.isState)toast('這是狀態型協定（如冷氣），目前只能由實體按鍵發射，網頁無法測試');else q(`SEND,${d.p},${d.h},${d.b}`)}};
  $('#ed').onclick=()=>{edit=!edit;$('#ed').textContent=edit?'完成排序':'排序模式';grid()};
  // IRDB
  const fill=(s,items,ph)=>{s.innerHTML='';s.add(new Option(ph,''));items.forEach(i=>s.add(new Option(i.l,i.v)));s.disabled=!items.length};
  const dirs=async p=>(await ls(p)).filter(d=>d.type==='dir').map(d=>({l:d.name,v:d.name}));
  setTimeout(async()=>{if(!alive)return;try{fill($('#b'),(await dirs('')).sort((a,b)=>a.l.localeCompare(b.l)),'選擇品牌');$('#b').disabled=false}catch(e){$('#b').innerHTML='<option>載入失敗，稍後重試</option>';slog('err','IRDB品牌清單載入失敗: '+e.message)}},800);
  const noas=()=>$('#as').disabled=true;
  $('#b').onchange=async e=>{fill($('#d'),[],'先選類型');fill($('#f'),[],'先選裝置');noas();if(!e.target.value)return fill($('#t'),[],'先選品牌');$('#t').innerHTML='<option>載入中…</option>';
    try{fill($('#t'),await dirs(e.target.value),'選擇裝置類型')}catch{$('#t').innerHTML='<option>載入失敗</option>'}};
  $('#t').onchange=async e=>{fill($('#f'),[],'先選裝置');noas();if(!e.target.value)return fill($('#d'),[],'先選類型');$('#d').innerHTML='<option>載入中…</option>';
    try{fill($('#d'),(await ls($('#b').value+'/'+e.target.value)).filter(f=>f.type==='file'&&f.name.endsWith('.csv')).map(f=>({l:f.name.replace('.csv','').replace(',',' / '),v:f.name})),'選擇裝置（device/subdevice）')}catch{$('#d').innerHTML='<option>載入失敗</option>'}};
  $('#d').onchange=async e=>{noas();$('#inf').textContent='選好功能鍵後，這裡會顯示可指定的協定資訊。';if(!e.target.value)return fill($('#f'),[],'先選裝置');$('#f').innerHTML='<option>載入中…</option>';
    try{const r=await fetch(`${CDN}/${encodeURIComponent($('#b').value)}/${encodeURIComponent($('#t').value)}/${encodeURIComponent(e.target.value)}`);
      fill($('#f'),(await r.text()).trim().split('\n').slice(1).map(l=>{const c=l.split(',');return{l:c[0],v:JSON.stringify({p:c[1],d:parseInt(c[2]),s:parseInt(c[3]),f:parseInt(c[4])})}}),'選擇功能鍵')}catch(x){$('#f').innerHTML='<option>載入失敗</option>';slog('err','IRDB檔案載入失敗: '+x.message)}};
  $('#f').onchange=e=>{const i=$('#inf'),a=$('#as');if(!e.target.value){i.textContent='選好功能鍵後，這裡會顯示可指定的協定資訊。';return noas()}
    const x=JSON.parse(e.target.value),c=convert(x.p,x.d,x.s,x.f),h=`原始協定：<b>${esc(x.p)}</b> device=${x.d} subdevice=${x.s} function=${x.f}<br>`;
    if(c){i.innerHTML=h+`換算結果：<b>${c.proto}</b> hex=<b>${c.hex}</b> bits=<b>${c.bits}</b>`;a.disabled=false;a.dataset.c=JSON.stringify(c)}
    else{i.innerHTML=h+'<span class="warnc">⚠️ 此協定目前網頁還無法自動換算，請改用「開始學習」。</span>';noas()}};
  $('#as').onclick=async()=>{const c=JSON.parse($('#as').dataset.c||'null');if(!c)return;const g=+$('#lg').value,pos=+$('#lp').value,name=$('#nm').value||$('#f').selectedOptions[0].textContent,d={name,p:c.proto,isState:0,h:c.hex,b:c.bits};
    sd(g,pos,d);await wr(g,pos,d);if(g===cur)grid();slog('sys',`📚 已從資料庫指定「${name}」到 群組${g+1}/位置${pos}`)};
  // 匯出入
  $('#ex').onclick=()=>{const G=lg(),buttons={};G.forEach(g=>g.order.forEach(p=>{const v=localStorage.getItem(K(g.gIdx,p));if(v)buttons['g'+g.gIdx+'_b'+p]=JSON.parse(v)}));
    const a=Object.assign(document.createElement('a'),{href:URL.createObjectURL(new Blob([JSON.stringify({groups:G,buttons},null,2)],{type:'application/json'})),download:'ir_hub_'+new Date().toISOString().slice(0,10)+'.json'});a.click();URL.revokeObjectURL(a.href);slog('sys','📤 設定已匯出')};
  $('#im').onclick=()=>$('#fi').click();
  $('#fi').onchange=e=>{const f=e.target.files[0];e.target.value='';if(!f)return;const r=new FileReader();r.onload=()=>{try{const j=JSON.parse(r.result);if(!Array.isArray(j.groups)||!j.buttons)throw Error('格式不符');
    if(!confirm(`匯入將覆蓋現有設定，共 ${j.groups.length} 個群組，確定繼續？`))return;Object.keys(localStorage).filter(k=>k.startsWith(NS)).forEach(k=>localStorage.removeItem(k));
    const G=j.groups.map((g,i)=>({gIdx:typeof g.gIdx==='number'?g.gIdx:i,name:g.name,order:g.order}));sg(G);
    Object.entries(j.buttons).forEach(([k,v])=>{const m=k.match(/^g(\d+)_b(\d+)$/);if(m)localStorage.setItem(K(+m[1],+m[2]),JSON.stringify(v))});cur=G[0].gIdx;all();
    slog('sys',`📥 匯入成功，共 ${G.length} 個群組（僅存於網頁本機，尚未寫回裝置，如需實體按鍵可用請逐一重新指定）`)}catch(x){toast('匯入失敗：'+x.message);slog('err','匯入失敗: '+x.message)}};r.readAsText(f)};
  // Serial 日誌
  $('#pa').onclick=()=>{paused=!paused;$('#pa').textContent=paused?'▶':'⏸';if(!paused)draw()};
  $('#cl').onclick=()=>{logs=[];draw()};
  $('#cp').onclick=()=>{const t=logs.map(e=>`[${e.ts}] ${e.d.toUpperCase()} ${e.m}`).join('\n');navigator.clipboard.writeText(t).then(()=>toast('已複製')).catch(()=>prompt('複製以下內容：',t))};
  const man=()=>{const v=$('#si').value.trim();if(v){$('#si').value='';q(v)}};$('#ss').onclick=man;$('#si').onkeydown=e=>{if(e.key==='Enter')man()};
  if(!localStorage.getItem(NS+'usb_tip_shown')){const n=document.createElement('div');n.className='note warn';n.innerHTML='💡 首次使用：請點「🔌 USB」選擇 ESP32 裝置，瀏覽器會記住，之後自動連線。 <button class="btn sm" style="float:right">知道了</button>';n.querySelector('button').onclick=()=>{n.remove();localStorage.setItem(NS+'usb_tip_shown','1')};root.prepend(n)}
  all();setTimeout(()=>alive&&auto(),500);
  return()=>{alive=false;stopI?.();removeEventListener('keydown',hk);link?.close()};
}};
