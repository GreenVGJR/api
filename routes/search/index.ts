import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const routes: any[] = [];

const files = fs.readdirSync(__dirname).filter(file => 
    (file.endsWith('.ts') || file.endsWith('.js')) && 
    !file.startsWith('index.')
);

for (const file of files) {
    const module = await import(`./${file}`);
    if (module.default) {
        routes.push(module.default);
    }
}

export default routes;
