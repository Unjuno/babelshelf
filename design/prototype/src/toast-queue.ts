export type ToastNotice={text:string;undoId?:string;expiresAt?:number};

/** Undo actions expire from the time of deletion, even while another notice is visible. */
export function expireUndoNotices(queue:ToastNotice[],now=Date.now()):ToastNotice[]{
 return queue.filter(notice=>!notice.undoId||!Number.isFinite(notice.expiresAt)||notice.expiresAt!>now);
}

export function nextUndoExpiry(queue:ToastNotice[]):number|undefined{
 const deadlines=queue.filter(notice=>!!notice.undoId&&Number.isFinite(notice.expiresAt)).map(notice=>notice.expiresAt!);
 return deadlines.length?Math.min(...deadlines):undefined;
}
