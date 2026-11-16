import {Link} from '../core/link.js';
import {delay} from '../core/ble.js';
import {esc} from '../core/ui.js';
const SVC='4fafc201-1fb5-459e-8fcc-c5c9c331914b',CH='beb5483e-36e1-4688-b7f5-ea07361b26a8',NAME='PWR_SENSOR',PAGE=50,UK='tb.mail.usb';
export default{
id:'mailbox',icon:'📬',name:'信箱巡邏',sub:'信箱 Hub：狀態、歷史、推播日誌',tags:['USB','BLE','自動連線'],
guide:[
{h:'連線方式',li:['<b>USB</b>：Web Serial，115200 baud。首次按「USB 連線」授權；之後開啟或重新插上會自動接回，並記住該裝置的 VID/PID，不會誤開其他序列埠。','<b>藍牙</b>：名稱必須是 <code>PWR_SENSOR</code>，服務 <code>4fafc201-…</code>。','自動連線順序：已授權的 <b>USB 優先</b>，其次藍牙。']},
{h:'配對與重連規則',li:['第一次一定要手動按連線鈕讓瀏覽器取得授權，之後才能自動連線。','Hub 只在按下按鈕、OLED 亮起時才廣播藍牙：<b>開頁面後按一下 Hub 按鈕</b>即可連上；連線最長 5 分鐘會被 Hub 切斷，頁面會自動等下一次廣播。','瀏覽器支援 <code>watchAdvertisements</code> 時等廣播再連；不支援時改為每 3 秒直接嘗試連線。','<b>手動按「斷線」會取消自動重連。</b>','與 IR Hub 共用同一組服務／特徵 UUID，靠<b>裝置名稱</b>區分。']},
{h:'讀數說明',li:['電池為 LiFePO4，電壓無法線性對應電量：≥3.20 V 正常、3.00–3.20 V 偏低、&lt;3.00 V 請充電。','資訊最多延遲 1 小時；「收到通知」時間優先使用 Hub 隨訊息送出的量測時間。','歷史與推播日誌存在 Hub 的 flash，重新連線後仍查得到。']}],
mount(root){
  root.innerHTML=`<div class="card"><div class="row wrap"><button class="btn" id="usb">🔌 USB</button><button class="btn pri" id="bt">🔹 藍牙</button><button class="btn dan" id="off">斷線</button></div><div class="status"><i class="dot" id="dot"></i><span id="cs">未連線</span></div></div>
  <div class="card hero" id="hero"><div class="big" id="ms">等待連線…</div><div class="kv">距離 <b id="dist">--</b> mm ・ 電池 <b id="volt">--</b> V <span class="chip" id="vs"></span></div>
  <div class="sub" id="ts"></div><div class="sub warnc" id="dl" hidden>⚠️ 資訊最多延遲 1 小時</div><div class="sub" id="nm" hidden></div>
  <div class="note" style="margin-top:12px">電池為 LiFePO4，電壓無法線性反映電量：<b class="okc">≥3.20V 正常</b>、<b class="warnc">3.00–3.20V 偏低</b>、<b class="errc">&lt;3.00V 請充電</b></div>
  <div class="row"><button class="btn" id="cal">重新校準基準距離</button><button class="btn" id="ntp" disabled>🕐 同步 Hub 時間</button></div></div>
  <div class="card"><div class="row"><div class="seg"><button data-tab="mail">📬 有信</button><button data-tab="all" class="on">全部</button></div><button class="btn sm" id="hl" disabled>載入歷史</button></div>
  <canvas id="cv" height="120" style="width:100%;margin-top:10px"></canvas><div class="sub" style="text-align:center">電壓趨勢（最近 50 筆，紅點＝有信）</div><div class="sub" id="hs" hidden></div>
  <div class="scroll"><table class="tbl"><thead><tr><th>時間</th><th>狀態</th><th>電壓</th><th>距離</th></tr></thead><tbody id="hb"></tbody></table></div>
  <div class="row c"><button class="btn sm" id="pv" disabled>◀</button><span class="sub" id="pi">--</span><button class="btn sm" id="nx" disabled>▶</button></div></div>
  <div class="card"><div class="row"><h3 style="margin:0;flex:1">📮 推播通知日誌</h3><button class="btn sm" id="nl" disabled>載入</button></div><div class="sub" id="ns" hidden></div><div id="nb"></div></div>
  <div class="card"><div class="row"><h3 style="margin:0;flex:1">事件日誌 <span class="sub" id="lc">0/100</span></h3><button class="btn sm" id="lx">清除</button></div><div id="log" style="margin-top:8px"></div></div>`;
  const $=s=>root.querySelector(s);
  let link=null,logs=[],hist=[],histTotal=0,loading=false,tab='all',pg=0,nlog=[],nLoading=false,lastTs=0,manual=false,autoCtl=null,polling=false,busy=false,alive=true;
  const log=(t,m)=>{logs.unshift([new Date().toLocaleTimeString('zh-TW',{hour12:false}),t,m]);if(logs.length>100)logs.pop();
    $('#log').innerHTML=logs.map(([a,t,m])=>`<div><span class="sub">${a}</span> <b>[${t}]</b> ${esc(m)}</div>`).join('');$('#lc').textContent=logs.length+'/100'};
  const conn=(t,on)=>{$('#cs').textContent=t;$('#dot').className='dot'+(on?' on':'')};
  const btns=on=>['#hl','#nl','#ntp'].forEach(s=>$(s).disabled=!on);
  const send=async c=>{if(!link?.kind)return;log('TX',c);try{await link.send(c)}catch{log('SYS','發送失敗：'+c)}};
  const onClose=k=>{link=null;btns(false);if(k==='usb')conn('已中斷（意外）');else{conn('重連中…');log('SYS','⚠️ 藍牙連線中斷，等待 Hub 再次廣播');if(!manual&&alive)autoBT(dev0)}};
  let dev0=null;
  const ready=async(l,label)=>{link=l;conn(label,true);log('SYS',label);btns(true);await send('SYNC');setTimeout(()=>link===l&&histLoad(),500)};
  async function openUSB(p){cancel();const l=new Link(onLine,onClose);await l.usb(p,{signals:true});
    try{const i=p.getInfo();localStorage.setItem(UK,JSON.stringify({v:i.usbVendorId,p:i.usbProductId}))}catch{}await ready(l,'USB 已連線')}
  async function openBT(d){cancel();dev0=d;const l=new Link(onLine,onClose);await l.ble(d,SVC,CH,CH,{resp:true});await ready(l,'藍牙已連線')}
  const cancel=()=>{try{autoCtl?.abort()}catch{}autoCtl=null};
  async function autoBT(d){if(manual||!alive)return;cancel();const c=new AbortController();autoCtl=c;
    const go=async()=>{if(c.signal.aborted||manual||link)return;try{await openBT(d)}catch{if(!manual&&alive)setTimeout(()=>autoBT(d),3000)}};
    try{d.addEventListener('advertisementreceived',go,{once:true});await d.watchAdvertisements({signal:c.signal})}
    catch{log('SYS','瀏覽器不支援廣播監聽，改為定時重試連線（請按 Hub 按鈕）');poll(d)}}
  async function poll(d){if(polling)return;polling=true;while(!manual&&alive&&!link){try{await openBT(d);break}catch{await delay(3000)}}polling=false}
  async function auto(){if(busy||link||!alive)return;busy=true;
    try{if(navigator.serial?.getPorts){const ps=await navigator.serial.getPorts();let inf=null;try{inf=JSON.parse(localStorage.getItem(UK))}catch{}
        const p=inf?ps.find(x=>{const i=x.getInfo();return i.usbVendorId===inf.v&&i.usbProductId===inf.p}):ps[0];
        if(p)try{await openUSB(p);return}catch{log('SYS','USB 自動連線失敗')}}
      if(navigator.bluetooth?.getDevices){const d=(await navigator.bluetooth.getDevices()).find(x=>x.name===NAME);if(d){conn('等待 Hub 廣播…');log('SYS','等待 Hub 藍牙廣播…（請按 Hub 按鈕）');autoBT(d)}}}
    finally{busy=false}}
  $('#usb').onclick=async()=>{manual=false;try{await openUSB(await navigator.serial.requestPort())}catch{log('SYS','USB 連線失敗')}};
  $('#bt').onclick=async()=>{manual=false;try{await openBT(await navigator.bluetooth.requestDevice({filters:[{name:NAME}],optionalServices:[SVC]}))}catch{log('SYS','藍牙連線失敗')}};
  $('#off').onclick=async()=>{manual=true;cancel();const l=link;link=null;await l?.close();btns(false);conn('已中斷');$('#ms').textContent='等待連線…';$('#nm').hidden=true};
  const plug=()=>{if(!link&&!manual)setTimeout(auto,800)};navigator.serial?.addEventListener('connect',plug);
  function histLoad(){if(loading)return;hist=[];histTotal=0;loading=true;$('#hl').disabled=true;hstat('載入中…');send('HIST_REQ,0,50')}
  const hstat=m=>{const e=$('#hs');e.hidden=!m;e.textContent=m||''};
  const fmt=r=>{if(r.t>0){const d=new Date(r.t*1000),p=n=>String(n).padStart(2,'0');return`${p(d.getMonth()+1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`}
    const h=r.pos;return h===0?'最新':h<24?`${h} 小時前`:`${h/24|0} 天${h%24?` ${h%24} 小時`:''}前`};
  const list=()=>tab==='mail'?hist.filter(r=>r.st===1):hist;
  function renderHist(){const d=list(),pages=Math.max(1,Math.ceil(d.length/PAGE)),pgd=d.slice(pg*PAGE,pg*PAGE+PAGE);
    $('#hb').innerHTML=pgd.length?pgd.map(r=>`<tr class="${r.st===1?'mr':r.st===-1?'er':''}"><td class="sub">${fmt(r)}</td><td><span class="chip ${r.st===1?'ok':r.st===-1?'bad':''}">${r.st===-1?'感測異常':r.st===1?'有信':'空箱'}</span></td><td class="${r.v<3?'errc':r.v<3.2?'warnc':'okc'}">${r.v.toFixed(2)}V</td><td>${r.d<0?'--':r.d+'mm'}</td></tr>`).join(''):`<tr><td colspan="4" class="empty">${tab==='mail'?'無有信紀錄':'無紀錄'}</td></tr>`;
    $('#pi').textContent=`第 ${pg+1} / ${pages} 頁（共 ${d.length} 筆）`;$('#pv').disabled=pg===0;$('#nx').disabled=pg>=pages-1}
  function chart(){const cv=$('#cv'),W=cv.width=cv.offsetWidth||460,H=120,x=cv.getContext('2d'),cs=getComputedStyle(root),sub=cs.getPropertyValue('--sub'),bd=cs.getPropertyValue('--bd'),acc=cs.getPropertyValue('--blue');
    x.clearRect(0,0,W,H);const d=hist.slice(0,50).reverse();if(d.length<2){x.fillStyle=sub;x.textAlign='center';x.fillText('資料不足',W/2,H/2);return}
    const vs=d.map(r=>r.v),mn=Math.min(...vs,2.5),mx=Math.max(...vs,3.6),p={t:10,b:20,l:32,r:8},cw=W-p.l-p.r,ch=H-p.t-p.b,X=i=>p.l+i/(d.length-1)*cw,Y=v=>p.t+(1-(v-mn)/(mx-mn))*ch;
    x.font='10px sans-serif';x.textAlign='right';[3,3.2,3.6].forEach(v=>{if(v<mn||v>mx)return;x.strokeStyle=bd;x.beginPath();x.moveTo(p.l,Y(v));x.lineTo(W-p.r,Y(v));x.stroke();x.fillStyle=sub;x.fillText(v.toFixed(1),p.l-2,Y(v)+3)});
    x.strokeStyle=acc;x.lineWidth=1.5;x.beginPath();d.forEach((r,i)=>i?x.lineTo(X(i),Y(r.v)):x.moveTo(X(i),Y(r.v)));x.stroke();
    d.forEach((r,i)=>{if(r.st===1){x.fillStyle='#f44336';x.beginPath();x.arc(X(i),Y(r.v),3,0,7);x.fill()}})}
  root.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;pg=0;root.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('on',x===b));hist.length&&renderHist()});
  $('#pv').onclick=()=>{pg=Math.max(0,pg-1);renderHist()};$('#nx').onclick=()=>{pg=Math.min(Math.ceil(list().length/PAGE)-1,pg+1);renderHist()};
  $('#hl').onclick=histLoad;$('#lx').onclick=()=>{logs=[];log('SYS','已清除');logs=[];$('#log').innerHTML='';$('#lc').textContent='0/100'};
  $('#nl').onclick=()=>{if(nLoading)return;nlog=[];nLoading=true;$('#nl').disabled=true;const e=$('#ns');e.hidden=false;e.textContent='載入中…';$('#nb').innerHTML='';send('NTFYLOG_REQ,0,20')};
  const calReset=()=>{const b=$('#cal');b.disabled=false;b.textContent='重新校準基準距離';b.classList.remove('dan')};
  $('#cal').onclick=()=>{const b=$('#cal');b.disabled=true;b.textContent='校準中…';send('CALIB_REQ');setTimeout(()=>{if(b.disabled){calReset();b.textContent='重試校準';log('SYS','校準請求超時')}},5000)};
  const ntpReset=()=>{const b=$('#ntp');b.disabled=!link;b.textContent='🕐 同步 Hub 時間'};
  $('#ntp').onclick=()=>{const b=$('#ntp');b.disabled=true;b.textContent='同步中…';send('NTP_SYNC');setTimeout(()=>{if(b.disabled)ntpReset()},20000)};
  function rel(){if(!lastTs)return;const s=(Date.now()-lastTs)/1000|0,d=new Date(lastTs),td=d.toDateString()===new Date().toDateString();
    $('#ts').textContent=`收到通知：${td?'今天':d.toLocaleDateString('zh-TW',{month:'numeric',day:'numeric'})} ${d.toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'})}，${s<60?s+' 秒前':s<3600?(s/60|0)+' 分鐘前':(s/3600|0)+' 小時前'}`}
  const iv=setInterval(rel,1000);
  function onLine(t){
    if(t.startsWith('HIST_DATA,')){const p=t.split(',');if(p.length>=6){const tv=+p[5];hist.push({pos:+p[1],st:+p[2],v:parseFloat(p[3]),d:+p[4],t:tv})}return}
    if(t.startsWith('HIST_END,')){histTotal=+t.split(',')[1]||0;loading=false;$('#hl').disabled=false;if(!hist.length)return hstat('尚無歷史紀錄');hstat('');pg=0;renderHist();chart();log('SYS',`歷史載入完成：${hist.length} 筆（共 ${histTotal} 筆）`);return}
    if(t.startsWith('NTFYLOG_DATA,')){const p=t.split(',');if(p.length>=6)nlog.push({ty:+p[2],code:+p[3],at:+p[4],t:+p[5]});return}
    if(t.startsWith('NTFYLOG_END,')){nLoading=false;$('#nl').disabled=false;const e=$('#ns');
      if(!nlog.length){e.hidden=false;e.textContent='尚無推播紀錄';return}e.hidden=true;
      $('#nb').innerHTML=nlog.map(r=>`<div class="lr"><span class="sub">${fmt({t:r.t,pos:0})}</span> ${r.ty===0?`<span class="okc">✅ 成功（第 ${r.at} 次嘗試）</span>`:r.ty===1?`<span class="errc">⚠️ WiFi 連不上（第 ${r.at} 次嘗試）</span>`:`<span class="warnc">⚠️ HTTP ${r.code}（第 ${r.at} 次嘗試）</span>`}</div>`).join('');return}
    log('RX',t);
    if(t.startsWith('SYS:REBOOT')||t.includes('ESP-ROM'))log('SYS','Hub 重啟偵測');
    if(t.startsWith('MAIL_UPDATE,')){const p=t.split(',');if(p.length<4)return;const mail=p[1]==='1',v=parseFloat(p[2]);
      $('#hero').className='card hero '+(mail?'mail':'empty');$('#ms').textContent=mail?'📬 有信件！':'📭 目前空箱';$('#dist').textContent=p[3];$('#volt').textContent=v.toFixed(2);
      const vs=$('#vs');vs.textContent=v<3?'請充電':v<3.2?'偏低':'正常';vs.className='chip '+(v<3?'bad':v<3.2?'warn':'ok');
      const ep=p.length>=5?+p[4]:NaN;lastTs=ep>1600000000?ep*1000:Date.now();rel();$('#dl').hidden=false;
      const dn=p.length>=6?+p[5]:NaN,nm=$('#nm');if(!mail&&dn>0){nm.hidden=false;nm.textContent=`📭 已連續 ${dn} 天沒有偵測到信件`}else nm.hidden=true;return}
    if(t==='NOTIFY,CALIB_DONE'){log('SYS','✅ 校準完成');calReset()}
    else if(t==='NOTIFY,CALIB_ERR'){log('SYS','⚠️ 校準失敗：感測器異常，請重試');calReset();$('#cal').textContent='校準失敗，請重試';setTimeout(()=>{$('#cal').textContent='重新校準基準距離'},5000)}
    else if(t==='NOTIFY,SENSOR_ERR'){log('SYS','感測器異常：量測無效');$('#hero').className='card hero err';$('#ms').textContent='⚠️ 感測器異常';$('#dist').textContent='--'}
    else if(t==='NOTIFY,NTP_OK'){log('SYS','✅ Hub 時間同步成功');ntpReset()}
    else if(t==='NOTIFY,NTP_FAIL'){log('SYS','❌ Hub 時間同步失敗（熱點未開？）');ntpReset()}
    else if(t.startsWith('NOTIFY,NTFY_OK'))log('SYS','✅ 推播已送出（若手機沒收到，問題在手機端 / ntfy App）');
    else if(t.startsWith('NOTIFY,NTFY_FAIL,WIFI'))log('SYS',`⚠️ 推播失敗：WiFi 連不上（第 ${(t.match(/try=(\d+)/)||[])[1]||'?'} 次）`);
    else if(t.startsWith('NOTIFY,NTFY_FAIL,HTTP'))log('SYS',`⚠️ 推播失敗：HTTP ${(t.match(/HTTP=(-?\d+)/)||[])[1]||'?'}（第 ${(t.match(/try=(\d+)/)||[])[1]||'?'} 次）`);
  }
  addEventListener('resize',()=>hist.length&&chart());
  auto();
  return()=>{alive=false;manual=true;cancel();clearInterval(iv);navigator.serial?.removeEventListener('connect',plug);link?.close()};
}};
