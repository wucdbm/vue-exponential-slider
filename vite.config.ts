/// <reference types="vitest" />
import { defineConfig } from 'vite'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

export default defineConfig({
    plugins: [
        dts({
            rollupTypes: true,
            include: ['src'],
        }),
    ],
    build: {
        minify: false,
        copyPublicDir: false,
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            formats: ['es'],
        },
        rollupOptions: {
            external: [
                // Node Builtins
                'node:path',
                'node:http',
                'node:fs',
                // Libs
                '@unhead/ssr',
                '@unhead/vue',
                '@unhead/head',
                'chalk',
                'connect',
                'node-fetch',
                'vite',
                'vue',
                '@vue/server-renderer',
                'vue-router',
            ],
            output: {
                assetFileNames: 'assets/[name][extname]',
                entryFileNames: '[name].js',
            },
        },
    },
    resolve: {
        alias: {
            '@': resolve('src/'),
        },
    },
    define: {
        // https://vitest.dev/guide/in-source.html
        // For the production build, you will need to set the define options in your config file,
        // letting the bundler do the dead code elimination.
        'import.meta.vitest': 'undefined',
    },
    // @ts-expect-error I rly CBA
    test: {
        // globals: true,
        // environment: 'jsdom',
        includeSource: ['src/**/*.{js,ts}'],
        include: ['./src/**/*.spec.ts'],
    },
})
