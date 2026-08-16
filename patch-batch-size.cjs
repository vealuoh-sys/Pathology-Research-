const fs = require('fs');
let code = fs.readFileSync('src/LabResearchAgent.tsx', 'utf-8');

code = code.replace(/const BATCH_SIZE = 5;/g, 'const BATCH_SIZE = 15;');
code = code.replace(/await new Promise\(r => setTimeout\(r, 2000\)\);/g, 'await new Promise(r => setTimeout(r, 4500));');

fs.writeFileSync('src/LabResearchAgent.tsx', code);
console.log("Patched BATCH_SIZE to 15 and delay to 4.5s");
