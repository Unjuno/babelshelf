import {defineConfig} from '@playwright/test';

const port=Number(process.env.EDITOR_TEST_PORT??4187);
export default defineConfig({
 testDir:'./tests',testMatch:'memory-editor-navigation.spec.ts',workers:1,timeout:30_000,
 use:{baseURL:`http://127.0.0.1:${port}`,viewport:{width:390,height:844}},
 webServer:{command:`npm run dev:app -- ${port}`,cwd:'../..',url:`http://127.0.0.1:${port}/`,reuseExistingServer:false},
});
