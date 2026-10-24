import {createRoot} from 'react-dom/client';
import {ScheduleScreen} from '../src/ScheduleScreen';
import type {TaskView} from '../src/useTasks';

const phase=new URLSearchParams(location.search).get('phase')??'running';
const schedule={
 id:'fixture-schedule',title:'Check the emergency kit',version:1,
 path:'Schedule/2026-10-23-fixture-schedule.md',nextAt:'2026-10-24T00:00:00.000Z',
 repeat:'once',time:'09:00',days:[],date:'2026-10-24',monthDay:1,interval:1,
 unit:'days',timezone:'Asia/Tokyo',enabled:false,notify:true,prompt:'Check the emergency kit',
} as TaskView;

createRoot(document.getElementById('root')!).render(<ScheduleScreen
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
