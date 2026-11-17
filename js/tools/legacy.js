// 已全部改寫為原生工具；保留給日後暫時用 iframe 掛載舊頁面的工具使用（放在 legacy/ 目錄）。
const L=o=>({...o,legacy:true,mount(root){
  const f=document.createElement('iframe');f.className='legacy';f.src=o.file;f.allow='bluetooth; serial';
  root.innerHTML='<div class="note">此工具暫時以原頁面執行，介面風格尚未統一，功能與原本相同。</div>';root.append(f);return()=>f.remove();}});
export default[];
export {L};
