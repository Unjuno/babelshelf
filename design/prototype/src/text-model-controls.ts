type State={selected:boolean;custom:boolean;present:boolean;presenceOnly?:boolean;statusError?:boolean;loaded:boolean;busy:boolean;downloads:boolean};
// Registration alone never enables execution or acquisition of custom weights.
export function textModelControls(s:State){
 return {status:!s.selected?'Not configured':s.loaded?'Loaded':s.statusError?'Files unavailable':s.present?'Files present':s.custom?'Local files required':'Not prepared',verify:s.selected&&s.present&&!s.statusError&&!s.busy,prepare:s.selected&&!s.custom&&!s.present&&!s.statusError&&!s.loaded&&!s.busy&&s.downloads,setup:s.selected&&!s.custom&&!s.present&&!s.statusError&&!s.loaded&&!s.busy&&!s.downloads,load:s.selected&&s.present&&!s.statusError&&!s.loaded&&!s.busy,unload:s.loaded&&!s.busy,importFiles:s.selected&&!s.busy,retry:!!s.selected&&!!s.statusError&&!s.loaded&&!s.busy};
}
