import {defineConfig} from '@playwright/test';

const port=Number(process.env.DEVICE_TEST_PORT??4182);

export default defineConfig({
 testDir:'./tests',
 testMatch:['device-diagnostics-ui.spec.ts'],
 // Keep the device handoff preflight deterministic. Parallel isolated-IDB and
 // reload probes can starve the one-run continuation test on constrained PCs.
 workers:1,
 timeout:30_000,
 use:{
  baseURL:`http://127.0.0.1:${port}`,
  viewport:{width:390,height:844},
  isMobile:true,
  hasTouch:true,
 },
 webServer:{
  command:`npm run dev:app -- ${port}`,
  cwd:'../..',
  url:`http://127.0.0.1:${port}/`,
  reuseExistingServer:false,
  timeout:30_000,
 },
});
