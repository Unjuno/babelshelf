import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
export default defineConfig({root:fileURLToPath(new URL('./product',import.meta.url)),resolve:{alias:[{find:'./mobile',replacement:fileURLToPath(new URL('./product/native-mobile.tsx',import.meta.url))}]},plugins:[react()],build:{outDir:'../dist/app',emptyOutDir:true},server:{host:'127.0.0.1'}});
