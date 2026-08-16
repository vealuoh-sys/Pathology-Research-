const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const target = `        if (!isGroq && groqKey) {
           console.log(\`[Fallback] Primary provider failed (likely quota). Routing request to Groq...\`);`;

const replacement = `        if (false && !isGroq && groqKey) {
           console.log(\`[Fallback] Primary provider failed (likely quota). Routing request to Groq...\`);`;

code = code.replace(target, replacement);
fs.writeFileSync('server.ts', code);
console.log("Patched server to disable Groq fallback");
