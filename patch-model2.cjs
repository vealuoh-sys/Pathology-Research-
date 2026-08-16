const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

code = code.replace(/gemini-flash-latest/g, 'gemini-3.5-flash');
code = code.replace(/gemini-pro-latest/g, 'gemini-3.5-flash'); // let's just use 3.5 flash for everything if pro is slow.

fs.writeFileSync('server.ts', code);
console.log("Patched server models 2");
