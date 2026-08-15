const ids = "36070743,36111111";
fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${ids}&retmode=xml`)
  .then(r => r.text())
  .then(text => {
    const articles = text.split(/<PubmedArticle>|<PubmedBookArticle>/).slice(1);
    const results = {};
    for (const article of articles) {
      const pmidMatch = article.match(/<PMID[^>]*>(\d+)<\/PMID>/);
      if (!pmidMatch) continue;
      const pmid = pmidMatch[1];
      const abstracts = [];
      const abstractMatches = article.matchAll(/<AbstractText[^>]*>(.*?)<\/AbstractText>/g);
      for (const match of abstractMatches) {
        abstracts.push(match[1]);
      }
      results[pmid] = abstracts.join(' ');
    }
    console.log(results);
  });
