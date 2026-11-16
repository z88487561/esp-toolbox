// 文字行協定的共用連線：USB Serial 或 BLE（單一或分開的 TX/RX 特徵值），寫入自動排隊。
import {write,delay} from './ble.js';
export class Link{
  constructor(onLine,onClose){this.onLine=onLine;this.onClose=onClose;this.kind=null;this.buf='';this.q=Promise.resolve();this.closing=false}
  _feed(t){this.buf+=t;let i;while((i=this.buf.indexOf('\n'))>=0){const l=this.buf.slice(0,i).replace(/\r/g,'').trim();this.buf=this.buf.slice(i+1);if(l)this.onLine(l)}}
  _dead(){if(this.closing||!this.kind)return;const k=this.kind;this.kind=null;this.onClose?.(k)}
  async usb(port,{signals=false}={}){
    try{await port.close()}catch{}
    await port.open({baudRate:115200});if(signals)await port.setSignals({dataTerminalReady:false,requestToSend:false});
    this.port=port;this.w=port.writable.getWriter();this.kind='usb';
    (async()=>{const dec=new TextDecoder();
      while(this.port?.readable&&!this.closing){this.r=this.port.readable.getReader();
        try{for(;;){const{value,done}=await this.r.read();if(done)break;this._feed(dec.decode(value,{stream:true}))}}catch{}
        finally{try{this.r.releaseLock()}catch{}this.r=null}}
      this._dead()})();
  }
  async ble(dev,svc,tx,rx,{resp=false,gap=0}={}){
    this.dev=dev;this.resp=resp;this.gap=gap;
    try{const s=await dev.gatt.connect();const sv=await s.getPrimaryService(svc);
      this.tx=await sv.getCharacteristic(tx);const rc=tx===rx?this.tx:await sv.getCharacteristic(rx);
      await rc.startNotifications();const dec=new TextDecoder();
      rc.addEventListener('characteristicvaluechanged',e=>this._feed(dec.decode(e.target.value)));
      dev.addEventListener('gattserverdisconnected',()=>this._dead(),{once:true});this.kind='ble'}
    catch(e){try{dev.gatt.disconnect()}catch{}throw e}
  }
  send(line){const d=new TextEncoder().encode(line+'\n');
    return this.q=this.q.catch(()=>{}).then(async()=>{
      if(this.kind==='usb')return this.w.write(d);
      for(let i=0;i<d.length;i+=20){const p=d.slice(i,i+20);this.resp?await this.tx.writeValue(p):await write(this.tx,p);if(this.gap||i+20<d.length)await delay(this.gap||20)}})}
  async close(){this.closing=true;const k=this.kind;this.kind=null;
    if(k==='usb'){try{await this.r?.cancel()}catch{}await delay(60);try{this.w.releaseLock()}catch{}try{await this.port.close()}catch{}}
    else try{this.dev?.gatt.disconnect()}catch{}}
}
