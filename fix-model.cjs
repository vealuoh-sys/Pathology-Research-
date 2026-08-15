const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

code = code.replace(/let modelName = "gemini-2.5-flash";/g, 'let modelName = "gemini-3.5-flash";');
code = code.replace(/modelName = "gemini-2.5-flash";/g, 'modelName = "gemini-3.5-flash";');
code = code.replace(/modelName = "gemini-2.5-pro";/g, 'modelName = "gemini-3.1-pro-preview";');

fs.writeFileSync('server.ts', code);
