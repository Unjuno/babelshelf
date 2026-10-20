import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Run the actual component effect/dependencies through the reported hydration
// ordering. Browser verification still checks the real DOM and layout.
test('stored dialogue follows to its end when metadata completes after dialogue hydration',()=>{
 const source=readFileSync(new URL('../src/Prototype.tsx',import.meta.url),'utf8'),anchor=source.indexOf("conversationElement.current?.closest('.native-scroll')"),start=source.lastIndexOf('useEffect(',anchor),end=source.indexOf(']);',anchor)+3;
 assert.ok(anchor>0&&start>=0&&end>anchor,'conversation effect available');
 const compiled=source.slice(start,end);
 const register=new Function('useEffect','conversationElement','page','messages','availableHeight','storageReady','metadataReady','dialogueReady',compiled),scroller={scrollTop:0,scrollHeight:4192},element={closest(selector){assert.equal(selector,'.native-scroll');return scroller;}},ref={current:null};let previous,queued;
 function useEffect(callback,deps){if(!previous||deps.length!==previous.length||deps.some((value,i)=>!Object.is(value,previous[i])))queued=callback;previous=deps;}
 function render(messages,storageReady,metadataReady,dialogueReady){ref.current=storageReady&&metadataReady&&dialogueReady?element:null;register(useEffect,ref,'input',messages,704,storageReady,metadataReady,dialogueReady);const effect=queued;queued=null;effect?.();}
 render([],false,false,false);
 const history=[{text:'Earlier message'},{text:'Latest saved message'}];
 render(history,true,false,true);
 assert.equal(scroller.scrollTop,0);
 render(history,true,true,true);
 assert.equal(scroller.scrollTop,scroller.scrollHeight);
});
