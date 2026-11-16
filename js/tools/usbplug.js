import {delay,remember,saved,hasBLE} from '../core/ble.js';
import {toast,esc} from '../core/ui.js';
const SVC='69bb3531-4255-4acc-9667-6c066b29bc74',CH='e4f32c31-b8e4-4a9b-b329-8bb20ad32bd4',p2=n=>String(n).padStart(2,'0');
const sel=(id,n,f)=>`<select id="${id}">${Array.from({length:n},(_,i)=>`<option value="${i+1}">${f(i+1)}</option>`).join('')}</select>`;
const tm=(id,v)=>`<input type="time" id="${id}" value="${v}">`;
const WD=['週日','週一','週二','週三','週四','週五','週六'];
export default{
id:'usbplug',icon:'🔌',name:'智慧 USB 插座',sub:'插座排程、PIN、遙控器群組',tags:['BLE','PIN'],
guide:[
{h:'怎麼配對（瀏覽器 ↔ 裝置）',li:['BLE 選擇器依服務 UUID <code>69bb3531-…</code> 篩選；<b>插座與遙控器共用同一服務</b>，連上後由韌體回傳 <code>PLUG_INFO</code> 或 <code>REMOTE_INFO</code>，頁面自動顯示插座或遙控器面板。','連線後先送 <code>CHECK_AUTH</code>：回 <code>AUTH:NONE</code> 直接進入；回 <code>AUTH:REQUIRED</code> 需輸入 <b>4–10 位數字 PIN</b>。','驗證通過後自動把瀏覽器時間寫入裝置並讀取狀態。','成功連過的裝置會被記住，下次開啟自動重連。']},
{h:'插座 ↔ 遙控器 配對規則',li:['<b>遙控器</b>只需設定自己屬於「遙控器 1–10（Group）」。','<b>插座</b>要設定兩項：「對應遙控器」（Group 1–10）與「對應組別號碼」（第 1–4 組）。','設定成功的提示為：現在由 [遙控器 N] 的 [第 M 組] 控制。兩邊的 Group 要一致才會對上。']},
{h:'排程與日期規則',li:['平日排程 = 週一至週五＋補班日；假日排程 = 週六日＋放假日。','特殊日期（放假／補班）需按「儲存日期變更至裝置」才會寫入；清單只列未來 180 天內的自訂日期。','Wi-Fi 僅用於每日定時 NTP 對時；上電預設可選 關 / 開 / 恢復斷電前狀態。']},
{h:'名稱與 PIN',li:['改名上限 20 bytes（約 6 個中文字），送出後插座重啟，需重新連線。','PIN 為 4–10 位純數字；可隨時停用。']}],
mount(root){
  let dev=null,ch=null,authed=false,alive=true,base=null,t0=0,days=[];
  const S={wdEn:false,wd:['01','00','03','00'],weEn:false,we:['06','00','09','00']};
  const row=(l,x)=>`<label class="f" style="margin-top:10px"><span>${l}</span></label>${x}`;
  root.innerHTML=`${hasBLE?'':'<div class="note warn">此瀏覽器不支援 Web Bluetooth</div>'}
  <div class="card"><button class="btn pri" id="c" style="width:100%">🔗 搜尋並連線裝置</button><div class="status"><i class="dot" id="dot"></i><span id="st">未連線</span></div>
  <div id="pa" hidden><div class="row"><input type="password" id="pin" placeholder="4~10 位數字 PIN" maxlength="10" inputmode="numeric" style="flex:1"><button class="btn sm pri" id="pg">驗證</button></div></div></div>
  <div id="pl" hidden>
   <div class="card"><h3>插座狀態與控制</h3><div class="hero" style="padding:0"><div class="big" id="ps">狀態：未知</div></div><div class="row"><button class="btn pwr" data-c="ON">⚡ 開啟</button><button class="btn dan" data-c="OFF">🔌 關閉</button></div></div>
   <div class="card"><h3>📋 目前生效的排程</h3><div id="sl"></div></div>
   <div class="card"><h3>⏰ 裝置狀態</h3><div class="sub" id="rt">裝置時間：未取得</div><div class="sub" id="gn">對應遙控：未讀取</div><div class="sub" id="pn">PIN 保護：未知</div>
    <div class="row"><button class="btn" data-c="GET_INFO">🔄 讀取狀態</button><button class="btn" id="sy">🕒 快速對時</button></div></div>
   <div class="card"><h3>⚙️ 設定排程</h3>
    <div class="note">📅 平日（週一～五＋補班日）</div><div class="row">${tm('wdOn','01:00')}<span>開 →</span>${tm('wdOff','03:00')}<span>關</span></div><div class="row"><button class="btn pri" data-s="wd">💾 儲存平日排程</button></div>
    <div class="note" style="margin-top:14px">🎉 假日（週六日＋放假日）</div><div class="row">${tm('weOn','06:00')}<span>開 →</span>${tm('weOff','09:00')}<span>關</span></div><div class="row"><button class="btn pri" data-s="we">💾 儲存假日排程</button></div></div>
   <div class="card"><h3>📅 補班 / 放假日</h3><div class="sub">放假套用「假日排程」；補班套用「平日排程」。</div>
    <div class="row"><input type="date" id="dd" style="flex:1"><select id="dt"><option value="H">🎉 放假日</option><option value="W">💼 補班日</option></select><button class="btn sm" id="da">新增</button></div>
    <div id="dg" style="margin-top:10px"></div><div class="row"><button class="btn pri" id="ds">💾 儲存日期變更至裝置</button></div>
    <h3 style="margin-top:16px">🗓️ 未來 180 天清單</h3><div id="d180"></div></div>
   <div class="card"><h3>🌐 Wi-Fi 與自動對時</h3>${row('Wi-Fi 名稱 (SSID)','<input type="text" id="ss" style="width:100%">')}${row('Wi-Fi 密碼（無密碼留空）','<input type="password" id="wp" style="width:100%">')}${row('每日自動對時','<div class="row">'+tm('nt','23:30')+'</div>')}
    <div class="row"><button class="btn pri" id="ws">💾 儲存</button><button class="btn dan" id="wc">🗑️ 清除</button></div><div class="sub" style="margin-top:6px">設定 Wi-Fi 後，插座會在每日指定時間連網做 NTP 對時。</div></div>
   <div class="card"><h3>🔌 上電預設狀態</h3><div class="row"><select id="po" style="flex:1"><option value="0">預設關閉 (OFF)</option><option value="1">預設開啟 (ON)</option><option value="2">恢復斷電前狀態</option></select><button class="btn sm pri" id="pp">儲存</button></div></div>
   <div class="card"><h3>🏷️ 修改 BLE 名稱</h3><div class="row"><input type="text" id="nm" maxlength="20" placeholder="例：智慧插座-01"><button class="btn sm pri" id="ns">儲存並重啟</button></div><div class="sub" style="margin-top:6px">上限 20 Bytes（約 6 個中文字）。</div></div>
   <div class="card"><h3>🎮 控制權（遙控群組與組別）</h3>${row('對應遙控器',sel('pg2',10,i=>`遙控器 ${i} (Group ${i})`))}${row('對應組別號碼',sel('nd',4,i=>`第 ${i} 組`))}<div class="row"><button class="btn pri" id="gs">💾 儲存配對設定</button></div></div>
   <div class="card"><h3>🔑 PIN 保護</h3><div class="row"><input type="password" id="np" placeholder="4~10 位數字 PIN" maxlength="10" inputmode="numeric" style="flex:1"><button class="btn sm pri" id="nps">啟用</button><button class="btn sm" id="npd">停用</button></div></div></div>
  <div id="rm" hidden><div class="card"><h3>🎮 遙控器群組設定</h3><div class="hero" style="padding:0"><div class="big" id="rg" style="font-size:1.2rem">目前設定：未讀取</div></div>${row('此遙控器所屬群組',sel('rg2',10,i=>`遙控器 ${i} (Group ${i})`))}<div class="row"><button class="btn pri" id="rs">💾 寫入群組設定</button></div></div></div>`;
  const $=s=>root.querySelector(s),$$=s=>root.querySelectorAll(s);
  const st=(t,k)=>{$('#st').textContent=t;$('#dot').className='dot'+(k?' '+k:'')};
  const hide=()=>{['#pa','#pl','#rm'].forEach(s=>$(s).hidden=true)};
  const raw=async c=>{if(!dev?.gatt.connected||!ch){toast('藍牙未連線');return false}try{await ch.writeValue(new TextEncoder().encode(c));return true}catch(e){toast('指令發送失敗：'+e.message);return false}};
  const cmd=async(c,ok)=>{if(!authed){toast('尚未完成連線驗證');return false}const r=await raw(c);if(r&&ok)toast(ok);return r};
  const sorted=()=>days.sort((a,b)=>a.d.localeCompare(b.d));
  async function open(d){hide();authed=false;dev=d;st('連線中…','');
    d.addEventListener('gattserverdisconnected',()=>{if(!alive)return;hide();ch=null;authed=false;clearBase();st('已斷開連線','err')});
    const s=await d.gatt.connect();await delay(300);const sv=await s.getPrimaryService(SVC);ch=await sv.getCharacteristic(CH);
    await ch.startNotifications();ch.addEventListener('characteristicvaluechanged',e=>msg(new TextDecoder().decode(e.target.value)));
    remember('usbplug',d.id);st('已連線，確認中…','');await raw('CHECK_AUTH')}
  $('#c').onclick=async()=>{try{await open(await navigator.bluetooth.requestDevice({filters:[{services:[SVC]}]}))}catch(e){st('失敗：'+e.message,'err');ch=null}};
  $('#pg').onclick=()=>{const p=$('#pin').value.trim();/^\d{4,10}$/.test(p)?raw('AUTH:'+p):toast('請輸入 4~10 位純數字 PIN')};
  async function ready(){authed=true;$('#pa').hidden=true;st('已連線：'+(dev.name||'未命名裝置'),'on');await cmd('SET_TIME:'+(Date.now()/1000|0));await delay(300);await cmd('GET_INFO');await delay(200);await cmd('GET_STATUS')}
  function clearBase(){base=null}
  function tick(){if(!base)return;const c=new Date(base.getTime()+Date.now()-t0);$('#rt').textContent=`裝置時間：${c.getFullYear()}-${p2(c.getMonth()+1)}-${p2(c.getDate())} ${p2(c.getHours())}:${p2(c.getMinutes())}:${p2(c.getSeconds())}`}
  const iv=setInterval(tick,1000);
  function msg(m){
    if(m==='AUTH:NONE'||m==='AUTH:OK')return ready();
    if(m==='AUTH:REQUIRED'){st('已連線，需要輸入 PIN','');$('#pa').hidden=false;return}
    if(m==='AUTH:FAIL')return toast('PIN 碼錯誤！');
    if(m.startsWith('REMOTE_INFO:')){const g=m.slice(12);$('#rm').hidden=false;$('#rg').textContent=`目前設定：遙控器 ${g} (Group ${g})`;$('#rg2').value=g;st('已連線：'+(dev.name||'未命名裝置'),'on')}
    else if(m.startsWith('PLUG_INFO:')){$('#pl').hidden=false;const d=m.slice(10).split(','),g=(i,f)=>d[i]!==undefined&&d[i]!==''?d[i]:f,P=(i,f)=>g(i,f).padStart(2,'0');
      S.wdEn=d[1]==='1';S.wd=[P(2,'01'),P(3,'00'),P(4,'03'),P(5,'00')];S.weEn=d[6]==='1';S.we=[P(7,'06'),P(8,'00'),P(9,'09'),P(10,'00')];
      let ssid='';try{ssid=d[14]?decodeURIComponent(d[14]):''}catch{ssid=d[14]||''}
      days=[];(d[18]||'').split(';').forEach(x=>{if(/^[HW]:/.test(x))days.push({t:x[0],d:x.slice(2)})});
      if(d[0]){const q=d[0].split(' ');if(q.length>1){const a=q[0].split('-').map(Number),b=q[1].split(':').map(Number);base=new Date(a[0],a[1]-1,a[2],b[0],b[1],b[2]);t0=Date.now();tick()}}
      $('#gn').textContent=`對應遙控：遙控器 ${g(12,1)} - 第 ${g(13,1)} 組`;$('#pn').textContent='PIN 保護：'+(+g(11,0)?'已啟用':'未啟用（免密碼連線）');
      $('#pg2').value=g(12,1);$('#nd').value=g(13,1);$('#ss').value=ssid;$('#nt').value=`${P(15,'23')}:${P(16,'30')}`;$('#po').value=g(17,0);
      $('#wdOn').value=S.wd[0]+':'+S.wd[1];$('#wdOff').value=S.wd[2]+':'+S.wd[3];$('#weOn').value=S.we[0]+':'+S.we[1];$('#weOff').value=S.we[2]+':'+S.we[3];
      sched();tags();d180()}
    else if(m==='STATUS:1'||m==='STATUS:0'){const on=m==='STATUS:1';$('#ps').textContent=on?'🟢 已開啟':'🔴 已關閉';$('#ps').className='big '+(on?'okc':'errc')}
  }
  function sched(){const b=$('#sl'),it=(i,l,a,t)=>`<div class="row"><span style="flex:1">${i} <b>${l}：</b>${a[0]}:${a[1]} 開 - ${a[2]}:${a[3]} 關</span><button class="btn sm dan" data-del="${t}">刪除</button></div>`;
    b.innerHTML=(S.wdEn?it('📅','平日',S.wd,'wd'):'')+(S.weEn?it('🎉','假日',S.we,'we'):'')||'<div class="empty">目前未設定任何自動排程</div>'}
  async function pushS(){const n=a=>a.map(x=>parseInt(x)).join(',');if(await cmd(`SET_TIMER:${S.wdEn?1:0},${n(S.wd)},${S.weEn?1:0},${n(S.we)}`,'排程已更新'))sched()}
  function tags(){$('#dg').innerHTML=days.length?days.map(x=>`<span class="chip ${x.t==='H'?'warn':'ok'}" style="margin:2px;display:inline-block">${x.d} [${x.t==='H'?'放假':'補班'}] <b data-rm="${x.d}" style="cursor:pointer"> ✕</b></span>`).join(''):'<span class="sub">無設定自訂放假/補班日</span>'}
  function d180(){const g={},n=Date.now();for(let i=0;i<180;i++){const t=new Date(n+i*864e5),ds=`${t.getFullYear()}-${p2(t.getMonth()+1)}-${p2(t.getDate())}`,f=days.find(x=>x.d===ds);if(f)(g[`${t.getFullYear()}年 ${p2(t.getMonth()+1)}月`]??=[]).push(`<div class="lr row" style="margin:0"><span style="flex:1">${ds} (${WD[t.getDay()]})</span><b class="${f.t==='H'?'warnc':'okc'}">${f.t==='H'?'🎉 自訂放假':'💼 補上班日'}</b></div>`)}
    $('#d180').innerHTML=Object.keys(g).length?Object.entries(g).map(([k,v])=>`<div class="sub" style="margin-top:8px"><b>${k}</b></div>${v.join('')}`).join(''):'<div class="empty">未來 180 天內無自訂放假或補班日</div>'}
  root.onclick=e=>{const b=e.target.closest('button');if(!b)return;
    if(b.dataset.c)cmd(b.dataset.c);
    if(b.dataset.s){const k=b.dataset.s,v=id=>$('#'+k+id).value.split(':');S[k]=[...v('On'),...v('Off')];S[k+'En']=true;pushS()}
    if(b.dataset.del){S[b.dataset.del+'En']=false;pushS()}
    if(b.dataset.rm){days=days.filter(x=>x.d!==b.dataset.rm);tags();d180()}};
  $('#sy').onclick=()=>cmd('SET_TIME:'+(Date.now()/1000|0),'對時指令已送出');
  $('#da').onclick=()=>{const d=$('#dd').value;if(!d)return toast('請選擇日期');const f=days.find(x=>x.d===d);f?f.t=$('#dt').value:days.push({t:$('#dt').value,d});sorted();tags();d180()};
  $('#ds').onclick=()=>cmd('SET_HOLIDAYS:'+days.map(x=>`${x.t}:${x.d}`).join(';'),'自訂放假/補班日已寫入裝置');
  $('#ws').onclick=()=>{const s=$('#ss').value;if(!s)return toast('請輸入 Wi-Fi 名稱');const[h,m]=$('#nt').value.split(':').map(Number);cmd(`SET_WIFI:${encodeURIComponent(s)},${encodeURIComponent($('#wp').value)},${h},${m}`,'Wi-Fi 與對時設定已儲存')};
  $('#wc').onclick=()=>{if(confirm('確定要清除插座內的 Wi-Fi 與 NTP 自動對時設定嗎？')){$('#ss').value=$('#wp').value='';cmd('SET_WIFI:,,23,30','已送出清除指令')}};
  $('#pp').onclick=()=>cmd('SET_POWERON:'+$('#po').value,'上電預設狀態已儲存');
  $('#ns').onclick=()=>{const n=$('#nm').value.trim();if(!n)return toast('請輸入新的裝置名稱');const b=new TextEncoder().encode(n).length;if(b>20)return toast(`名稱過長：${b} Bytes（上限 20）`);
    if(confirm(`確定要將插座名稱改為「${n}」嗎？送出後插座會自動重啟！`))cmd('SET_NAME:'+n,'已送出，插座重啟中，請重新連線')};
  $('#gs').onclick=()=>{const g=$('#pg2').value,n=$('#nd').value;cmd(`SET_GROUP_NODE:${g},${n}`,`已更新：現在由 [遙控器 ${g}] 的 [第 ${n} 組] 控制`)};
  $('#rs').onclick=async()=>{const g=$('#rg2').value;if(await raw('SET_REMOTE_GROUP:'+g))toast(`已將遙控器設定為 [遙控器 ${g}]`)};
  $('#nps').onclick=async()=>{const p=$('#np').value.trim();if(!/^\d{4,10}$/.test(p))return toast('PIN 長度需為 4~10 位純數字');if(await cmd('SET_PIN:'+p,'PIN 保護已啟用'))$('#np').value=''};
  $('#npd').onclick=()=>cmd('DISABLE_PIN','PIN 保護已停用');
  $('#dd').value=new Date().toISOString().slice(0,10);sched();tags();d180();
  saved('usbplug').then(l=>l[0]&&alive&&open(l[0]).catch(()=>st('自動重連失敗，請手動連線','')));
  return()=>{alive=false;clearInterval(iv);try{dev?.gatt.disconnect()}catch{}};
}};
