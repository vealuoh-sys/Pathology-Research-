async function run() {
  const query = "troponin I in CKD OPD Clinical Chemistry";
  console.log("Query:", query);
  const searchRes = await fetch("http://localhost:3000/api/literature-search", {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  const data = await searchRes.json();
  const results = data.results || [];
  console.log("Returned results count:", results.length);
  
  const targetPmid = "35086655";
  const found = results.find(r => r.uid === targetPmid || (r.url && r.url.includes(targetPmid)));
  
  if (found) {
    console.log("✅ PMID 35086655 FOUND!");
    console.log("Title:", found.title);
  } else {
    console.log("❌ PMID 35086655 NOT FOUND.");
    // Print all UIDs for debugging
    console.log("Found UIDs:", results.map(r => r.uid).join(", "));
  }
}
run();
