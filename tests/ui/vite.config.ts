import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
export default defineConfig({plugins:[react()],resolve:{alias:{'@clerk/react':path.resolve('tests/ui/clerk-fixture.tsx'),'@':path.resolve('src')}},server:{host:'127.0.0.1',port:5178,strictPort:true,proxy:{'/api':{target:'http://127.0.0.1:3018',changeOrigin:true},'/uploads':{target:'http://127.0.0.1:3018',changeOrigin:true}}}})
