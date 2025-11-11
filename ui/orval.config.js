import { defineConfig } from 'orval';

export default defineConfig({
  api: {
    input: {
      target: '../openapi.yaml',
    },
    output: {
      mode: 'single',
      target: './src/api/client.ts',
      client: 'axios',
      mock: false,
      override: {
        mutator: {
          path: './src/api/axios-instance.ts',
          name: 'customInstance',
        },
      },
    },
  },
});
