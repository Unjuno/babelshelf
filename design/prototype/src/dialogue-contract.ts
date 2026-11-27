import type {FileResult} from './file-discovery.ts';
import type {Activity} from './harness-activity.ts';
import type {InputReadingRef} from './input-reading-contract.ts';
import type {OriginalRef} from './original-assets.ts';
import type {SourceMetadataGuard} from './note-provenance.ts';
import type {SourceRef} from './source-reference-contract.ts';
import type {TextToolReceipt} from './text-transform-contract.ts';
import type {VoiceInput} from './voice-input-contract.ts';
import type {WorkingFile} from './working-file-contract.ts';

export type DialogueOutcome={status:string}|{omitted:true};
export type DialogueTurn={id:string;user:string;answer?:string;status?:string;refs?:SourceRef[];sourceMetadataGuards?:SourceMetadataGuard[];results?:SourceRef[];files?:FileResult[];readTurn?:{turnId:string;index:number;speaker:string};toolCalls?:TextToolReceipt[];activity?:Activity[];attachments?:{id:string;name:string;kind:string;status:string;size?:number;asset?:OriginalRef;voice?:VoiceInput;reading?:InputReadingRef}[]};
export type Dialogue={schema:1;revision:number;turns:DialogueTurn[];compaction:{through:number;summary:string}|null;currentResult?:{turnId:string};currentFile?:WorkingFile};
export type DialogueContext={outcomeOnly?:true;historyAssistantIndices?:number[];summary:string;recent:DialogueTurn[];refs:SourceRef[];turnCount?:number;lastAnswerIndex?:number;currentResult?:{turnId:string};currentFile?:WorkingFile;selectedOriginal?:{speaker:'user'|'assistant';text:string};recalled?:{turnId:string;turnIndex:number;speaker?:string;quote:string;start:number;end:number;outcome?:DialogueOutcome}[]};
