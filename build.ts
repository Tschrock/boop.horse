import { promises as fs } from 'fs'
import * as esbuild from 'esbuild'

(async () => {
    await fs.cp('./static', './build', { recursive: true })
    await esbuild.build({
        entryPoints: ['./src/main.ts'],
        bundle: true,
        minify: true,
        outfile: './build/src/main.js',
    })
})().catch(console.error)
