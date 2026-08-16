const fs = require('fs');
let code = fs.readFileSync('src/LabResearchAgent.tsx', 'utf-8');

code = code.replace(
  /<SectionCard title="Automated Literature Fetch & Meta-Analysis" className="!p-8">/g,
  '<SectionCard title="Automated Literature Meta-Analysis" className="!p-8">'
);

code = code.replace(
  /<p className="text-sm text-\[var\(--text-secondary\)\] mb-6\">Fetch the most relevant recent papers and automatically perform a thematic synthesis\.<\/p>/g,
  '<p className="text-sm text-[var(--text-secondary)] mb-6">Automatically perform a thematic synthesis and meta-analysis on the screened evidence pool.</p>'
);

code = code.replace(
  /Fetch Literature & Synthesize/g,
  'Synthesize Literature'
);

code = code.replace(
  /result: \{ name: 'Automated Meta-Analysis', p: 0\.001, stat: data\.data\.length, df: 'Papers' \}/g,
  'result: { name: \'Automated Meta-Analysis\', p: 0.001, stat: includedDocs.length, df: \'Papers\' }'
);

fs.writeFileSync('src/LabResearchAgent.tsx', code);
console.log("Patched button text and stats");
