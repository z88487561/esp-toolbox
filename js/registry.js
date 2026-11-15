// 新增工具：在 js/tools/ 放一個模組（格式見 README），然後在這裡 import 並加進陣列即可。
import {nlight,rgb} from './tools/lights.js';
import adata from './tools/adata.js';
import legacy from './tools/legacy.js';
export default [nlight,rgb,adata,...legacy];
