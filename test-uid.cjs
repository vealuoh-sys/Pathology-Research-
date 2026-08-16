async function run() {
  let query = "troponin I in CKD";
  let searchRes = await fetch("http://localhost:3000/api/literature-search", {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: query })
  });
  let searchData = await searchRes.json();
  let results = searchData.results.slice(0, 5);
  results.forEach(r => console.log(r.origin, r.uid));
}
run();
