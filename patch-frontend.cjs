const fs = require('fs');
let code = fs.readFileSync('src/LabResearchAgent.tsx', 'utf-8');

// 1. Add state
const stateHook = "const [reviewerFeedback, setReviewerFeedback] = useState<any>(null);";
if (!code.includes("setReviewerFeedback")) {
    code = code.replace(
        "const [topicSaturation, setTopicSaturation] = useState<any>(null);",
        "const [topicSaturation, setTopicSaturation] = useState<any>(null);\n  const [reviewerFeedback, setReviewerFeedback] = useState<any>(null);"
    );
}

// 2. Add handleReviewAndGenerateGaps
const newMethods = `
  const handleReviewAndGenerateGaps = async () => {
    if (evidencePool.filter(d => d.included).length === 0) return setError("No included papers to analyze.");
    setError('');
    setLoading(true);
    setReviewerFeedback(null);
    try {
      const includedDocs = evidencePool.filter(d => d.included);
      const litContext = includedDocs.map((d: any) => \`ID: \${d.uid} | Title: \${d.title} (\${d.pubdate}, \${d.origin}) | Abstract: \${d.abstract}\`).join('\\n\\n');

      const prompt = \`Act as an expert medical research reviewer.
      The user is planning a study on "\${formData.topic}" in "\${formData.population}" in the \${formData.labSection} department.
      
      Here is the fetched, screened "Included" evidence pool:
      \${litContext}
      
      Does this specific set of Included papers contain enough substantively relevant content to support meaningful, non-hallucinated gap analysis for the stated Research Topic, Patient Population, and Laboratory Section? 
      Be strict: if they only mention the topic in passing, or miss the population entirely, mark sufficient as false.
      
      Format EXACTLY as a JSON object:
      {
        "sufficient": boolean,
        "reasoning": "Detailed explanation of why the literature is sufficient or what is specifically missing",
        "missingAspects": ["List of missing aspects, optional"],
        "suggestedExclusionsToReinclude": ["List of UIDs from excluded papers that might help, if you had access to them, optional"]
      }\`;

      const res = await callGemini(prompt, { webSearch: false, highThinking: true, schemaId: 'literature-reviewer' });
      const parsed = JSON.parse(res);
      
      if (parsed.sufficient) {
         // Auto-proceed to synthesis
         await handleGenerateGaps();
      } else {
         setReviewerFeedback(parsed);
         setLoading(false);
      }
    } catch (err: any) {
      setError("Review phase failed: " + err.message);
      setLoading(false);
    }
  };

  const handleGenerateGaps = async () => {`;

code = code.replace("const handleGenerateGaps = async () => {", newMethods);

// 3. Reset state on load
code = code.replace(
    "setTopicSaturation(p.topicSaturation || null);",
    "setTopicSaturation(p.topicSaturation || null);\n    setReviewerFeedback(p.reviewerFeedback || null);"
);

code = code.replace(
    "setTopicSaturation(null);",
    "setTopicSaturation(null);\n    setReviewerFeedback(null);"
);

// 4. Update the UI
// Find the <PrimaryButton onClick={handleGenerateGaps}
const oldBtn = "<PrimaryButton onClick={handleGenerateGaps} icon={Search}>Generate Gaps from Included Papers</PrimaryButton>";
const newBtn = `
                        {reviewerFeedback && !reviewerFeedback.sufficient && (
                          <div className="bg-red-900/10 border border-red-500/30 rounded-2xl p-6 mb-8 shadow-lg text-left max-w-2xl mx-auto">
                             <div className="flex items-center gap-3 mb-4 text-red-500">
                               <AlertTriangle className="w-6 h-6" />
                               <h3 className="font-bold uppercase tracking-widest text-sm">Insufficient Evidence Pool</h3>
                             </div>
                             <p className="text-sm text-[var(--text-primary)] mb-4">{reviewerFeedback.reasoning}</p>
                             {reviewerFeedback.missingAspects && reviewerFeedback.missingAspects.length > 0 && (
                               <div className="mb-4">
                                 <strong className="text-xs text-[var(--text-muted)] uppercase">Missing Aspects:</strong>
                                 <ul className="list-disc pl-5 text-sm text-[var(--text-primary)] mt-1">
                                   {reviewerFeedback.missingAspects.map((a: string, i: number) => <li key={i}>{a}</li>)}
                                 </ul>
                               </div>
                             )}
                             <div className="mt-4 pt-4 border-t border-red-500/20 flex gap-4">
                               <button onClick={() => setReviewerFeedback(null)} className="text-xs font-bold text-[var(--text-primary)] border border-[var(--border-color)] px-4 py-2 rounded-lg hover:bg-[var(--bg-app)]">Acknowledge & Adjust Funnel</button>
                               <button onClick={handleGenerateGaps} className="text-xs font-bold text-red-500 border border-red-500/50 px-4 py-2 rounded-lg hover:bg-red-500/10">Bypass & Force Synthesis</button>
                             </div>
                          </div>
                        )}
                        {!reviewerFeedback && (
                          <PrimaryButton onClick={handleReviewAndGenerateGaps} icon={Search}>Review Evidence & Generate Gaps</PrimaryButton>
                        )}
`;
code = code.replace(oldBtn, newBtn);

fs.writeFileSync('src/LabResearchAgent.tsx', code);
console.log("Patched LabResearchAgent.tsx!");
