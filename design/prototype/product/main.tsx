import ReactDOM from 'react-dom/client';
import Prototype from '../src/Prototype';
import {NativeViewport} from './native-mobile';
import '../src/prototype.css';
import './product.css';
ReactDOM.createRoot(document.getElementById('root')!).render(<div className="device-screen product-screen" id="app-screen" data-testid="device-screen"><div className="mobile-app-viewport"><NativeViewport><Prototype/></NativeViewport></div></div>);
if('serviceWorker' in navigator)navigator.serviceWorker.getRegistration().then(existing=>existing??navigator.serviceWorker.register('./sw.js')).catch(error=>console.error('Offline preparation failed',error));
