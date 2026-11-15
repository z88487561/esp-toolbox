export const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let t;
export function toast(m){const e=document.getElementById('toast');e.textContent=m;e.className='show';clearTimeout(t);t=setTimeout(()=>e.className='',3200)}
export const hms=s=>[s/3600|0,s%3600/60|0,s%60].map(n=>String(n).padStart(2,'0')).join(':');
