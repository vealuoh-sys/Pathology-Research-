async function run() {
  const BATCH_SIZE = 15;
  const docs = Array(75).fill(0).map((_,i) => ({ uid: i, title: "Test", abstract: "Test" }));
  let allParsed = [];

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = docs.slice(i, i + BATCH_SIZE);
    const litContext = batch.map((d) => `ID: ${d.uid} | Title: ${d.title} | Abstract: ${d.abstract}`).join('\n');
    const prompt = `Act as an expert systematic review screener. 
    Format the output EXACTLY as a JSON array of objects: [ { "uid": "ID", "included": true/false, "reason": "reason" } ]
    Here are the fetched papers:
    ${litContext}`;

    try {
      let res = await fetch('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, webSearch: false, highThinking: false, schemaId: 'screening-funnel' })
      });
      if (!res.ok) {
         console.error("Batch", i, "API Error:", res.status, await res.text());
      } else {
         let data = await res.json();
         let raw = data.text;
         const jsonStart = raw.indexOf('[');
         const jsonEnd = raw.lastIndexOf(']');
         if (jsonStart !== -1 && jsonEnd !== -1) {
           raw = raw.substring(jsonStart, jsonEnd + 1);
         }
         const parsed = JSON.parse(raw);
         allParsed = allParsed.concat(parsed);
         console.log("Batch", i, "Success, parsed", parsed.length);
      }
    } catch (err) {
      console.error("Batch", i, "failed:", err);
    }
    
    if (i + BATCH_SIZE < docs.length) {
      console.log("Waiting 4500ms...");
      await new Promise(r => setTimeout(r, 4500));
    }
  }
  console.log("Total parsed:", allParsed.length);
}
run();
