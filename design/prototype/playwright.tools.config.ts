import {defineConfig} from '@playwright/test';
import device from './playwright.device.config';
const origin=process.env.TOOL_TEST_ORIGIN;
export default defineConfig({...device,webServer:origin?undefined:device.webServer,testMatch:['tool-test-ui.spec.ts','explicit-calculation.spec.ts','working-file-context.spec.ts','memory-search.spec.ts'],timeout:60_000,use:{...device.use,baseURL:origin??device.use?.baseURL,isMobile:false,hasTouch:false}});
