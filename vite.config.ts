import { defineConfig } from 'vitest/config';
export default defineConfig({ base: '/poses-3d/', server: { host: '127.0.0.1' }, test: { environment: 'node', exclude: ['e2e/**', 'node_modules/**'] } });
