import tools from './registry.js';
import {esc} from './core/ui.js';
const app=document.getElementById('app'),title=document.getElementById('title'),back=document.getElementById('back'),inst=document.getElementById('install');
const CATS=['燈光','插座','感測','遙控','鍵盤'];
let cleanup=null,deferred=null;

function home(){
  title.textContent='ESP 工具箱';back.hidden=true;
  const miss=[!navigator.bluetooth&&'Web Bluetooth',!navigator.serial&&'Web Serial'].filter(Boolean);
  app.innerHTML=(miss.length?`<div class="note warn">此瀏覽器不支援 ${miss.join('、')}，部分工具無法連線。請用桌面版 Chrome / Edge（或支援的 Android Chrome）。</div>`:'')+
  CATS.map(c=>{const l=tools.filter(t=>t.cat===c);return l.length?`<h2>${c}</h2><div class="grid">${l.map(t=>
    `<a class="tile" href="#/t/${t.id}"><span class="ic">${t.icon}</span><b>${esc(t.name)}</b><small>${esc(t.sub)}</small><span class="tags">${t.tags.map(x=>`<span class="tag">${x}</span>`).join('')}${t.legacy?'<span class="tag old">舊版頁面</span>':'<span class="tag ok">統一版</span>'}</span></a>`).join('')}</div>`:''}).join('');
}

function tool(t){
  title.textContent=t.name;back.hidden=false;
  app.innerHTML=`<div class="tabs"><button data-t="ctl" class="on">控制</button><button data-t="guide">配對規則</button></div>
  <section id="ctl"></section>
  <section id="guide" hidden>${t.guide.map(s=>`<div class="card"><h3>${esc(s.h)}</h3><ul>${s.li.map(x=>`<li>${x}</li>`).join('')}</ul></div>`).join('')}</section>`;
  app.querySelector('.tabs').onclick=e=>{const b=e.target.closest('button');if(!b)return;
    app.querySelectorAll('.tabs button').forEach(x=>x.classList.toggle('on',x===b));
    app.querySelector('#ctl').hidden=b.dataset.t!=='ctl';app.querySelector('#guide').hidden=b.dataset.t!=='guide'};
  cleanup=t.mount(app.querySelector('#ctl'))||null;
}

function route(){
  cleanup?.();cleanup=null;
  const m=location.hash.match(/^#\/t\/([\w-]+)/),t=m&&tools.find(x=>x.id===m[1]);
  t?tool(t):home();scrollTo(0,0);
}
back.onclick=()=>{location.hash='#/'};
addEventListener('hashchange',route);
addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;inst.hidden=false});
inst.onclick=async()=>{inst.hidden=true;deferred?.prompt();deferred=null};
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
route();
