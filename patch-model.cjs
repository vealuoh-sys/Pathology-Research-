const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

code = code.replace(/gemini-2\.5-flash/g, 'gemini-flash-latest');
code = code.replace(/gemini-2\.5-pro/g, 'gemini-pro-latest');

fs.writeFileSync('server.ts', code);
console.log("Patched server models");
