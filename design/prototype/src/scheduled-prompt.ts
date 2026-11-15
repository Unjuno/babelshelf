/** Remove only the bounded audit labels used when replaying a schedule test.
 * These labels are metadata, not part of the model's requested task. */
export function schedulePromptBody(prompt:string){
 const trimmed=prompt.trim();
 const labelled=trimmed.match(/^(?:R\d{1,3}\s+)?run\s+(?:test\s+\d{1,3}|[a-z])\s*[—–:-]\s*(.{1,160})$/iu)
  ??trimmed.match(/^(?:R\d{1,3}\s*[—–:-]\s*)(.{1,160})$/iu);
 return labelled?.[1]?.trim()||prompt;
}
