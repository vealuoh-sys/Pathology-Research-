async function run() {
  const searchRes = await fetch("http://localhost:3000/api/literature-search", {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: "troponin I in CKD" })
  });
  const searchData = await searchRes.json();
  const docs = searchData.results.slice(0, 5); // Batch of 5
  
  const litContext = docs.map(d => `ID: ${d.uid} | Title: ${d.title} | Abstract: ${d.abstract?.substring(0,300)}...`).join('\n');
  const screenPrompt = `Act as an expert systematic review screener. 
        The user is planning a Retrospective study on "troponin I in CKD" in "CKD" within the "Clinical Chemistry" laboratory section.
        Here are the fetched papers:
        ${litContext}
        Screen these papers for relevance. 
        CRITICAL INCLUSION RULE: You must INCLUDE any paper that is a foundational guideline, consensus statement, or major study directly related to EITHER the primary biomarker (e.g. Troponin) OR the primary condition (e.g. CKD), as these are necessary for background context, even if they do not explicitly mention both components.
        Only exclude papers that are entirely unrelated to both components or tangentially mention them without focusing on them.
        Format the output EXACTLY as a JSON array of objects:
        [ { "uid": "ID", "included": true/false, "reason": "reason" } ]
        Do not include markdown formatting for the JSON.`;

  try {
    const res = await fetch("http://localhost:3000/api/generate", {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: screenPrompt, schemaId: 'screening-funnel', highThinking: false })
    });
    
    const data = await res.json();
    console.log("Raw LLM response:\n", data.text);
    
    let cleaned = data.text.replace(/^\`\`\`(json)?/m, '').replace(/\`\`\`$/m, '').trim();
    console.log("Cleaned:\n", cleaned);
    JSON.parse(cleaned);
    console.log("Parse SUCCESS");
  } catch (err) {
    console.error("Batch failed:", err);
  }
}
run();
