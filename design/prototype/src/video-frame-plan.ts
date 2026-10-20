export type VideoFramePlan={schema:1;processor:'mediabunny-1.61.6';timebase:'container-presentation';trackId:number;startUs:number;endUs:number;width:number;height:number;timestampsUs:number[];coverage:'sampled-frames-only'};
const MAX_SECONDS=600,MAX_SIDE=768;
export function videoFramePlan(input:{trackId:number;start:number;end:number;width:number;height:number}):VideoFramePlan{
 const {trackId,start,end,width,height}=input,first=Math.max(0,start);
 if(!Number.isSafeInteger(trackId)||trackId<1||!Number.isFinite(start)||!Number.isFinite(end)||end<=first||end-first>MAX_SECONDS||![width,height].every(n=>Number.isSafeInteger(n)&&n>0)||width*height>64000000)throw Error('Video frame bounds unsupported · maximum 10 minutes / 64 megapixels');
 const startUs=Math.round(first*1e6),endUs=Math.round(end*1e6);
 if(!Number.isSafeInteger(startUs)||!Number.isSafeInteger(endUs)||endUs<=startUs)throw Error('Video frame timing unsupported');
 const scale=Math.min(1,MAX_SIDE/Math.max(width,height));
 const timestampsUs=[...new Set([1,3,5].map(n=>Math.min(endUs-1,Math.round(startUs+(endUs-startUs)*n/6))))];
 return {schema:1,processor:'mediabunny-1.61.6',timebase:'container-presentation',trackId,startUs,endUs,width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale)),timestampsUs,coverage:'sampled-frames-only'};
}
export function validateSampledFrame(plan:VideoFramePlan,requestedUs:number,sample:{timestamp:number;duration:number;width:number;height:number}){
 const timestampUs=Math.round(sample.timestamp*1e6),durationUs=Math.round(sample.duration*1e6);
 if(!plan.timestampsUs.includes(requestedUs)||!Number.isSafeInteger(timestampUs)||!Number.isSafeInteger(durationUs)||durationUs<=0||timestampUs<0||timestampUs>requestedUs||timestampUs+durationUs<=requestedUs||timestampUs>=plan.endUs||sample.width!==plan.width||sample.height!==plan.height)throw Error('Requested video frame unavailable');
 return {requestedUs,timestampUs,durationUs,width:sample.width,height:sample.height};
}
