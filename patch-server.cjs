const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const target = `      // Select Provider and Model
      if (geminiKey && (webSearch || highThinking || !groqKey)) {`;

const replacement = `      // Select Provider and Model
      if (geminiKey && (webSearch || highThinking || schemaId === 'screening-funnel' || !groqKey)) {`;

code = code.replace(target, replacement);
fs.writeFileSync('server.ts', code);
console.log("Patched server to force Gemini for screening");
