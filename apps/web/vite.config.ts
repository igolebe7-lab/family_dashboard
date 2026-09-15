import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  // Calendar fixtures use Amsterdam wall time; CI runners otherwise default to UTC.
  if (mode === 'test') process.env.TZ = 'Europe/Amsterdam';
  return {
  envPrefix: ['VITE_', 'PUBLIC_'],
  server: { proxy: { '/api': 'http://127.0.0.1:8090' } },
  preview: { proxy: { '/api': 'http://127.0.0.1:8090' } },
  plugins: [tailwindcss(), sveltekit()],
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,js}']
  }
  };
});
