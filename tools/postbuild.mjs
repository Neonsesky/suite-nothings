// Copies dist/index.html → dist/404.html (GitHub Pages safety net for stray paths).
import { copyFileSync, existsSync } from 'node:fs';
if (existsSync('dist/index.html')) copyFileSync('dist/index.html', 'dist/404.html');
