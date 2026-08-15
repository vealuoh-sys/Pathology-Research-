const ids = "36070743,36111111";
fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${ids}&retmode=text&rettype=medline`)
  .then(r => r.text())
  .then(console.log);
