const fs = require('fs');
let code = fs.readFileSync('src/LabResearchAgent.tsx', 'utf-8');

// Fix 1: Screening Prompt
const promptTarget = `Screen these papers for relevance to the specific topic, patient population, and laboratory section.`;
const promptReplacement = `Screen these papers for relevance. 
        CRITICAL INCLUSION RULE: You must INCLUDE any paper that is a foundational guideline, consensus statement, or major study directly related to EITHER the primary biomarker (e.g. Troponin) OR the primary condition (e.g. CKD), as these are necessary for background context, even if they do not explicitly mention both components.
        Only exclude papers that are entirely unrelated to both components or tangentially mention them without focusing on them.`;

code = code.replace(promptTarget, promptReplacement);

// Fix 2: Unverified Source matching
const matchTarget = `const sourceDoc = evidencePool.find(d => String(d.uid) === String(prov.uid));`;
const matchReplacement = `const sourceDoc = evidencePool.find(d => String(d.uid) === String(prov.uid) || String(d.uid).includes(String(prov.uid)) || String(prov.uid).includes(String(d.uid)) || (d.doi && String(prov.uid).includes(d.doi)));`;

code = code.replace(matchTarget, matchReplacement);

fs.writeFileSync('src/LabResearchAgent.tsx', code);
console.log("Patched screener and source matching");
