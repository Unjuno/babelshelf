export type MemorySearchAttempt<T>={query:string;results:T[];fallback:boolean};

/** If a model-selected search misses, retry only with the user's original request.
 * This returns results for review; it never opens a file or generates an answer. */
export async function searchMemoryWithQuestionFallback<T>(proposedQuery:string,question:string,search:(query:string)=>Promise<T[]>):Promise<MemorySearchAttempt<T>>{
 if(typeof proposedQuery!=='string'||typeof question!=='string'||!question.trim()||question.length>30_000||typeof search!=='function')throw Error('Invalid Memory search request');
 const query=proposedQuery.trim()?proposedQuery:question,results=await search(query);
 if(!Array.isArray(results))throw Error('Invalid Memory search results');
 if(results.length||query===question)return {query,results,fallback:false};
 const retry=await search(question);
 if(!Array.isArray(retry))throw Error('Invalid Memory search results');
 return {query:question,results:retry,fallback:true};
}
