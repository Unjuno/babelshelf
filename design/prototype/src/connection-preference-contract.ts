import {settings} from './app-settings.ts';
import {validateRustXngEndpoint} from './rustxng-search-contract.ts';

export type ConnectionPreferences={schemaVersion:number;downloads:boolean;diagnosticLogs:boolean;rustxngEndpoint:string};

export function createConnectionPreferenceDefaults(schemaVersion:number):ConnectionPreferences{
 return {schemaVersion,downloads:settings.defaults.downloads,diagnosticLogs:false,rustxngEndpoint:''};
}

export function validateConnectionPreference(value:ConnectionPreferences):void{
 if(typeof value.downloads!=='boolean'||typeof value.diagnosticLogs!=='boolean'||typeof value.rustxngEndpoint!=='string'||value.rustxngEndpoint.length>2048)throw Error('Invalid connection preference');
 if(value.rustxngEndpoint)validateRustXngEndpoint(value.rustxngEndpoint);
}
