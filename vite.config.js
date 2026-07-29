import { defineConfig } from 'vite';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
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

function readClassicBundle() {
  return SCRIPT_ORDER.map(file => {
    const content = readFileSync(resolve(__dirname, file), 'utf-8');
    return `// === ${file} ===\n${content}`;
  }).join('\n\n');
}

function classicBundlePlugins() {
  return [
    {
      name: 'strip-electron-classic-scripts',
      transformIndexHtml: {
        order: 'pre',
        handler(html) {
          // The source HTML keeps synchronous files for Electron/direct access.
          // The transformed Web HTML receives one equivalent classic bundle.
          return html.replace(
            /^\s*<script\s+src=["']\.\/js\/[^"']+["']\s*><\/script>\s*$/gmi,
            ''
          );
        }
      }
    },
    {
      name: 'serve-classic-app-bundle',
      transformIndexHtml() {
        return [{
          tag: 'script',
          attrs: { src: './app-bundle.js' },
          injectTo: 'body'
        }];
      },
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          const pathname = String(request.url || '').split('?')[0];
          if (pathname !== '/app-bundle.js') return next();
          response.statusCode = 200;
          response.setHeader('Content-Type', 'text/javascript; charset=utf-8');
          response.end(readClassicBundle());
        });
      },
      writeBundle(outputOptions) {
        const outputDir = resolve(__dirname, outputOptions.dir || 'dist/web');
        const outputAssetsDir = resolve(outputDir, 'assets');
        mkdirSync(outputAssetsDir, { recursive: true });
        writeFileSync(resolve(outputDir, 'app-bundle.js'), readClassicBundle(), 'utf-8');
        copyFileSync(resolve(__dirname, 'sw.js'), resolve(outputDir, 'sw.js'));
        copyFileSync(resolve(__dirname, 'assets/icon_32.png'), resolve(outputAssetsDir, 'icon_32.png'));
        copyFileSync(resolve(__dirname, 'assets/icon_256.png'), resolve(outputAssetsDir, 'icon_256.png'));
      },
      handleHotUpdate({ file, server }) {
        const normalizedFile = file.replace(/\\/g, '/');
        if (file.endsWith('.js') && normalizedFile.includes('/js/')) {
          server.ws.send({ type: 'full-reload' });
        }
      }
    }
  ];
}

export default defineConfig({
  plugins: classicBundlePlugins(),
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
