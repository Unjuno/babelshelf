import {defineConfig} from '@playwright/test';

const port=Number(process.env.PRODUCT_WORKING_FILE_TEST_PORT??4186);
export default defineConfig({
 testDir:'./tests',
 testMatch:['working-file-context.spec.ts'],
 workers:1,
 timeout:60_000,
 use:{baseURL:`http://127.0.0.1:${port}`,viewport:{width:390,height:844}},
 webServer:{command:`npm run dev:app -- ${port}`,cwd:'../..',url:`http://127.0.0.1:${port}/`,reuseExistingServer:false,timeout:30_000},
});
