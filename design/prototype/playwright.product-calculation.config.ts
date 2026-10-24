import {defineConfig} from '@playwright/test';

const port=Number(process.env.PRODUCT_CALCULATION_TEST_PORT??4185);

export default defineConfig({
 testDir:'./tests',
 testMatch:['explicit-calculation.spec.ts'],
 workers:1,
 timeout:30_000,
 use:{
  baseURL:`http://127.0.0.1:${port}`,
  viewport:{width:390,height:844},
 },
 webServer:{
  command:`npm run dev:app -- ${port}`,
  cwd:'../..',
  url:`http://127.0.0.1:${port}/`,
  reuseExistingServer:false,
  timeout:30_000,
 },
});
