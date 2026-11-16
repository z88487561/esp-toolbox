import tools from './registry.js';
import {esc} from './core/ui.js';
const app=document.getElementById('app'),title=document.getElementById('title'),back=document.getElementById('back'),inst=document.getElementById('install'),thm=document.getElementById('theme');
let cleanup=null,deferred=null,sorting=false,cur='home';
const ld=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}};
function ordered(){const o=ld('tb.order',[]),ids=tools.map(t=>t.id);return[...o.filter(i=>ids.includes(i)),...ids.filter(i=>!o.includes(i))].map(i=>tools.find(t=>t.id===i))}
const theme=id=>{const t=localStorage.getItem('tb.theme.'+id)||'dark';document.documentElement.dataset.theme=t;thm.textContent=t==='dark'?'☀️':'🌙';thm.title=t==='dark'?'切換為一般模式':'切換為暗黑模式'};
thm.onclick=()=>{localStorage.setItem('tb.theme.'+cur,document.documentElement.dataset.theme==='dark'?'light':'dark');theme(cur)};
const tag=t=>`<span class="tags">${t.tags.map(x=>`<span class="tag">${x}</span>`).join('')}${t.legacy?'<span class="tag old">舊版頁面</span>':''}</span>`;

function home(){
  cur='home';theme(cur);thm.hidden=false;title.textContent='ESP 工具箱';back.hidden=true;
  const miss=[!navigator.bluetooth&&'Web Bluetooth',!navigator.serial&&'Web Serial'].filter(Boolean),L=ordered();
  app.innerHTML=(miss.length?`<div class="note warn">此瀏覽器不支援 ${miss.join('、')}，部分工具無法連線。請用桌面版 Chrome / Edge（或支援的 Android Chrome）。</div>`:'')+
  `<div class="row" style="margin:0 0 10px"><span class="sub" style="flex:1">${sorting?'用 ↑ ↓ 調整順序':'我的工具'}</span>${sorting?'<button class="btn sm" id="rst">重設</button>':''}<button class="btn sm ${sorting?'pri':''}" id="srt">${sorting?'完成':'自訂排序'}</button></div>`+
  (sorting?L.map((t,i)=>`<div class="srt"><span>${t.icon}</span><b>${esc(t.name)}</b><button class="btn sm" data-m="${i}" data-d="-1" ${i?'':'disabled'}>↑</button><button class="btn sm" data-m="${i}" data-d="1" ${i<L.length-1?'':'disabled'}>↓</button></div>`).join('')
  :`<div class="grid">${L.map(t=>`<a class="tile" href="#/t/${t.id}"><span class="ic">${t.icon}</span><b>${esc(t.name)}</b><small>${esc(t.sub)}</small>${tag(t)}</a>`).join('')}</div>`);
  app.querySelector('#srt').onclick=()=>{sorting=!sorting;home()};
  const r=app.querySelector('#rst');if(r)r.onclick=()=>{localStorage.removeItem('tb.order');home()};
  if(sorting)app.onclick=e=>{const b=e.target.closest('[data-m]');if(!b)return;const a=ordered().map(t=>t.id),i=+b.dataset.m,j=i+ +b.dataset.d;[a[i],a[j]]=[a[j],a[i]];localStorage.setItem('tb.order',JSON.stringify(a));home()};
  else app.onclick=null;
}

function tool(t){
  sorting=false;app.onclick=null;cur=t.id;theme(cur);thm.hidden=!!t.legacy;title.textContent=t.name;back.hidden=false;
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
