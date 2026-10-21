import {PreparedGgufAdapter} from './lfm-adapter.js';
// Separate app-owned architecture policy, not a model/config supplied engine.
// Registration is a separate gate; this alone does not enable custom intake.
export class Qwen3Adapter extends PreparedGgufAdapter {
 constructor(options){super({...options,architecture:'qwen3'});}
}
