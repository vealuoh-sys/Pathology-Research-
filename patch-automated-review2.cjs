const fs = require('fs');
let code = fs.readFileSync('src/LabResearchAgent.tsx', 'utf-8');

const target = `      // Reuse the screened evidence pool instead of fetching from scratch
      setLiteratureData(includedDocs);`;

const replacement = `      // Reuse the screened evidence pool instead of fetching from scratch
      const formattedDocs = includedDocs.map(d => ({
        ...d,
        year: d.pubdate,
        citationCount: d.citations,
        authors: d.authors || [] // OpenAlex provides authors, PubMed didn't directly in this subset
      }));
      setLiteratureData(formattedDocs);`;

code = code.replace(target, replacement);
fs.writeFileSync('src/LabResearchAgent.tsx', code);
console.log("Patched UI mapping for automated review");
