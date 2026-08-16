async function run() {
  console.log("=== VERIFYING FINAL END-TO-END SCREENING RUN ===");
  try {
    const searchRes = await fetch("http://localhost:3000/api/literature-search", {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: "troponin I in CKD" })
    });
    const searchData = await searchRes.json();
    const docs = searchData.results.slice(0, 30); // Test 2 full batches
    
    let allParsed = [];
    const BATCH_SIZE = 15;
    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const batch = docs.slice(i, i + BATCH_SIZE);
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

        let res = await fetch("http://localhost:3000/api/generate", {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: screenPrompt, schemaId: 'screening-funnel', highThinking: false })
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        
        let raw = data.text;
        const jsonStart = raw.indexOf('[');
        const jsonEnd = raw.lastIndexOf(']');
        if (jsonStart !== -1 && jsonEnd !== -1) {
          raw = raw.substring(jsonStart, jsonEnd + 1);
        }
        const parsed = JSON.parse(raw);
        allParsed = allParsed.concat(parsed);
        console.log(`-> Batch ${i} succeeded! Parsed ${parsed.length} objects.`);
        
        if (i + BATCH_SIZE < docs.length) await new Promise(r => setTimeout(r, 4500));
    }
    
    console.log(`-> Total successfully screened papers: ${allParsed.length}`);
    const includedCount = allParsed.filter(p => p.included).length;
    console.log(`-> Total Included: ${includedCount} out of ${allParsed.length}`);
    if (includedCount > 0) {
      console.log(`-> Sample inclusion reason: ${allParsed.find(p => p.included).reason}`);
    }
  } catch (err) {
    console.error("Test failed:", err);
  }
}
run();
