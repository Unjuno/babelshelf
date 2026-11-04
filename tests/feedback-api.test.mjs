import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../feedback-api/src/index.mjs';

function fixture(){
 const inserts=[];
 const env={
  ALLOWED_ORIGINS:'https://babelshelf.com',
  DB:{
   prepare(sql){
    return {bind(...values){
     return {run:async()=>{inserts.push({sql,values});}};
    }};
   }
  }
 };
 return {env,inserts};
}
function request(method='POST',body,origin='https://babelshelf.com',path='/v1/feedback'){
 return new Request(`https://feedback-api.example${path}`,{method,headers:{origin,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
}

test('feedback accepts only the public-form fields and stores one bounded database row',async()=>{
 const {env,inserts}=fixture();
 const response=await worker.fetch(request('POST',{category:'usability',message:'Please make setup clearer.',build:'abc123',conversation:'secret',memory:['secret']}),env);
 assert.equal(response.status,201);assert.deepEqual(await response.json(),{ok:true});
 assert.equal(inserts.length,1);assert.deepEqual(inserts[0].values.slice(1),[inserts[0].values[1],'usability','Please make setup clearer.','abc123']);
 assert.doesNotMatch(inserts[0].sql,/conversation|memory/i);assert.equal(inserts[0].values.length,5);
 assert.equal(response.headers.get('access-control-allow-origin'),'https://babelshelf.com');
});

test('feedback rejects an unapproved origin, invalid category and oversized text',async()=>{
 const {env,inserts}=fixture();
 assert.equal((await worker.fetch(request('POST',{category:'bug',message:'x'},'https://attacker.example'),env)).status,403);
 assert.equal((await worker.fetch(request('POST',{category:'admin',message:'x'}),env)).status,400);
 assert.equal((await worker.fetch(request('POST',{category:'bug',message:'x'.repeat(2001)}),env)).status,400);
 assert.equal(inserts.length,0);
});

test('feedback has no public read route and rejects oversized request bodies',async()=>{
 const {env,inserts}=fixture();
 assert.equal((await worker.fetch(request('GET',undefined),env)).status,405);
 assert.equal((await worker.fetch(request('POST',{category:'bug',message:'x'},'https://babelshelf.com','/v1/feedback/read'),env)).status,404);
 const large=new Request('https://feedback-api.example/v1/feedback',{method:'POST',headers:{origin:'https://babelshelf.com','content-type':'application/json'},body:' '.repeat(8193)});
 assert.equal((await worker.fetch(large,env)).status,413);assert.equal(inserts.length,0);
});
