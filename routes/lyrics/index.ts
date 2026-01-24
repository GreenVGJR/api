import fs from 'fs';
import path from 'path';

const routes: any[] = [];

const files = fs.readdirSync(import.meta.dir);

for (const file of files) {
    if (file.endsWith('.ts') && file !== 'index.ts' && file !== 'request.ts') {
        // @ts-ignore
        const route = require(path.join(import.meta.dir, file));
        routes.push(route.default || route);
    }
}

export default routes;
