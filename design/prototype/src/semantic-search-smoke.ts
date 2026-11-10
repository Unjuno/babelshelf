/** Safe, in-memory fixture for checking that the selected embedding route can
 * produce vectors and rank a relevant passage. It never reads or writes Memory. */
export async function runSemanticSearchSmoke(embed:(texts:readonly string[],signal?:AbortSignal)=>Promise<readonly (readonly number[]|Float32Array)[]>,signal?:AbortSignal){
 if(typeof embed!=='function')throw Error('Embedding function unavailable');
 signal?.throwIfAborted();
 const texts=[
  '青いランタン会合の日時と場所は？',
  '青いランタン会合は11月19日14時40分に杉の部屋で行われます。',
  '次回の昼食会は12月2日、松の部屋で行われます。',
 ];
 const vectors=await embed(texts,signal);signal?.throwIfAborted();
 if(!Array.isArray(vectors)||vectors.length!==texts.length)throw Error('Embedding count mismatch');
 const normalized=vectors.map(vector=>{
  if((!Array.isArray(vector)&&!(vector instanceof Float32Array))||vector.length<1||vector.length>4096)throw Error('Invalid embedding vector');
  let magnitude=0;for(const value of vector){if(typeof value!=='number'||!Number.isFinite(value))throw Error('Invalid embedding value');magnitude+=value*value;}
  if(!Number.isFinite(magnitude)||magnitude<=0)throw Error('Empty embedding vector');
  const scale=1/Math.sqrt(magnitude);return Array.from(vector,value=>value*scale);
 });
 if(normalized.some(vector=>vector.length!==normalized[0].length))throw Error('Embedding dimensions changed');
 const cosine=(left:number[],right:number[])=>left.reduce((sum,value,index)=>sum+value*right[index],0);
 const match=cosine(normalized[0],normalized[1]),distractor=cosine(normalized[0],normalized[2]);
 return {passed:match>distractor,matchScore:Math.round(match*1000)/1000,distractorScore:Math.round(distractor*1000)/1000,matchRank:match>distractor?1:2};
}
