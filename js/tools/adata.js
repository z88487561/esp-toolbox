import {delay,write,remember,permitted,keepTrying,autoGuide,hasBLE} from '../core/ble.js';
import {toast,esc} from '../core/ui.js';
const JDY=['0000ffe0-0000-1000-8000-00805f9b34fb','0000ffe1-0000-1000-8000-00805f9b34fb'];
const RAC='0000ae00-0000-1000-8000-00805f9b34fb',RW='0000ae01-0000-1000-8000-00805f9b34fb';
const G=[['電源 / 亮度',[['⏻ 開 / 關（切換）',0x21,'wide'],['10%',0x2B],['50%',0x2C],['100%',0x2D],['亮度 −',0x23],['亮度 ＋',0x22]]],
['色溫',[['暖白',0x2A],['自然光',0x29],['冷白',0x28],['色溫 −',0x25],['色溫 ＋',0x24]]],
['情境模式',[['晚安',0x27],['星空',0x26],['派對',0x2F]]],['RGB 彩燈',[['開啟 RGB',0xF8],['關閉 RGB',0xF9]]]];
const NK='tb.adata.name.';
export default{
id:'adata',cat:'燈光',icon:'💡',name:'威剛燈具',sub:'BEAMY 系列 BLE 燈具',tags:['BLE','多裝置'],
guide:[
{h:'怎麼配對與選擇燈具',li:['點「新增燈具」，瀏覽器的選擇器<b>只會列出名稱開頭為 <code>BEAMY</code></b> 的藍牙裝置；可重複新增多盞。','燈具加入後，勾選要控制的燈；<b>只有勾選的燈會收到控制指令</b>，也可用「全選／全取消」。','每盞燈仍由藍牙個別連線；燈具通常同一時間只接受一個藍牙連線，請先關閉原廠 App。']},
{h:'模組型態（自動偵測）',li:['先試 <b>JDY-19</b>：服務 <code>FFE0</code>、特徵 <code>FFE1</code>（寫入與通知共用）。','失敗再試 <b>RACER03</b>：服務 <code>AE00</code>，寫入 <code>AE01</code>、通知 <code>AE02</code>。']},
{h:'命名規則',li:['自訂名稱只存在<b>這台瀏覽器</b>（以藍牙裝置 ID 為鍵），不會寫進燈具；換瀏覽器或清除資料就會消失。','為避免個資外洩，工具箱內<b>不內建任何 MAC 位址對照表</b>。']},
autoGuide(),
{h:'指令限制',li:['每個按鈕送出 1 byte 指令；開關是「切換」，無法讀回目前狀態。','RGB 顏色送出序列 <code>FB R FC G FD B</code>，每 byte 間隔 60 ms。']}],
mount(root){
  let devs=[],alive=true,hint='',queue=Promise.resolve();
  const stops={},opening=new Map(),manualStop=new Set();
  root.innerHTML=`${hasBLE?'':'<div class="note warn">此瀏覽器不支援 Web Bluetooth</div>'}
  <div class="card"><div class="row"><button class="btn pri" id="add">＋ 新增燈具</button><button class="btn" id="re">重連已記住的燈</button></div>
  <div class="row"><button class="btn sm" id="all">全選</button><button class="btn sm" id="none">全取消</button><button class="btn sm dan" id="disc">全部斷線</button></div>
  <div class="status"><span id="summary">尚無連線燈具</span></div><div id="list" class="mt"></div></div>`+
  G.map(([h,bs])=>`<div class="card"><h3>${h}</h3><div class="row wrap">${bs.map(([l,c,w])=>`<button class="btn ${w||''}" data-c="${c}">${l}</button>`).join('')}</div></div>`).join('')+
  `<div class="card"><h3>RGB 顏色</h3><div class="row"><input type="color" id="pk" value="#ff8800" style="flex:1;height:44px;border:0;background:none"><button class="btn" id="rg">套用顏色</button></div></div>`;
  const $=s=>root.querySelector(s);
  const label=d=>{const n=localStorage.getItem(NK+d.id);return n?`${n}（${d.name||'燈具'}）`:(d.name||'燈具')};
  const selected=()=>devs.filter(d=>d.sel);
  function render(){
    if(!alive)return;
    $('#summary').textContent=devs.length?`已連線 ${devs.length} 盞，已選取 ${selected().length} 盞`:(hint||'尚無連線燈具');
    $('#list').innerHTML=devs.length?devs.map((d,i)=>`<div class="dev"><label><input type="checkbox" data-a="sel" data-i="${i}" ${d.sel?'checked':''}><b>${esc(label(d))}</b><span class="chip ok">已連線</span></label>
      <div class="row"><button class="btn sm" data-a="ren" data-i="${i}">改名</button><button class="btn sm dan" data-a="disc" data-i="${i}">斷線</button></div></div>`).join(''):'<div class="empty">尚無連線燈具</div>';
  }
  async function open(dev,silent){
    if(devs.some(d=>d.id===dev.id))return;
    if(opening.has(dev.id))return opening.get(dev.id);
    const task=(async()=>{
      try{
        const server=await dev.gatt.connect();if(!alive||manualStop.has(dev.id)){dev.gatt.disconnect();throw Object.assign(Error(),{fatal:true})}
        let wc;
        try{wc=await(await server.getPrimaryService(JDY[0])).getCharacteristic(JDY[1])}
        catch{wc=await(await server.getPrimaryService(RAC)).getCharacteristic(RW)}
        if(!alive||manualStop.has(dev.id)){dev.gatt.disconnect();throw Object.assign(Error(),{fatal:true})}
        const d={id:dev.id,dev,name:dev.name||'威剛燈具',wc,sel:true};
        const disconnected=()=>{
          devs=devs.filter(x=>x!==d);hint='連線中斷，自動重連中…';render();
          if(alive)retry(dev);
        };
        d.disconnected=disconnected;
        dev.addEventListener('gattserverdisconnected',disconnected,{once:true});
        devs.push(d);remember('adata',dev.id);hint='';render();
        stops[dev.id]?.();delete stops[dev.id];
      }catch(e){
        try{dev.gatt.disconnect()}catch{}
        if(!silent&&!e.fatal)toast('連線失敗：'+e.message);
        throw e;
      }
    })();
    opening.set(dev.id,task);
    try{return await task}
    finally{if(opening.get(dev.id)===task)opening.delete(dev.id)}
  }
  function retry(dev){
    if(manualStop.has(dev.id))return;
    stops[dev.id]?.();
    stops[dev.id]=keepTrying(dev,x=>open(x,true),()=>alive);
  }
  function disconnect(d){
    manualStop.add(d.id);
    stops[d.id]?.();delete stops[d.id];
    d.dev.removeEventListener('gattserverdisconnected',d.disconnected);
    devs=devs.filter(x=>x!==d);render();
    try{d.dev.gatt.disconnect()}catch(e){toast('斷線失敗：'+e.message)}
  }
  function sendBytes(values,targets=selected(),spacing=0){
    if(!targets.length)return toast('請先勾選要控制的燈具');
    queue=queue.then(async()=>{
      for(const value of values){
        for(const d of targets){
          try{await write(d.wc,Uint8Array.of(value&255))}
          catch(e){toast(`送出失敗（${label(d)}）：${e.message}`)}
        }
        if(spacing)await delay(spacing);
      }
    });
  }
  $('#add').onclick=async()=>{
    let dev;
    try{dev=await navigator.bluetooth.requestDevice({filters:[{namePrefix:'BEAMY'}],optionalServices:[JDY[0],RAC]})}
    catch(e){if(e.name!=='NotFoundError')toast(e.message);return}
    manualStop.delete(dev.id);
    open(dev,false).catch(()=>{});
  };
  $('#re').onclick=async()=>{
    hint='';render();
    try{
      const saved=await permitted('adata',{say:m=>{hint=m;render()}});
      for(const dev of saved)if(alive&&!devs.some(d=>d.id===dev.id)){
        manualStop.delete(dev.id);
        hint='正在連線已記住的燈具…';render();retry(dev);
      }
    }catch(e){toast('讀取已記住的燈具失敗：'+e.message)}
  };
  $('#all').onclick=()=>{devs.forEach(d=>d.sel=true);render()};
  $('#none').onclick=()=>{devs.forEach(d=>d.sel=false);render()};
  $('#disc').onclick=()=>{
    [...Object.keys(stops),...opening.keys()].forEach(id=>manualStop.add(id));
    Object.keys(stops).forEach(id=>{stops[id]();delete stops[id]});
    devs.slice().forEach(disconnect);
  };
  $('#list').onchange=e=>{
    const t=e.target,d=devs[+t.dataset.i];
    if(t.dataset.a==='sel'&&d){d.sel=t.checked;render()}
  };
  $('#list').onclick=e=>{
    const b=e.target.closest('[data-a]');if(!b)return;
    const d=devs[+b.dataset.i];if(!d)return;
    if(b.dataset.a==='disc')disconnect(d);
    if(b.dataset.a==='ren'){
      const n=(prompt('自訂此燈名稱',localStorage.getItem(NK+d.id)||d.name)||'').trim();
      if(n)localStorage.setItem(NK+d.id,n);else localStorage.removeItem(NK+d.id);
      render();
    }
  };
  root.onclick=e=>{
    const b=e.target.closest('[data-c]');if(b)sendBytes([+b.dataset.c]);
    if(e.target.closest('#rg')){
      const h=$('#pk').value,[r,g,bl]=[1,3,5].map(i=>parseInt(h.substr(i,2),16));
      sendBytes([0xFB,r,0xFC,g,0xFD,bl],selected(),60);
    }
  };
  permitted('adata',{say:m=>{hint=m;render()}}).then(saved=>{
    if(!alive)return;
    for(const dev of saved)if(!devs.some(d=>d.id===dev.id)){
      hint='自動連線中…（燈具需在範圍內並通電）';render();retry(dev);
    }
  }).catch(e=>{if(alive)toast('讀取已記住的燈具失敗：'+e.message)});
  render();
  return()=>{
    alive=false;Object.values(stops).forEach(stop=>stop());
    devs.forEach(d=>{d.dev.removeEventListener('gattserverdisconnected',d.disconnected);try{d.dev.gatt.disconnect()}catch{}});
  };
}};
