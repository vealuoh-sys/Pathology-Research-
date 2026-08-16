const fs = require('fs');
let code = fs.readFileSync('src/LabResearchAgent.tsx', 'utf-8');

const target = `  const handleAutomatedReview = async () => {
    if (!formData.topic) return setError("Enter a research topic in Phase 1 first.");
    setError('');
    setLoading(true);
    try {
      const res = await fetch(\`https://api.semanticscholar.org/graph/v1/paper/search?query=\${encodeURIComponent(formData.topic)}&limit=40&fields=title,abstract,year,authors,citationCount\`);
      const data = await res.json();
      
      if (!data.data || data.data.length === 0) {
         throw new Error("No papers found on Semantic Scholar for this topic.");
      }
      
      setLiteratureData(data.data);
      
      const prompt = \`Perform a statistical synthesis and meta-analysis summary of the following \${data.data.length} papers on the topic: "\${formData.topic}". 
      Extract common themes, conflicting evidence, and overall consensus. Write this as a highly academic, quantitative summary.
      
      Papers Data:
      \${JSON.stringify(data.data.map((p: any) => ({ title: p.title, year: p.year, citations: p.citationCount, abstract: p.abstract?.substring(0, 300) })))}\`;`;

const replacement = `  const handleAutomatedReview = async () => {
    const includedDocs = evidencePool.filter(d => d.included);
    if (includedDocs.length === 0) return setError("No included papers to analyze. Complete Phase 2 first.");
    setError('');
    setLoading(true);
    try {
      // Reuse the screened evidence pool instead of fetching from scratch
      setLiteratureData(includedDocs);
      
      const prompt = \`Perform a statistical synthesis and meta-analysis summary of the following \${includedDocs.length} papers on the topic: "\${formData.topic}". 
      Extract common themes, conflicting evidence, and overall consensus. Write this as a highly academic, quantitative summary.
      
      Papers Data:
      \${JSON.stringify(includedDocs.map((p: any) => ({ title: p.title, year: p.pubdate || p.year, citations: p.citations, abstract: p.abstract?.substring(0, 300) })))}\`;`;

code = code.replace(target, replacement);
fs.writeFileSync('src/LabResearchAgent.tsx', code);
console.log("Patched handleAutomatedReview");
