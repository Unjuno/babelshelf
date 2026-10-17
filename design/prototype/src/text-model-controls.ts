type State={selected:boolean;custom:boolean;present:boolean;loaded:boolean;busy:boolean;downloads:boolean};
// Registration alone never enables execution or acquisition of custom weights.
export function textModelControls(s:State){
 return {status:!s.selected?'Not configured':s.loaded?'Loaded':s.present?'Verified':s.custom?'Local files required':'Not prepared',prepare:s.selected&&!s.custom&&!s.present&&!s.loaded&&!s.busy&&s.downloads,load:s.selected&&s.present&&!s.loaded&&!s.busy,unload:s.loaded&&!s.busy,importFiles:s.selected&&!s.busy};
}
