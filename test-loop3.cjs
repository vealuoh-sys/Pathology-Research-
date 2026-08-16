async function run() {
  for (let i = 0; i < 15; i++) {
    const screenPrompt = `Act as an expert systematic review screener. 
    Format the output EXACTLY as a JSON array of objects: [ { "uid": "ID", "included": true/false, "reason": "reason" } ]
    Paper ${i}: Blah blah troponin ${i}`;

    try {
      const res = await fetch("http://localhost:3000/api/generate", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: screenPrompt, schemaId: 'screening-funnel', highThinking: false })
      });
      if (!res.ok) {
         console.error("Batch", i, "API Error:", res.status, await res.text());
      } else {
         const data = await res.json();
         console.log("Batch", i, "Success", data.text.length, "bytes");
      }
    } catch (err) {
      console.error("Batch", i, "failed:", err);
    }
    await new Promise(r => setTimeout(r, 2000));
  }
}
run();
