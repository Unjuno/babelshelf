import {initializeOfflineShell} from '../src/offline-shell';
import ReactDOM from 'react-dom/client';
import Prototype from '../src/Prototype';
import {NativeViewport} from './native-mobile';
import '../src/prototype.css';
import './product.css';
const root=ReactDOM.createRoot(document.getElementById('root')!);
const check=new URLSearchParams(location.search).get('check');
if(import.meta.env.DEV&&check==='lfm')import('../src/LfmCheck').then(({default:LfmCheck})=>root.render(<LfmCheck/>));
else if(import.meta.env.DEV&&check==='harness')import('../src/HarnessCheck').then(({default:HarnessCheck})=>root.render(<HarnessCheck/>));
else if(import.meta.env.DEV&&check==='speech')import('../src/SpeechCheck').then(({default:SpeechCheck})=>root.render(<SpeechCheck/>));
else if(import.meta.env.DEV&&check==='decision')import('../src/DecisionCheck').then(({default:DecisionCheck})=>root.render(<DecisionCheck/>));
else root.render(<div className="device-screen product-screen" id="app-screen" data-testid="device-screen"><div className="mobile-app-viewport"><NativeViewport><Prototype/></NativeViewport></div></div>);
// Keep the production cache worker out of Vite previews so it cannot mask current modules.
if(import.meta.env.PROD)void initializeOfflineShell('serviceWorker' in navigator?navigator.serviceWorker:undefined);
