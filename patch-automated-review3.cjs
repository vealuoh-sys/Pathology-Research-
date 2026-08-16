const fs = require('fs');
let code = fs.readFileSync('src/LabResearchAgent.tsx', 'utf-8');

const target = `  const handleAutomatedReview = async () => {
    const includedDocs = evidencePool.filter(d => d.included);`;

const replacement = `  const handleAutomatedReview = async () => {
    let includedDocs = evidencePool.filter(d => d.included);
    
    // Sort by relevance to topic keywords, then citations
    const topicWords = formData.topic.toLowerCase().split(' ').filter(w => w.length > 3);
    includedDocs.sort((a, b) => {
      let scoreA = 0; let scoreB = 0;
      const titleA = (a.title || '').toLowerCase();
      const titleB = (b.title || '').toLowerCase();
      
      topicWords.forEach(w => {
         if (titleA.includes(w)) scoreA += 10;
         if (titleB.includes(w)) scoreB += 10;
      });
      
      if (a.citations) scoreA += Math.min(a.citations / 5, 20);
      if (b.citations) scoreB += Math.min(b.citations / 5, 20);
      
      return scoreB - scoreA;
    });

    // Semantic Scholar originally fetched 40, let's limit to 40 to ensure high quality meta-analysis
    const MAX_META_PAPERS = 40;
    if (includedDocs.length > MAX_META_PAPERS) {
      includedDocs = includedDocs.slice(0, MAX_META_PAPERS);
    }`;

code = code.replace(target, replacement);
fs.writeFileSync('src/LabResearchAgent.tsx', code);
console.log("Patched automated review sort and cap");
