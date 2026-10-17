// IME boundary keydown may have isComposing=false while still reporting229.
export function isSubmitKey(event){return event.key==='Enter'&&!event.shiftKey&&!event.isComposing&&event.keyCode!==229;}
