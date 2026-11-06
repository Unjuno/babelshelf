import {createRoot} from 'react-dom/client';
import {useState} from 'react';
import {ScheduleScreen} from '../src/ScheduleScreen';
import {useTasks,type TaskView} from '../src/useTasks';

const phase=new URLSearchParams(location.search).get('phase')??'running';
const schedule={
 id:'fixture-schedule',title:'Check the emergency kit',version:1,
 path:'Schedule/2026-10-23-fixture-schedule.md',nextAt:'2026-10-24T00:00:00.000Z',
 repeat:'once',time:'09:00',days:[],date:'2026-10-24',monthDay:1,interval:1,
 unit:'days',timezone:'Asia/Tokyo',enabled:false,notify:true,prompt:'Check the emergency kit',
} as TaskView;

function PollFixture(){
 const [calls,setCalls]=useState(0),[pending,setPending]=useState<null|{finish:()=>void;fail:()=>void}>(null);
 const tasks=useTasks([],true,false,()=>new Promise((resolve,reject)=>{setCalls(value=>value+1);setPending({finish:()=>{setPending(null);resolve([]);},fail:()=>{setPending(null);reject(Error('Fixture read failed'));}});}),async()=>({answer:'unused',sources:[]}));
 return <main><p>Reads started: {calls}</p><p>{tasks.error}</p><button onClick={()=>document.dispatchEvent(new Event('visibilitychange'))}>Trigger poll</button><button disabled={!pending} onClick={()=>pending?.finish()}>Finish read</button><button disabled={!pending} onClick={()=>pending?.fail()}>Fail read</button></main>;
}

createRoot(document.getElementById('root')!).render(phase==='poll'?<PollFixture/>:<ScheduleScreen
 schedules={[schedule]}
 active={schedule.id}
 stopping={phase==='stopping'}
 finishing={phase==='saving'}
 errors={[]}
 statusLabel={()=> 'Running'}
 onNew={()=>{}}
 onEdit={()=>{}}
 onToggle={()=>{}}
 onActions={()=>{}}
 onStop={()=>{}}
/>);
