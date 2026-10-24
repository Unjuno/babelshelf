import {defineConfig} from '@playwright/test';
import device from './playwright.device.config';
export default defineConfig({...device,testMatch:['help-licenses.spec.ts'],timeout:60_000,use:{...device.use,isMobile:false,hasTouch:false}});
