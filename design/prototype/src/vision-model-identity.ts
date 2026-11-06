import {visionManifest} from './vision-assets.ts';

export type VisionModelIdentity={model:string;revision:string;runtime:string};
export function validVisionModelIdentity(value:VisionModelIdentity){
 if(value.runtime!==visionManifest.runtime)return false;
 if(value.model===visionManifest.id)return value.revision===visionManifest.revision;
 const match=value.model.match(/^local-vision-([a-f0-9]{64})$/);
 return !!match&&value.revision==='sha256:'+match[1];
}
