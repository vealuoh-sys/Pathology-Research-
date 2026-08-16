const fs = require('fs');
let code = fs.readFileSync('src/LabResearchAgent.tsx', 'utf-8');

const target = `<div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                  <div className="xl:col-span-2">`;

const replacement = `{selectedGap?.isBypassedSynthesis && (
                  <div className="mb-6 p-4 bg-red-900/10 border border-red-500/30 rounded-xl flex items-start gap-3 text-red-500 text-sm font-bold">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <div>
                      <p className="uppercase tracking-widest text-[10px] mb-1">Insufficient Evidence Flag</p>
                      <p className="font-normal text-[var(--text-primary)]">This protocol is addressing a gap generated from an insufficient evidence pool. The scientific foundation may be weak. Proceed with caution.</p>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                  <div className="xl:col-span-2">`;

code = code.replace(target, replacement);
fs.writeFileSync('src/LabResearchAgent.tsx', code);
console.log("Patched protocol banner");
