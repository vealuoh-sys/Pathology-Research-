const works = ["W3185260998", "W2939816722", "W4211003466", "W4256299076", "W4363625537", "W4416602753"];
async function run() {
  for (const w of works) {
    const res = await fetch(`https://api.openalex.org/works/${w}`);
    const data = await res.json();
    if (data.ids && data.ids.pmid) {
       console.log(w, "has pmid:", data.ids.pmid);
    } else {
       console.log(w, "no pmid");
    }
  }
}
run();
