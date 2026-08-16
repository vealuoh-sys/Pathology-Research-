const topic = "troponin I";
const population = "CKD";
const labSection = "Chemistry";
const query = `${topic} ${population} ${labSection}`;

fetch('http://localhost:3000/api/literature-search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query })
}).then(r => r.json()).then(data => {
  const litContext = data.results.map((d) => `ID: ${d.uid} | Title: ${d.title} (${d.pubdate}, ${d.origin}) | Abstract: ${d.abstract}`).join('\n\n');
  const prompt = `Act as an expert medical research reviewer.
      The user is planning a study on "${topic}" in "${population}" in the ${labSection} department.
      
      Here is the fetched, screened "Included" evidence pool:
      ${litContext}
      
      Does this specific set of Included papers contain enough substantively relevant content to support meaningful, non-hallucinated gap analysis for the stated Research Topic, Patient Population, and Laboratory Section? 
      Be strict: if they only mention the topic in passing, or miss the population entirely, mark sufficient as false.
      
      Format EXACTLY as a JSON object:
      {
        "sufficient": boolean,
        "reasoning": "Detailed explanation of why the literature is sufficient or what is specifically missing",
        "missingAspects": ["List of missing aspects, optional"],
        "suggestedExclusionsToReinclude": ["List of UIDs from excluded papers that might help, if you had access to them, optional"]
      }`;

   fetch('http://localhost:3000/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, schemaId: 'literature-reviewer', highThinking: true })
   }).then(r => r.json()).then(res => console.log(res.text));
});
