const fs = require('fs');
let code = fs.readFileSync('src/LabResearchAgent.tsx', 'utf-8');

const target = `      if (flags.length > 0) {
        setRefinementFlags(flags.map((f: any) => ({ ...f, resolved: false })));
      } else {`;

const replacement = `      if (selectedGap?.isBypassedSynthesis) {
        flags.push({
          id: 'bypassed-synthesis-flag',
          quote: "Entire manuscript derived from bypassed evidence pool",
          issue: "This gap analysis was generated using an evidence pool flagged as insufficient. Use extreme caution and manually verify all claims.",
          type: "reasoning shortcut",
          section: "discussion"
        });
      }

      if (flags.length > 0) {
        setRefinementFlags(flags.map((f: any) => ({ ...f, resolved: false })));
      } else {`;

code = code.replace(target, replacement);
fs.writeFileSync('src/LabResearchAgent.tsx', code);
console.log("Patched refinement pass");
