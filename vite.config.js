import { defineConfig } from 'vite';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SCRIPT_ORDER = [
  'js/config.js',
  'js/state.js',
  'js/utils.js',
  'js/storage.js',
  'js/theme.js',
  'js/electron.js',
  'js/ui.js',
  'js/groups.js',
  'js/todos.js',
  'js/selects.js',
  'js/calendar.js',
  'js/finance.js',
  'js/ideas.js',
  'js/search.js',
  'js/archive.js',
  'js/repeat.js',
  'js/habits.js',
  'js/projects.js',
  'js/batch.js',
  'js/notifications.js',
  'js/dragdrop.js',
  'js/templates.js',
  'js/stats.js',
  'js/pomodoro.js',
  'js/shortcuts.js',
  'js/mindmap.js',
  'js/drinks.js',
  'js/daily-plans.js',
  'js/import-export.js',
  'js/app.js',
  'js/pubsub.js',
  'js/sync.js',
];

function concatPlugin() {
  const virtualModuleId = 'virtual:app-bundle';
  const resolvedVirtualModuleId = '\0' + virtualModuleId;

  return {
    name: 'concat-scripts',
    resolveId(id) {
      if (id === virtualModuleId) return resolvedVirtualModuleId;
    },
    load(id) {
      if (id !== resolvedVirtualModuleId) return null;
      const parts = SCRIPT_ORDER.map(f => {
        const content = readFileSync(resolve(__dirname, f), 'utf-8');
        return `// === ${f} ===\n${content}`;
      });
      return parts.join('\n\n');
    },
    handleHotUpdate({ file, server }) {
      if (file.endsWith('.js') && file.includes('/js/')) {
        server.ws.send({ type: 'full-reload' });
      }
    }
  };
}

export default defineConfig({
  plugins: [concatPlugin()],
  build: {
    outDir: 'dist/web',
    rollupOptions: {
      input: 'index.html',
      external: ['electron', 'fs', 'path']
    }
  },
  server: {
    port: 3000,
    open: true
  }
});
