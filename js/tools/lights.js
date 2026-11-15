import {delay,write,remember,saved,hasBLE} from '../core/ble.js';
import {toast,esc,hms} from '../core/ui.js';
const SVC='4fa8691a-1360-4c8f-bd00-885481c3d1e1',BR='beb5483e-36e1-4688-b7f5-ea07361b26a8',GR='d2c88f1b-4890-4c70-98d0-836798e276f2';
const U={nl:{timer:'7b1a2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d',name:'8f2e910a-3a1b-4c2d-8e4f-1a2b3c4d5e6f',role:'3c9a1e2b-7d4f-4a8e-9b6c-2f1a0d8e5c3b'},
rg:{timer:'e324c30c-253c-48c9-94d7-0138cf38c1c3',name:'b2c3d4e5-6789-4a1b-8c2d-3e4f5a6b7c8d',role:'9d8c7b6a-5e4f-4a3b-8c2d-1e0f9a8b7c6d'}};
const MODES=['常亮','呼吸燈','彩虹流光','燭光閃爍','彗星追焦','星光閃爍','閃電','警車燈','煙火火花','柔和漸層呼吸','電視/壁爐光','心跳燈','彩虹彗星'];
const COL=[['暖黃',20,255,'#FF9800'],['紅',0,255,'#FF0000'],['白',0,0,'#FFFFFF'],['海藍',160,255,'#007AFF'],['紫',192,255,'#A000FF'],['綠',96,255,'#2ECC71'],['薄荷',130,255,'#1ABC9C'],['琥珀',10,255,'#FF5722'],['桃紅',224,255,'#FF4081'],['靛藍',170,255,'#3F51B5']];
const has=async(s,u)=>{try{await s.getCharacteristic(u);return true}catch{return false}};

const common=[
{h:'多燈配對流程',li:['按「新增燈具」，選擇器依<b>服務 UUID</b> 篩選，可重複新增多盞；同一盞不能重複加入。','每盞燈有獨立的「勾選」：<b>只有勾選的燈會收到亮度／模式／定時指令</b>。','換組別、改名都是逐盞操作，需要該盞燈目前已連線。']},
{h:'分組（第 1–8 組）',li:['組別存在燈具裡；同組燈靠 <b>ESP-NOW</b> 互相同步，網頁只需要連其中一盞就能帶動同組。','換組後網頁會重新計算兩個組別的「主控」徽章。']},
{h:'主燈 / 從燈 / 主控',li:['<b>主燈</b>（旋鈕那盞）與<b>從燈</b>由韌體回報；舊韌體沒有角色欄位時顯示「未知」。','同組只應有<b>一盞主燈</b>；偵測到多盞會出現警示，否則從燈會被多台主燈搶著控制、亮度忽明忽暗。','<b>主控</b> = 該組畫面顯示的依據：有主燈用主燈；沒有主燈則取最先連線的；每次連線／斷線／換組都會重算。','只有主控的通知會更新畫面；而且<b>所有已連線的燈同組時</b>才會讓共用控制項跟著變，多組同時連線時控制項只當「要送出的值」。','網頁只顯示旋鈕調光，不再轉發給其他燈（避免和 ESP-NOW 互搶）。']},
{h:'改名',li:['名稱上限 <b>20 bytes（UTF-8）</b>，中文每字 3 bytes，約 6 個中文字。','寫入後燈具約 0.5 秒重啟並斷線，請重新「新增燈具」。']}];

function make(c){return{
id:c.id,cat:'燈光',icon:c.icon,name:c.name,sub:c.sub,tags:['BLE','多裝置'],
guide:[{h:'兩種 N-Light 的辨識',li:[`<b>N-Light 小夜燈</b>與<b>N-Light RGB 氛圍燈</b>使用相同的服務 UUID，所以兩邊的選擇器會列出同一批燈。`,`連線時工具會檢查「定時特徵值」：如果選到的是${c.otherName}，會直接提示改用該工具。`]},...common,...c.extra],
mount(root){
  const X=U[c.k],O=U[c.o];let devs=[],seq=0,prim={},busy=false,pend=null,alive=true;
  const st={on:true,bright:76,mode:0,hue:20,sat:255,speed:50},T={1:0,2:0};
  const blk=(ty,t,h,m,q)=>`<div class="card"><h3>${t}</h3><div class="row c"><input type="number" id="h${ty}" min="0" max="24" value="${h}">時<input type="number" id="m${ty}" min="0" max="59" value="${m}">分</div>
   <div class="row"><button class="btn pri" data-t="go" data-y="${ty}">啟動</button><button class="btn dan" data-t="no" data-y="${ty}">取消</button></div><div class="cd" id="cd${ty}" hidden></div>
   <div class="row">${q.map(([l,mn])=>`<button class="btn" data-t="q" data-y="${ty}" data-m="${mn}">${l}</button>`).join('')}</div></div>`;
  root.innerHTML=`${hasBLE?'':'<div class="note warn">此瀏覽器不支援 Web Bluetooth</div>'}
  <div class="card"><div class="row"><button class="btn pri" id="add">＋ 新增燈具</button><button class="btn" id="re">重連已記住的燈</button></div><div id="list" class="mt"></div></div>
  <div class="card"><button class="btn pwr wide" id="pwr" style="width:100%"></button>
   <label class="f" style="margin-top:12px"><span>亮度</span><b><span id="bv"></span>%</b></label><input type="range" id="br" min="0" max="255">
   <div class="row">${[10,30,60,100].map(p=>`<button class="btn" data-q="${p}">${p}%</button>`).join('')}</div>
   ${c.rgb?`<label class="f" style="margin-top:12px"><span>模式</span></label><select id="md" style="width:100%">${MODES.map((n,i)=>`<option value="${i}">${n}</option>`).join('')}</select>
   <label class="f" style="margin-top:12px"><span>速度</span><b><span id="sv"></span>%</b></label><input type="range" id="sp" min="1" max="100">
   <label class="f"><span>色相</span><i class="dotc" id="dot"></i></label><input type="range" id="hue" min="0" max="255">
   <div class="sw">${COL.map(([n,h,s,hex],i)=>`<button title="${n}" data-c="${i}" style="background:${hex}"></button>`).join('')}</div>`:''}</div>
  ${blk(1,'⏱️ 倒數關燈',0,30,[['15 分',15],['30 分',30]])}${c.alarm?blk(2,'⏰ 光線鬧鐘（30 秒內漸亮到 100%）',8,0,[['測試 30 秒後',0.5],['8 小時',480]]):''}`;
  const $=s=>root.querySelector(s);
  const pct=v=>Math.round((c.rgb?v.getUint8(1):v.getUint8(0))/255*100)+'%';
  function paint(keep){
    $('#pwr').textContent=st.on?'⚡ 開燈中':'🌙 已關燈';$('#pwr').classList.toggle('off',!st.on);$('#bv').textContent=Math.round(st.bright/255*100);
    if(!keep)$('#br').value=st.bright;
    if(c.rgb){$('#md').value=st.mode;$('#sp').value=st.speed;$('#sv').textContent=st.speed;$('#hue').value=st.hue;$('#hue').disabled=st.mode===2;
      $('#dot').style.background=st.sat?`hsl(${st.hue/255*360|0} 100% 50%)`:'#fff'}
  }
  const payload=()=>c.rgb?Uint8Array.of(st.mode,st.bright,st.hue,st.sat,st.speed,st.on?1:0):Uint8Array.of(st.on?st.bright:0);
  const tg=()=>devs.filter(d=>d.sel);
  async function push(){pend=payload();if(busy)return;busy=true;
    try{while(pend){const p=pend;pend=null;for(const d of tg())try{await write(d.bc,p)}catch(e){console.warn(d.name,e)}}}finally{busy=false}}
  function apply(v){
    if(c.rgb){if(v.byteLength<3)return;st.mode=v.getUint8(0);st.bright=v.getUint8(1);st.hue=v.getUint8(2);
      if(v.byteLength>3)st.sat=v.getUint8(3);if(v.byteLength>4)st.speed=v.getUint8(4);if(v.byteLength>5)st.on=v.getUint8(5)===1}
    else{const b=v.getUint8(0);st.on=b>0;if(b>0)st.bright=b}
  }
  function recompute(g){const m=devs.filter(d=>d.group===g);if(!m.length){delete prim[g];return}
    const ms=m.filter(d=>d.role==='master');prim[g]=(ms.length?ms:m).sort((a,b)=>a.seq-b.seq)[0].id}
  function render(){
    if(!alive)return;const L=$('#list');
    if(!devs.length){L.innerHTML='<div class="empty">尚無連線裝置</div>';return}
    const cnt={};devs.forEach(d=>d.role==='master'&&(cnt[d.group]=(cnt[d.group]||0)+1));
    const w=Object.keys(cnt).filter(g=>cnt[g]>1);
    L.innerHTML=(w.length?`<div class="note warn">⚠️ 第 ${w.join('、')} 組同時有多台主燈，請只保留一台。</div>`:'')+devs.map((d,i)=>{
      const r=d.role==='master'?'<span class="badge m">主燈</span>':d.role==='slave'?'<span class="badge s">從燈</span>':'<span class="badge u">未知</span>';
      return`<div class="dev"><label><input type="checkbox" data-a="sel" data-i="${i}" ${d.sel?'checked':''}><b>${esc(d.name)}</b>${r}${prim[d.group]===d.id?'<span class="badge p">主控</span>':''}</label>
      <div class="row"><select data-a="grp" data-i="${i}">${[1,2,3,4,5,6,7,8].map(g=>`<option value="${g}" ${d.group===g?'selected':''}>第 ${g} 組</option>`).join('')}</select><span class="val" id="v${i}">${d.val||'-'}</span><button class="btn sm" data-a="ren" data-i="${i}">改名</button></div></div>`}).join('');
  }
  async function open(dev,silent){
    if(devs.some(d=>d.id===dev.id))return silent||toast('此燈已在清單中');
    try{
      const srv=await dev.gatt.connect();await delay(300);const svc=await srv.getPrimaryService(SVC);
      if(!await has(svc,X.timer))throw new Error(await has(svc,O.timer)?`這是「${c.otherName}」，請改用該工具`:'韌體版本不符（缺少定時特徵值）');
      const bc=await svc.getCharacteristic(BR),tc=await svc.getCharacteristic(X.timer),gc=await svc.getCharacteristic(GR);
      let nc=null,role=null,group=1;
      try{nc=await svc.getCharacteristic(X.name)}catch{}
      try{role=(await(await svc.getCharacteristic(X.role)).readValue()).getUint8(0)===1?'master':'slave'}catch{}
      try{group=(await gc.readValue()).getUint8(0)||1}catch{}
      const d={id:dev.id,dev,name:dev.name||`燈 #${devs.length+1}`,bc,tc,gc,nc,group,role,seq:seq++,sel:true,val:''};
      await bc.startNotifications();
      bc.addEventListener('characteristicvaluechanged',e=>{const v=e.target.value;d.val=pct(v);const el=$('#v'+devs.indexOf(d));if(el)el.textContent=d.val;
        if(prim[d.group]!==d.id)return;if(new Set(devs.map(x=>x.group)).size===1){apply(v);paint()}});
      dev.addEventListener('gattserverdisconnected',()=>{devs=devs.filter(x=>x.id!==d.id);recompute(d.group);render()});
      devs.push(d);recompute(group);remember(c.id,dev.id);render();
      try{const v=await bc.readValue();d.val=pct(v);apply(v);paint();render()}catch{}
    }catch(e){try{dev.gatt.disconnect()}catch{}if(!silent)toast('連線失敗：'+e.message)}
  }
  async function setGroup(d,g){const old=d.group;
    try{if(c.verify){await d.gc.writeValue(Uint8Array.of(g));d.group=(await d.gc.readValue()).getUint8(0);if(d.group!==g)toast(`組別未生效：裝置仍為第 ${d.group} 組`)}
      else{await write(d.gc,Uint8Array.of(g));d.group=g}}catch(e){toast('組別設定失敗：'+e.message)}
    recompute(old);recompute(d.group);render()}
  async function rename(d){
    if(!d.nc)return toast('此韌體沒有改名功能');
    const n=(prompt('新的藍牙名稱（上限 20 bytes，約 6 個中文字）',d.name)||'').trim();if(!n)return;
    const b=new TextEncoder().encode(n);if(b.length>20)return toast(`名稱過長：${b.length} bytes（上限 20）`);
    try{await d.nc.writeValue(b);toast('已寫入，燈具約 0.5 秒後重啟並斷線，請重新新增')}catch(e){toast('改名失敗：'+e.message)}}
  async function sendT(ty,sec){
    if(!devs.length)return toast('請先連線至少一盞燈');
    const p=Uint8Array.of(ty,sec&255,sec>>8&255,sec>>16&255,sec>>>24);
    for(const d of tg())try{await write(d.tc,p)}catch(e){console.warn(e)}
    T[ty]=sec;const cd=$('#cd'+ty);cd.hidden=!sec;cd.textContent=hms(sec);
  }
  $('#add').onclick=async()=>{try{await open(await navigator.bluetooth.requestDevice({filters:[{services:[SVC]}]}))}catch(e){if(e.name!=='NotFoundError')toast(e.message)}};
  const auto=async()=>{for(const d of await saved(c.id))if(alive)await open(d,true)};
  $('#re').onclick=auto;
  const L=$('#list');
  L.onchange=e=>{const t=e.target,d=devs[+t.dataset.i];if(!d)return;if(t.dataset.a==='sel')d.sel=t.checked;if(t.dataset.a==='grp')setGroup(d,+t.value)};
  L.onclick=e=>{const t=e.target.closest('[data-a=ren]');if(t)rename(devs[+t.dataset.i])};
  $('#pwr').onclick=()=>{st.on=!st.on;if(!c.rgb&&st.on&&!st.bright)st.bright=76;paint();push()};
  $('#br').oninput=e=>{const v=+e.target.value;if(c.rgb)st.bright=v;else{st.on=v>0;if(v>0)st.bright=v}paint(true);push()};
  root.onclick=e=>{
    const q=e.target.closest('[data-q]');if(q){st.bright=Math.round(q.dataset.q*2.55);st.on=true;paint();push();return}
    const cl=e.target.closest('[data-c]');if(cl){const[,h,s]=COL[+cl.dataset.c];st.hue=h;st.sat=s;paint();push();return}
    const t=e.target.closest('[data-t]');if(!t)return;const y=+t.dataset.y;
    if(t.dataset.t==='no')return sendT(y,0);
    if(t.dataset.t==='q')return sendT(y,Math.round(t.dataset.m*60));
    const s=(+$('#h'+y).value||0)*3600+(+$('#m'+y).value||0)*60;s>0?sendT(y,s):toast('請設定大於 0 的時間');
  };
  if(c.rgb){$('#md').onchange=e=>{st.mode=+e.target.value;paint();push()};
    $('#sp').oninput=e=>{st.speed=+e.target.value;paint();push()};$('#hue').oninput=e=>{st.hue=+e.target.value;st.sat=255;paint();push()}}
  const iv=setInterval(()=>{for(const y of[1,2]){if(T[y]>0){T[y]--;const cd=$('#cd'+y);if(cd){cd.textContent=hms(T[y]);cd.hidden=!T[y]}}}},1000);
  paint();render();auto();
  return()=>{alive=false;clearInterval(iv);devs.forEach(d=>{try{d.dev.gatt.disconnect()}catch{}})};
}}}

export const nlight=make({id:'nlight',k:'nl',o:'rg',icon:'🌙',name:'N-Light 小夜燈',sub:'亮度同步、分組、倒數與光線鬧鐘',otherName:'N-Light RGB 氛圍燈',verify:true,alarm:true,rgb:false,
 extra:[{h:'N-Light 專屬',li:['亮度為單一 byte（0–255，0 = 關燈）；旋鈕調光會由主燈通知回網頁。','組別寫入採「有回應寫入 + 讀回確認」，沒生效會提示。','光線鬧鐘的時間是「從現在起算的時長」，到點後 30 秒內漸亮到 100%。']}]});
export const rgb=make({id:'nlight-rgb',k:'rg',o:'nl',icon:'🌈',name:'N-Light RGB 氛圍燈',sub:'13 種動態模式、色相、速度',otherName:'N-Light 小夜燈',verify:false,alarm:false,rgb:true,
 extra:[{h:'RGB 專屬',li:['控制資料為 6 bytes：<code>模式、亮度、色相、飽和度、速度、開關</code>，每次調整整包送出。','「彩虹流光」模式會停用色相；點「白」會把飽和度設為 0。','組別寫入為「無回應寫入」，沒有讀回確認。','舊版「改名」會把同一個名稱一次寫給所有勾選的燈；新版改為<b>逐盞改名</b>，避免多盞同名。']}]});
