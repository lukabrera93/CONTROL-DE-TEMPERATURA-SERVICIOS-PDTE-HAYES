import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';

function inlineSingleFilePlugin(): Plugin {
  return {
    name: 'inline-single-file-offline',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const htmlAsset = bundle['standalone.html'];
      if (!htmlAsset || htmlAsset.type !== 'asset') return;

      let html = String(htmlAsset.source);
      const cssTags: string[] = [];
      const scriptContents: string[] = [];

      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type === 'asset' && fileName.endsWith('.css')) {
          const safeCss = String(chunk.source).replace(/<\/style>/gi, '<\\/style>');
          cssTags.push(`<style>${safeCss}</style>`);
          delete bundle[fileName];
        } else if (chunk.type === 'chunk' && chunk.isEntry) {
          scriptContents.push(chunk.code);
          delete bundle[fileName];
        }
      }

      // Remove Vite-generated stylesheet/script tags referencing external files
      html = html.replace(/<link[^>]+rel="stylesheet"[^>]*>/g, '');
      html = html.replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, '');

      // Inject inlined CSS into </head> using a function replacer (prevents $' / $& corruption)
      const allCss = cssTags.join('\n');
      html = html.replace('</head>', () => `${allCss}\n</head>`);

      // Escape </script and <!-- so the HTML5 parser never breaks out or enters double-escaped mode
      const safeScripts = scriptContents
        .map((code) => {
          const escaped = code
            .replace(/<\/script/gi, '<\\/script')
            .replace(/<!--/g, '<\\!--');
          return `<script>${escaped}</script>`;
        })
        .join('\n');

      html = html.replace('</body>', () => `${safeScripts}\n</body>`);

      htmlAsset.source = html;
      htmlAsset.fileName = 'ControlTerm_App_Completa.html';
    },
  };
}

export default defineConfig({
  mode: 'production',
  plugins: [react(), tailwindcss(), inlineSingleFilePlugin()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, '.'),
    },
  },
  build: {
    outDir: 'dist-standalone',
    emptyOutDir: true,
    copyPublicDir: false,
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    rollupOptions: {
      input: path.resolve(import.meta.dirname, 'standalone.html'),
      output: {
        format: 'iife',
        inlineDynamicImports: true,
        entryFileNames: 'bundle.js',
      },
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  logLevel: 'warn',
});
