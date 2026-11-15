// 共用 BLE 工具。每個原生工具用自己的 id 記住「成功連過的裝置」，下次開啟自動重連。
export const hasBLE=!!navigator.bluetooth;
export const delay=ms=>new Promise(r=>setTimeout(r,ms));
export async function write(ch,data){return ch.writeValueWithoutResponse?ch.writeValueWithoutResponse(data):ch.writeValue(data)}
const K=t=>'tb.devs.'+t;
export function remember(tool,devId){
  try{const a=JSON.parse(localStorage.getItem(K(tool))||'[]');if(!a.includes(devId))localStorage.setItem(K(tool),JSON.stringify([...a,devId]))}catch{}
}
export async function saved(tool){
  try{const ids=JSON.parse(localStorage.getItem(K(tool))||'[]');
    return navigator.bluetooth?.getDevices?(await navigator.bluetooth.getDevices()).filter(d=>ids.includes(d.id)):[]}catch{return[]}
}
