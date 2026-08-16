const fs = require('fs');
let code = fs.readFileSync('src/LabResearchAgent.tsx', 'utf-8');

// 1. Modify handleGenerateGaps signature and usage
code = code.replace(
  /const handleGenerateGaps = async \(\) => \{/g,
  'const handleGenerateGaps = async (bypassed: boolean | React.MouseEvent = false) => {\n    const isBypassed = bypassed === true;'
);

code = code.replace(
  /if \(parsed\.gaps && Array\.isArray\(parsed\.gaps\)\) \{/g,
  'if (parsed.gaps && Array.isArray(parsed.gaps)) {\n        const finalGaps = parsed.gaps.map((g: any) => ({ ...g, isBypassedSynthesis: isBypassed }));\n        parsed.gaps = finalGaps;'
);

// 2. Modify the Bypass button to pass true
code = code.replace(
  /<button onClick=\{handleGenerateGaps\} className="text-xs font-bold text-red-500 border border-red-500\/50 px-4 py-2 rounded-lg hover:bg-red-500\/10">Bypass & Force Synthesis<\/button>/g,
  '<button onClick={() => handleGenerateGaps(true)} className="text-xs font-bold text-red-500 border border-red-500/50 px-4 py-2 rounded-lg hover:bg-red-500/10">Bypass & Force Synthesis</button>'
);

// 3. Add the UI banner to the Gap card
const gapDisplayTarget = `<div className="flex gap-4 mb-3">
                              <div className="pt-1 shrink-0">`;
const gapDisplayReplacement = `{gap.isBypassedSynthesis && (
                              <div className="mb-3 p-2 bg-red-900/10 border border-red-500/30 rounded flex items-center gap-2 text-red-500 text-xs font-bold uppercase">
                                <AlertTriangle className="w-4 h-4 shrink-0" />
                                Generated from an evidence pool flagged as insufficient — use with caution
                              </div>
                            )}
                            <div className="flex gap-4 mb-3">
                              <div className="pt-1 shrink-0">`;
code = code.replace(gapDisplayTarget, gapDisplayReplacement);

// 4. Update the protocol state to carry the flag
// I need to find where protocol state is set. handleGenerateProtocol
const protocolSetTarget = `setProtocol({ text: res, template: templateMatch });`;
const protocolSetReplacement = `setProtocol({ text: res, template: templateMatch, isBypassedSynthesis: selectedGap?.isBypassedSynthesis || false } as any);`;
code = code.replace(protocolSetTarget, protocolSetReplacement);

fs.writeFileSync('src/LabResearchAgent.tsx', code);
console.log("Patched");
