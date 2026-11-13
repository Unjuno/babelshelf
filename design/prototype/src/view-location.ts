export type Page='input'|'memory'|'schedule'|'notifications'|'settings';
export type SettingsPanel='models'|'media'|'appearance'|'connection'|'files'|'diagnostics'|'agent'|'tools'|'feedback'|'help'|'licenses';
const pages=new Set<Page>(['input','memory','schedule','notifications','settings']);
const panels=new Set<SettingsPanel>(['models','media','appearance','connection','files','diagnostics','agent','tools','feedback','help','licenses']);
const key='babelshelf.view-location.v1';
export function readViewLocation():{page:Page;panel:SettingsPanel|null}{
 try{const value=JSON.parse(sessionStorage.getItem(key)??'null');if(value&&pages.has(value.page))return {page:value.page,panel:value.page==='settings'&&panels.has(value.panel)?value.panel:null};}catch{/* Storage may be unavailable or contain stale data. */}
 return {page:'input',panel:null};
}
export function saveViewLocation(page:Page,panel:SettingsPanel|null){try{sessionStorage.setItem(key,JSON.stringify({page,panel:page==='settings'?panel:null}));}catch{/* Navigation continues when session storage is unavailable. */}}
