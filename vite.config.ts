import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { runtimeGatewayPlugin } from './src/server/runtimeGateway.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), runtimeGatewayPlugin()],
})
