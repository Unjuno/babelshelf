export function parseInstalledPwaArguments(args){
 const values=[...args];
 const retainProfile=values.includes('--retain-profile');
 const positional=values.filter(value=>value!=='--retain-profile');
 if(positional.some(value=>value.startsWith('--')))throw Error('Unknown installed-PWA option');
 if(positional.length>2)throw Error('Usage: installed-pwa.mjs [NEW_PROFILE] [NEW_OUTPUT] [--retain-profile]');
 const [profileArg,outputArg]=positional;
 if(retainProfile&&!profileArg)throw Error('--retain-profile requires an explicit new profile path');
 return {profileArg,outputArg,retainProfile};
}

export function shouldRemoveInstalledPwaProfile({profileWasAbsentBeforeRun,retainProfile}){
 return profileWasAbsentBeforeRun===true&&retainProfile!==true;
}
