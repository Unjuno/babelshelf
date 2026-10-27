import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests',testMatch:['editorial-appearance.spec.ts'],workers:1,timeout:30000,use:{baseURL:'http://127.0.0.1:4185',viewport:{width:320,height:700}},webServer:{command:'npm run dev:app -- 4185',cwd:'../..',url:'http://127.0.0.1:4185/',reuseExistingServer:false,timeout:30000}});
