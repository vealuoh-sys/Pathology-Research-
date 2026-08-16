const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

code = code.replace(/\/api\/completion/g, '/api/generate');

fs.writeFileSync('server.ts', code);
console.log("Patched server.ts with /api/generate");
