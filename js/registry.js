// 新增工具：在 js/tools/ 放一個模組（格式見 README），然後在這裡 import 並加進陣列即可。
// 陣列順序 = 預設顯示順序（使用者可在首頁「自訂排序」改成自己的順序）。
import mailbox from './tools/mailbox.js';
import {nlight,rgb} from './tools/lights.js';
import adata from './tools/adata.js';
import {kbMini,kbRp} from './tools/keyboard.js';
import usbplug from './tools/usbplug.js';
import irhub from './tools/irhub.js';
import legacy from './tools/legacy.js';
export default [mailbox,nlight,rgb,adata,usbplug,irhub,...legacy,kbMini,kbRp];
