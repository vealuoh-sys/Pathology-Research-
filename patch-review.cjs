const fs = require('fs');
let code = fs.readFileSync('src/LabResearchAgent.tsx', 'utf-8');

const target1 = /const includedDocs = evidencePool\.filter\(d => d\.included\);\s*const litContext = includedDocs\.map\(\(d: any\) => \`ID: \$\{d\.uid\} \| Title: \$\{d\.title\} \(\$\{d\.pubdate\}, \$\{d\.origin\}\) \| Abstract: \$\{d\.abstract\}\`\)\.join\('\\n\\n'\);/g;

const replacement1 = `let includedDocs = evidencePool.filter(d => d.included);
      // Sort by citations if available to prioritize high-impact papers, then cap to avoid token limit
      includedDocs.sort((a, b) => (b.citations || 0) - (a.citations || 0));
      const MAX_PAPERS = 25;
      if (includedDocs.length > MAX_PAPERS) {
        includedDocs = includedDocs.slice(0, MAX_PAPERS);
      }
      const litContext = includedDocs.map((d: any) => \`ID: \${d.uid} | Title: \${d.title} (\${d.pubdate}, \${d.origin}) | Abstract: \${d.abstract?.substring(0, 500) || "No abstract"}\`).join('\\n\\n');`;

code = code.replace(target1, replacement1);

fs.writeFileSync('src/LabResearchAgent.tsx', code);
console.log("Review patched");
