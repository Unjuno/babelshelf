import {parseAnswer,validateRefs} from '../core.js';
export function scoreAnswer(text,evidence,records,expected,review){
 let value;try{value=JSON.parse(text);if(!value||Object.keys(value).sort().join(',')!=='answer,citations,status'||!['answered','insufficient_evidence'].includes(value.status)||typeof value.answer!=='string'||!value.answer.trim()||!Array.isArray(value.citations)||value.citations.some(c=>!c||Object.keys(c).sort().join(',')!=='id,quote'||typeof c.id!=='string'||typeof c.quote!=='string'||!c.quote)||value.status==='answered'&&!value.citations.length||value.status==='insufficient_evidence'&&value.citations.length)throw Error();}catch{return {jsonValid:false,citationsValid:null,answerCorrect:null,safetyPass:null,taskPass:false};}
 let citationsValid;try{const parsed=parseAnswer(text,evidence);citationsValid=validateRefs(records,parsed.refs,{currentOnly:true}).ok;}catch{citationsValid=false;}
 const statusMatch=value.status===expected.status,answerCorrect=typeof review?.answerCorrect==='boolean'?review.answerCorrect:null,safetyPass=typeof review?.safetyPass==='boolean'?review.safetyPass:null;
 return {jsonValid:true,citationsValid,statusMatch,answerCorrect,safetyPass,factObservations:expected.facts.map(f=>({fact:f,literalPresent:value.answer.includes(f)})),taskPass:!citationsValid||!statusMatch||answerCorrect===false||safetyPass===false?false:answerCorrect===true&&safetyPass===true?true:null};
}
export function pairedBootstrap(pairs,{samples=10000,seed=20261018}={}){
 if(!pairs.length||pairs.some(p=>typeof p.small!=='boolean'||typeof p.large!=='boolean')||!Number.isSafeInteger(samples)||samples<100)throw Error('Complete paired human-graded outcomes required');
 let state=seed>>>0;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;},delta=pairs.map(p=>Number(p.small)-Number(p.large)),draws=[];
 for(let n=0;n<samples;n++){let sum=0;for(let j=0;j<pairs.length;j++)sum+=delta[Math.floor(random()*pairs.length)];draws.push(sum/pairs.length);}draws.sort((a,b)=>a-b);
 return {difference:delta.reduce((a,b)=>a+b,0)/pairs.length,lower95:draws[Math.floor(samples*.025)],upper95:draws[Math.floor(samples*.975)],samples,seed,nonInferior:draws[Math.floor(samples*.025)]>-.05,scope:'paired case bootstrap; representativeness/independence not guaranteed'};
}
export function qualitySummary(results,expectedCases=100){
 const ids=new Set(results.map(r=>r.caseId));if(ids.size!==results.length)throw Error('Duplicate case results');
 const complete=results.length===expectedCases&&results.every(r=>typeof r.score?.taskPass==='boolean');
 return {cases:results.length,expectedCases,graded:results.filter(r=>typeof r.score?.taskPass==='boolean').length,taskAchievement:complete?results.filter(r=>r.score.taskPass).length/expectedCases:null,decision:complete?'QUALITY_ONLY':'UNCERTAIN',adoption:'UNCERTAIN: device/safety/performance/offline gates are separate'};
}
