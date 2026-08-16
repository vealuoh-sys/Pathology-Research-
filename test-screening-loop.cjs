async function run() {
  console.log("Fetching...");
  const searchRes = await fetch("http://localhost:3000/api/literature-search", {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: "troponin I in CKD" })
  });
  const searchData = await searchRes.json();
  const docs = searchData.results.slice(0, 50); // 10 batches of 5

  const BATCH_SIZE = 5;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = docs.slice(i, i + BATCH_SIZE);
    console.log("Screening batch", i);
    const litContext = batch.map(d => `ID: ${d.uid} | Title: ${d.title} | Abstract: ${d.abstract?.substring(0,300)}...`).join('\n');
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
      if (!res.ok) {
         console.error("API Error at batch", i, res.status, await res.text());
         continue;
      }
      const data = await res.json();
      let cleaned = data.text.replace(/^\`\`\`(json)?/m, '').replace(/\`\`\`$/m, '').trim();
      const parsed = JSON.parse(cleaned);
      console.log("Parsed batch", i, parsed.length, "results");
    } catch (err) {
      console.error("Batch", i, "failed:", err);
    }
    await new Promise(r => setTimeout(r, 2000));
  }
}
run();
