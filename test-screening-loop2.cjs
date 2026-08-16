async function run() {
  console.log("Fetching...");
  const searchRes = await fetch("http://localhost:3000/api/literature-search", {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: "troponin I in CKD" })
  });
  console.log(searchRes.status);
  const searchData = await searchRes.json();
  console.log(searchData);
}
run();
