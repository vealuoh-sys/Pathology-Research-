async function run() {
  const litContext = `ID: 1 | Title: Test | Abstract: Test`;
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
    console.log(res.status);
    console.log(await res.text());
  } catch (err) {
    console.error("Batch failed:", err);
  }
}
run();
