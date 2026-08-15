const fs = require('fs');

let clientCode = fs.readFileSync('src/LabResearchAgent.tsx', 'utf-8');

// Update callGemini definition
clientCode = clientCode.replace(
  /async function callGemini\(prompt: string, opts: \{ system\?: string, webSearch\?: boolean, highThinking\?: boolean \} = \{\}\) \{/,
  "async function callGemini(prompt: string, opts: { system?: string, webSearch?: boolean, highThinking?: boolean, schemaId?: string } = {}) {"
);

// Update fetch call body
clientCode = clientCode.replace(
  /body: JSON\.stringify\(\{ prompt, system: opts\.system, webSearch: opts\.webSearch, highThinking: opts\.highThinking \}\)/,
  "body: JSON.stringify({ prompt, system: opts.system, webSearch: opts.webSearch, highThinking: opts.highThinking, schemaId: opts.schemaId })"
);

// Fix Screening call (near line 582)
// Old: const res = await callGemini(prompt, { webSearch: false, highThinking: false });
//      const cleanRes = res.replace(/```json/g, '').replace(/```/g, '').trim();
//      const parsed = JSON.parse(cleanRes);
clientCode = clientCode.replace(
  /const res = await callGemini\(prompt, \{ webSearch: false, highThinking: false \}\);\s+const cleanRes = res\.replace\(\/```json\/g, ''\)\.replace\(\/```\/g, ''\)\.trim\(\);\s+const parsed = JSON\.parse\(cleanRes\);/g,
  "const res = await callGemini(prompt, { webSearch: false, highThinking: false, schemaId: 'screening-funnel' });\n      const parsed = JSON.parse(res);"
);

// Fix Gap synthesis call (near line 645)
clientCode = clientCode.replace(
  /const res = await callGemini\(prompt, \{ webSearch: false, highThinking: true \}\);\s+const cleanRes = res\.replace\(\/```json\/g, ''\)\.replace\(\/```\/g, ''\)\.trim\(\);\s+const parsed = JSON\.parse\(cleanRes\);/g,
  "const res = await callGemini(prompt, { webSearch: false, highThinking: true, schemaId: 'gap-synthesis' });\n      const parsed = JSON.parse(res);"
);

// Fix Refinement pass call (near line 847)
clientCode = clientCode.replace(
  /const res = await callGemini\(prompt, \{ highThinking: true \}\);\s+const cleanRes = res\.replace\(\/```json\/g, ''\)\.replace\(\/```\/g, ''\)\.trim\(\);\s+const parsed = JSON\.parse\(cleanRes\);/g,
  "const res = await callGemini(prompt, { highThinking: true, schemaId: 'refinement-pass' });\n      const parsed = JSON.parse(res);"
);

fs.writeFileSync('src/LabResearchAgent.tsx', clientCode);
