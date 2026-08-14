import React, { useState, useEffect, useMemo } from 'react';
import { 
  Beaker, Search, FileSpreadsheet, BarChart2, PenTool, CheckCircle, 
  RefreshCcw, Loader2, ArrowRight, Download, Clipboard, AlertCircle, PlayCircle,
  Trash2, FolderOpen, Plus, X
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell } from 'recharts';

// Custom Design Tokens
const C = {
  paper: '#FAF9F4',
  paperAlt: '#F1EEE3',
  ink: '#1C2320',
  inkSoft: '#5B6360',
  teal: '#12615C',
  tealDark: '#0B4844',
  rust: '#A8562C',
  rustPale: '#F3E4D8',
  line: '#DDD8C8'
};

// API Helper
async function callGemini(prompt: string, opts: { system?: string, webSearch?: boolean } = {}) {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, system: opts.system })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch');
  return data.text;
}

// Stats Math Helpers (Pure JS)
const parseCSV = (csv: string) => {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).filter(l => l.trim()).map(line => {
    return line.split(',').map(val => {
      const trimmed = val.trim().replace(/^"|"$/g, '');
      const num = Number(trimmed);
      return isNaN(num) || trimmed === '' ? trimmed : num;
    });
  });
  return { headers, rows };
};

const detectType = (values: any[]) => {
  const nums = values.filter(v => typeof v === 'number');
  return nums.length / values.length > 0.5 ? 'numeric' : 'categorical';
};

const describeNumeric = (values: any[]) => {
  const nums = values.filter(v => typeof v === 'number') as number[];
  if (!nums.length) return { n: 0, mean: 0, std: 0, median: 0, min: 0, max: 0 };
  const n = nums.length;
  const mean = nums.reduce((a, b) => a + b, 0) / n;
  const variance = nums.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n - 1 || 1);
  const std = Math.sqrt(variance);
  const sorted = [...nums].sort((a, b) => a - b);
  const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];
  return { n, mean, std, median, min: sorted[0], max: sorted[n - 1] };
};

const describeCategorical = (values: any[]) => {
  const counts = values.reduce((acc, val) => {
    const k = String(val);
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const total = values.length;
  return Object.entries(counts).map(([label, count]) => ({
    label, count, percentage: ((count / total) * 100).toFixed(1)
  })).sort((a, b) => b.count - a.count);
};

const normalCDF = (x: number) => {
  const sign = x >= 0 ? 1 : -1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + 0.3275911 * x);
  const y = 1.0 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return 0.5 * (1.0 + sign * y);
};

const chiSquarePValue = (chiSq: number, df: number) => {
  if (df <= 0) return 1;
  const x = Math.pow(chiSq / df, 1/3) - (1 - 2/(9*df));
  const z = x / Math.sqrt(2/(9*df));
  return 1 - normalCDF(z);
};

const chiSquare = (cat1: any[], cat2: any[]) => {
  const table: Record<string, Record<string, number>> = {};
  const rowTotals: Record<string, number> = {};
  const colTotals: Record<string, number> = {};
  let total = 0;

  for (let i = 0; i < cat1.length; i++) {
    if (i >= cat2.length) break;
    const v1 = String(cat1[i]);
    const v2 = String(cat2[i]);
    if (!table[v1]) table[v1] = {};
    table[v1][v2] = (table[v1][v2] || 0) + 1;
    rowTotals[v1] = (rowTotals[v1] || 0) + 1;
    colTotals[v2] = (colTotals[v2] || 0) + 1;
    total++;
  }

  let chiSq = 0;
  let df = (Object.keys(rowTotals).length - 1) * (Object.keys(colTotals).length - 1);
  if (df < 1) return { p: 1, stat: 0, df: 0, valid: false };

  for (const r in rowTotals) {
    for (const c in colTotals) {
      const expected = (rowTotals[r] * colTotals[c]) / total;
      const observed = (table[r]?.[c] || 0);
      chiSq += Math.pow(observed - expected, 2) / expected;
    }
  }

  return { stat: chiSq, df, p: chiSquarePValue(chiSq, df), valid: true, name: "Chi-Square Test" };
};

const welchTTest = (numeric: number[], categorical: any[]) => {
  const groups: Record<string, number[]> = {};
  for(let i = 0; i < numeric.length; i++) {
    const c = String(categorical[i]);
    if (!groups[c]) groups[c] = [];
    groups[c].push(numeric[i]);
  }
  
  const keys = Object.keys(groups);
  if (keys.length !== 2) return { stat: 0, p: 1, df: 0, valid: false, msg: "T-test requires exactly 2 groups" };
  
  const g1 = groups[keys[0]];
  const g2 = groups[keys[1]];
  
  const d1 = describeNumeric(g1);
  const d2 = describeNumeric(g2);
  
  const v1 = Math.pow(d1.std, 2);
  const v2 = Math.pow(d2.std, 2);
  
  if (d1.n < 2 || d2.n < 2) return { stat: 0, p: 1, df: 0, valid: false, msg: "Not enough data" };

  const t = (d1.mean - d2.mean) / Math.sqrt(v1/d1.n + v2/d2.n);
  const dfNum = Math.pow(v1/d1.n + v2/d2.n, 2);
  const dfDen = Math.pow(v1/d1.n, 2)/(d1.n-1) + Math.pow(v2/d2.n, 2)/(d2.n-1);
  const df = dfNum / dfDen;
  
  const p = 2 * (1 - normalCDF(Math.abs(t)));
  
  return { stat: t, p, df, valid: true, name: "Welch's T-Test", g1: { name: keys[0], ...d1 }, g2: { name: keys[1], ...d2 } };
};

// Local storage fallback wrapper
const mockStorage = {
  getItem: (k: string) => { try { return window.localStorage.getItem(k); } catch(e) { return null; } },
  setItem: (k: string, v: string) => { try { window.localStorage.setItem(k, v); } catch(e) {} }
};

// Micro-components
const MarkdownLite = ({ content }: { content: string }) => {
  const parsed = content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/```(.*?)```/gs, '<pre class="p-3 rounded my-3 text-sm font-mono overflow-x-auto" style="background-color: ' + C.paperAlt + '"><code>$1</code></pre>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/^- (.*)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul class="list-disc pl-5 my-2">$1</ul>')
    .replace(/### (.*)/g, '<h4 class="text-md font-bold mt-4 mb-2" style="color: ' + C.ink + '">$1</h4>')
    .replace(/## (.*)/g, '<h3 class="text-lg font-bold mt-5 mb-2 border-b pb-1" style="color: ' + C.ink + '; border-color: ' + C.line + '">$1</h3>');

  return <div dangerouslySetInnerHTML={{ __html: parsed }} className="text-sm leading-relaxed" style={{ color: C.inkSoft }} />;
};

const SectionCard = ({ children, title, subtitle }: { children: React.ReactNode, title?: string, subtitle?: string }) => (
  <div className="bg-white p-6 rounded-xl border shadow-sm mb-6 transition-all" style={{ borderColor: C.line }}>
    {(title || subtitle) && (
      <div className="mb-5 pb-4 border-b" style={{ borderColor: C.line }}>
        {subtitle && <span className="text-[10px] uppercase font-black block tracking-widest mb-1" style={{ color: C.rust }}>{subtitle}</span>}
        {title && <h3 className="text-lg font-bold" style={{ color: C.ink }}>{title}</h3>}
      </div>
    )}
    {children}
  </div>
);

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[10px] uppercase font-black mb-1 block tracking-widest" style={{ color: C.rust }}>{children}</span>
);

const PrimaryButton = ({ children, onClick, disabled, loading, icon: Icon, className="" }: any) => (
  <button 
    onClick={onClick} 
    disabled={disabled || loading}
    className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 hover:opacity-90 ${className}`}
    style={{ backgroundColor: C.teal, color: '#fff', opacity: (disabled || loading) ? 0.6 : 1 }}
  >
    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (Icon && <Icon className="w-4 h-4" />)}
    {children}
  </button>
);

const SecondaryButton = ({ children, onClick, disabled, loading, icon: Icon, className="" }: any) => (
  <button 
    onClick={onClick} 
    disabled={disabled || loading}
    className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest border transition-colors flex items-center justify-center gap-2 hover:bg-gray-50 ${className}`}
    style={{ borderColor: C.inkSoft, color: C.ink, opacity: (disabled || loading) ? 0.6 : 1, backgroundColor: '#fff' }}
  >
    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (Icon && <Icon className="w-4 h-4" />)}
    {children}
  </button>
);

const HeaderStat = ({ label, value }: { label: string, value: string|number }) => (
  <div>
    <p className="text-[10px] uppercase font-bold tracking-widest" style={{ color: C.inkSoft }}>{label}</p>
    <p className="text-xl font-bold" style={{ color: C.ink }}>{value}</p>
  </div>
);

const ErrorNote = ({ children }: { children: React.ReactNode }) => {
  if (!children) return null;
  return (
    <div className="p-4 rounded-lg mb-4 text-sm font-medium flex gap-3 items-start" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>
      <AlertCircle className="w-5 h-5 shrink-0" />
      <div>{children}</div>
    </div>
  );
};

// Main Component
export default function LabResearchAgent() {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Projects state
  const [projectId, setProjectId] = useState<string>('');
  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // App State
  const [formData, setFormData] = useState({
    topic: '',
    labSection: 'Hematology',
    studyType: 'Method Comparison',
    population: ''
  });
  const [gaps, setGaps] = useState<string[]>([]);
  const [selectedGap, setSelectedGap] = useState('');
  const [protocol, setProtocol] = useState({ text: '', template: '' });
  const [csvData, setCsvData] = useState('');
  const [analysis, setAnalysis] = useState<any>({ col1: '', col2: '', result: null, interpretation: '' });
  const [report, setReport] = useState<any>(null);

  const loadProject = (p: any) => {
    setProjectId(p.id);
    setFormData(p.formData || { topic: '', labSection: 'Hematology', studyType: 'Method Comparison', population: '' });
    setGaps(p.gaps || []);
    setSelectedGap(p.selectedGap || '');
    setProtocol(p.protocol || { text: '', template: '' });
    setCsvData(p.csvData || '');
    setAnalysis(p.analysis || { col1: '', col2: '', result: null, interpretation: '' });
    setReport(p.report || null);
    setCurrentStep(p.currentStep || 1);
    setShowHistory(false);
  };

  const startNewProject = () => {
    setProjectId(Date.now().toString());
    setFormData({ topic: '', labSection: 'Hematology', studyType: 'Method Comparison', population: '' });
    setGaps([]);
    setSelectedGap('');
    setProtocol({ text: '', template: '' });
    setCsvData('');
    setAnalysis({ col1: '', col2: '', result: null, interpretation: '' });
    setReport(null);
    setCurrentStep(1);
    setShowHistory(false);
  };

  const deleteProject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setProjectsList(prev => {
      const next = prev.filter(p => p.id !== id);
      mockStorage.setItem('lab_research_projects', JSON.stringify(next));
      if (id === projectId) {
        if (next.length > 0) loadProject(next.sort((a: any, b: any) => b.updatedAt - a.updatedAt)[0]);
        else startNewProject();
      }
      return next;
    });
  };

  // Load from storage
  useEffect(() => {
    const savedProjects = mockStorage.getItem('lab_research_projects');
    if (savedProjects) {
      try {
        const parsed = JSON.parse(savedProjects);
        setProjectsList(parsed);
        if (parsed.length > 0) {
          const latest = parsed.sort((a: any, b: any) => b.updatedAt - a.updatedAt)[0];
          loadProject(latest);
        } else {
          startNewProject();
        }
      } catch (e) {
        startNewProject();
      }
    } else {
      // Migrate old state if exists
      const oldState = mockStorage.getItem('lab_research_state');
      if (oldState) {
        try {
          const parsed = JSON.parse(oldState);
          parsed.id = Date.now().toString();
          parsed.updatedAt = Date.now();
          setProjectsList([parsed]);
          loadProject(parsed);
          mockStorage.setItem('lab_research_projects', JSON.stringify([parsed]));
        } catch(e) {
          startNewProject();
        }
      } else {
        startNewProject();
      }
    }
  }, []);

  // Save to storage
  useEffect(() => {
    if (!projectId) return;
    setProjectsList(prev => {
      const idx = prev.findIndex(p => p.id === projectId);
      const newProj = {
        id: projectId,
        updatedAt: Date.now(),
        currentStep, formData, gaps, selectedGap, protocol, csvData, analysis, report
      };
      const nextList = [...prev];
      if (idx >= 0) nextList[idx] = newProj;
      else nextList.push(newProj);
      
      mockStorage.setItem('lab_research_projects', JSON.stringify(nextList));
      return nextList;
    });
  }, [currentStep, formData, gaps, selectedGap, protocol, csvData, analysis, report, projectId]);

  const handleNext = () => setCurrentStep(prev => Math.min(prev + 1, 5));
  const handlePrev = () => setCurrentStep(prev => Math.max(prev - 1, 1));

  const steps = [
    { id: 1, label: 'Specimen', icon: Beaker },
    { id: 2, label: 'Panel', icon: Search },
    { id: 3, label: 'Protocol', icon: FileSpreadsheet },
    { id: 4, label: 'Results', icon: BarChart2 },
    { id: 5, label: 'Report', icon: PenTool }
  ];

  const handleGenerateGaps = async () => {
    if (!formData.topic || !formData.population) return setError("Please fill out all fields.");
    setError('');
    setLoading(true);
    try {
      const prompt = `Act as an expert medical laboratory scientist. Based on recent literature, identify 3 distinct, highly actionable research gaps for a single-center ${formData.studyType} study in the ${formData.labSection} department focusing on ${formData.topic} in ${formData.population} populations. 
      Format the output EXACTLY as a JSON array of strings. Do not include markdown formatting for the JSON, just output the raw bracketed array: ["Gap 1...", "Gap 2...", "Gap 3..."]`;
      
      const res = await callGemini(prompt, { webSearch: true });
      const cleanRes = res.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsedGaps = JSON.parse(cleanRes);
      if (Array.isArray(parsedGaps)) {
        setGaps(parsedGaps);
      } else {
        throw new Error("Invalid format returned by AI.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to generate gaps. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateProtocol = async () => {
    if (!selectedGap) return setError("Please select a research gap.");
    setError('');
    setLoading(true);
    try {
      const prompt = `Write a brief study protocol for this research gap: "${selectedGap}". 
      Include:
      1. Primary Objective
      2. Inclusion/Exclusion Criteria
      3. Minimum Sample Size estimation approach (just the logic, no complex math)
      4. Variables to collect.
      
      AT THE VERY END, on a new line, write exactly:
      [CSV_TEMPLATE]
      Then provide a comma-separated list of column names for the variables, e.g., Patient_ID,Age,Sex,Test_Result_1,Test_Result_2`;
      
      const res = await callGemini(prompt);
      
      let text = res;
      let template = '';
      if (res.includes('[CSV_TEMPLATE]')) {
        const parts = res.split('[CSV_TEMPLATE]');
        text = parts[0].trim();
        template = parts[1].trim();
      }
      
      setProtocol({ text, template });
      handleNext();
    } catch (err: any) {
      setError(err.message || "Failed to generate protocol.");
    } finally {
      setLoading(false);
    }
  };

  const { parsedCsv, headers } = useMemo(() => {
    if (!csvData) return { parsedCsv: { headers: [], rows: [] }, headers: [] };
    const parsed = parseCSV(csvData);
    return { parsedCsv: parsed, headers: parsed.headers };
  }, [csvData]);

  const runAnalysis = async () => {
    if (!analysis.col1 || !analysis.col2) return setError("Select two columns to compare.");
    setError('');
    setLoading(true);
    
    try {
      const idx1 = headers.indexOf(analysis.col1);
      const idx2 = headers.indexOf(analysis.col2);
      
      const vals1 = parsedCsv.rows.map(r => r[idx1]);
      const vals2 = parsedCsv.rows.map(r => r[idx2]);
      
      const t1 = detectType(vals1);
      const t2 = detectType(vals2);
      
      let statResult: any = null;
      let aiPrompt = '';
      
      if (t1 === 'categorical' && t2 === 'categorical') {
        statResult = chiSquare(vals1, vals2);
        if (!statResult.valid) throw new Error(statResult.msg || "Invalid data for Chi-Square");
        aiPrompt = `I ran a Chi-Square test to compare ${analysis.col1} and ${analysis.col2}. The test statistic was ${statResult.stat.toFixed(2)}, degrees of freedom: ${statResult.df}, p-value: ${statResult.p.toFixed(4)}. Write a plain English, academic interpretation of these results for a lab medicine paper. Be concise.`;
      } 
      else if ((t1 === 'numeric' && t2 === 'categorical') || (t2 === 'numeric' && t1 === 'categorical')) {
        const numVals = t1 === 'numeric' ? vals1 : vals2;
        const catVals = t1 === 'numeric' ? vals2 : vals1;
        const numName = t1 === 'numeric' ? analysis.col1 : analysis.col2;
        const catName = t1 === 'numeric' ? analysis.col2 : analysis.col1;
        
        statResult = welchTTest(numVals, catVals);
        if (!statResult.valid) throw new Error(statResult.msg);
        
        aiPrompt = `I ran Welch's T-Test comparing ${numName} across groups in ${catName}. 
        Group 1 (${statResult.g1.name}): Mean ${statResult.g1.mean.toFixed(2)} (SD ${statResult.g1.std.toFixed(2)}, n=${statResult.g1.n}).
        Group 2 (${statResult.g2.name}): Mean ${statResult.g2.mean.toFixed(2)} (SD ${statResult.g2.std.toFixed(2)}, n=${statResult.g2.n}).
        T-statistic: ${statResult.stat.toFixed(2)}, p-value: ${statResult.p.toFixed(4)}. 
        Write a plain English, academic interpretation for a lab medicine paper. State whether the difference is statistically significant (assume alpha=0.05).`;
      } else {
        throw new Error("Please select one categorical and one numeric column (T-Test) or two categorical columns (Chi-Square).");
      }
      
      const interpretation = await callGemini(aiPrompt);
      setAnalysis({ ...analysis, result: statResult, interpretation });
      
    } catch (err: any) {
      setError(err.message || "Analysis failed.");
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async () => {
    setError('');
    setLoading(true);
    try {
      const parts = ['Introduction', 'Methods', 'Results', 'Discussion', 'Conclusion', 'References'];
      let manuscript: any = {};
      
      const baseContext = `Topic: ${formData.topic}. Study Type: ${formData.studyType}. Gap addressed: ${selectedGap}. 
      Protocol details: ${protocol.text.substring(0, 500)}... 
      Statistical Findings: ${analysis.interpretation || 'No statistical analysis was finalized.'}`;
      
      for (const part of parts) {
        let prompt = `You are writing a lab medicine manuscript. 
        Based on this context: "${baseContext}"
        Write the **${part}** section of the manuscript. Keep it strictly to the ${part} section, use an academic tone, and make it around 150-250 words. Do not add titles or markdown headings for the section name itself.`;
        
        if (part !== 'References') {
          prompt += ` Include realistic in-text academic citations (e.g., [1], [2]) to foundational or highly relevant literature from your training data where appropriate.`;
        } else {
          prompt = `You are writing a lab medicine manuscript. 
          Based on this context: "${baseContext}"
          Write the **References** section of the manuscript. Provide a numbered list of real, peer-reviewed academic references (e.g., foundational papers, textbook chapters) that relate to this topic and match the citations you just generated. Do not invent fake DOIs or authors; rely strictly on actual scientific literature from your knowledge base. Do not add titles or markdown headings for the section name itself.`;
        }
        
        const res = await callGemini(prompt);
        manuscript[part.toLowerCase()] = res;
      }
      
      setReport(manuscript);
    } catch (err: any) {
      setError(err.message || "Failed to generate report.");
    } finally {
      setLoading(false);
    }
  };

  const copyReport = () => {
    if (!report) return;
    const text = `Title: ${formData.topic} in ${formData.population}\n\n` + 
                 `Introduction\n${report.introduction}\n\n` +
                 `Methods\n${report.methods}\n\n` +
                 `Results\n${report.results}\n\n` +
                 `Discussion\n${report.discussion}\n\n` +
                 `Conclusion\n${report.conclusion}\n\n` +
                 `References\n${report.references}`;
    navigator.clipboard.writeText(text);
    alert("Report copied to clipboard!");
  };

  return (
    <div className="h-screen w-full font-sans flex flex-col overflow-hidden" style={{ backgroundColor: C.paper, color: C.ink }}>
      {/* History Modal Overlay */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}>
          <div className="w-full max-w-md h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300" style={{ backgroundColor: C.paper }}>
            <div className="p-6 border-b flex justify-between items-center" style={{ borderColor: C.line, backgroundColor: C.paperAlt }}>
              <h2 className="text-xl font-bold uppercase tracking-wide" style={{ color: C.ink }}>Saved Workspaces</h2>
              <button onClick={() => setShowHistory(false)}><X className="w-6 h-6 hover:opacity-70 transition-opacity" style={{ color: C.ink }} /></button>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto flex flex-col gap-4">
              <button 
                onClick={startNewProject}
                className="w-full flex items-center justify-center gap-2 py-4 rounded border-2 border-dashed hover:bg-white transition-colors"
                style={{ borderColor: C.line, color: C.teal }}
              >
                <Plus className="w-5 h-5" />
                <span className="font-bold uppercase tracking-wider text-sm">Start New Study</span>
              </button>
              
              {projectsList.sort((a,b) => b.updatedAt - a.updatedAt).map(proj => (
                <div 
                  key={proj.id} 
                  onClick={() => loadProject(proj)}
                  className={`p-4 rounded border cursor-pointer transition-colors flex justify-between items-start group ${proj.id === projectId ? 'ring-2' : 'hover:bg-white'}`}
                  style={{ borderColor: proj.id === projectId ? C.teal : C.line, backgroundColor: proj.id === projectId ? 'white' : 'transparent', ringColor: C.teal }}
                >
                  <div className="flex-1 pr-4">
                    <p className="text-sm font-bold uppercase tracking-wider mb-1 line-clamp-2 leading-snug" style={{ color: C.tealDark }}>
                      {proj.formData.topic || "Untitled Study"}
                    </p>
                    <p className="text-[11px] uppercase tracking-widest font-semibold" style={{ color: C.inkSoft }}>
                      Phase {proj.currentStep} &middot; {new Date(proj.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button 
                    onClick={(e) => deleteProject(proj.id, e)}
                    className="p-2 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                    title="Delete project"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Top Header */}
      <header className="px-8 py-4 border-b flex items-center justify-between shrink-0" style={{ backgroundColor: C.paperAlt, borderColor: C.line }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: C.teal }}>
            <Beaker className="w-6 h-6" />
          </div>
          <h1 className="font-bold text-xl tracking-tight uppercase" style={{ color: C.ink }}>LabResearchAgent</h1>
        </div>
        
        <div className="flex gap-6 items-center">
          <button 
            onClick={() => setShowHistory(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-bold uppercase tracking-wider hover:bg-gray-50 transition-colors"
            style={{ borderColor: C.line, color: C.ink, backgroundColor: 'white' }}
          >
            <FolderOpen className="w-4 h-4" style={{ color: C.teal }} />
            Workspace
          </button>
          
          <div className="flex flex-col items-end border-l pl-6" style={{ borderColor: C.line }}>
            <span className="text-[10px] uppercase font-bold tracking-wider" style={{ color: C.inkSoft }}>Status</span>
            <span className="text-sm font-semibold flex items-center gap-1" style={{ color: C.teal }}>
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: C.teal }}></div>
              Phase {currentStep} Active
            </span>
          </div>
        </div>
      </header>

      {/* Phase Navigation Tabs */}
      <nav className="flex border-b bg-white shrink-0" style={{ borderColor: C.line }}>
        {steps.map((step) => {
          const isActive = currentStep === step.id;
          const isPast = currentStep > step.id;
          return (
            <button
              key={step.id}
              onClick={() => isPast ? setCurrentStep(step.id) : null}
              disabled={!isPast && !isActive}
              className={`flex-1 py-3 text-center text-xs font-bold uppercase tracking-widest transition-all ${
                isActive ? 'border-b-4' : 'border-r opacity-50'
              }`}
              style={{
                borderColor: isActive ? C.teal : C.line,
                backgroundColor: isActive ? C.paper : 'transparent',
                color: isActive ? C.teal : C.inkSoft,
                cursor: isPast || isActive ? 'pointer' : 'not-allowed'
              }}
            >
              0{step.id} {step.label}
            </button>
          )
        })}
      </nav>

      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-5xl mx-auto pb-20">
          <ErrorNote>{error}</ErrorNote>

        {/* Phase 1: Specimen */}
        {currentStep === 1 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <SectionCard title="Study Parameters" subtitle="Define the clinical setting and focus of your diagnostic study.">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold mb-2" style={{ color: C.ink }}>Research Topic</label>
                  <input 
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:outline-none transition-shadow"
                    style={{ borderColor: C.line }}
                    placeholder="e.g. Troponin I vs Troponin T performance"
                    value={formData.topic}
                    onChange={(e) => setFormData({...formData, topic: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2" style={{ color: C.ink }}>Population</label>
                  <input 
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:outline-none transition-shadow"
                    style={{ borderColor: C.line }}
                    placeholder="e.g. Emergency Department patients with chest pain"
                    value={formData.population}
                    onChange={(e) => setFormData({...formData, population: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2" style={{ color: C.ink }}>Laboratory Section</label>
                  <select 
                    className="w-full p-3 border rounded-lg bg-white"
                    style={{ borderColor: C.line }}
                    value={formData.labSection}
                    onChange={(e) => setFormData({...formData, labSection: e.target.value})}
                  >
                    {['Hematology', 'Clinical Chemistry', 'Microbiology', 'Blood Bank', 'Immunology', 'Molecular Diagnostics'].map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2" style={{ color: C.ink }}>Study Type</label>
                  <select 
                    className="w-full p-3 border rounded-lg bg-white"
                    style={{ borderColor: C.line }}
                    value={formData.studyType}
                    onChange={(e) => setFormData({...formData, studyType: e.target.value})}
                  >
                    {['Method Comparison', 'Reference Interval', 'Diagnostic Accuracy', 'Quality Control Evaluation', 'Workflow Analysis'].map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-8 flex justify-end">
                <PrimaryButton onClick={handleNext} icon={ArrowRight}>Proceed to Literature Search</PrimaryButton>
              </div>
            </SectionCard>
          </div>
        )}

        {/* Phase 2: Panel */}
        {currentStep === 2 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-end mb-6">
              <div>
                <Eyebrow>Literature Review</Eyebrow>
                <h2 className="text-2xl font-bold" style={{ color: C.ink }}>Identify Research Gaps</h2>
              </div>
              <PrimaryButton onClick={handleGenerateGaps} loading={loading} icon={Search}>Search Recent Literature</PrimaryButton>
            </div>
            
            {gaps.length > 0 ? (
              <div className="space-y-4">
                {gaps.map((gap, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => setSelectedGap(gap)}
                    className={`p-5 rounded-xl border-2 cursor-pointer transition-all ${selectedGap === gap ? 'shadow-md scale-[1.01]' : 'hover:bg-gray-50'}`}
                    style={{ 
                      borderColor: selectedGap === gap ? C.teal : C.line,
                      backgroundColor: selectedGap === gap ? C.paperAlt : '#fff'
                    }}
                  >
                    <div className="flex gap-4">
                      <div className="pt-1">
                        <CheckCircle className={`w-5 h-5 ${selectedGap === gap ? 'text-teal-700' : 'text-gray-300'}`} />
                      </div>
                      <p className="text-sm leading-relaxed font-medium" style={{ color: C.ink }}>{gap}</p>
                    </div>
                  </div>
                ))}
                
                <div className="mt-8 flex justify-between pt-6 border-t" style={{ borderColor: C.line }}>
                  <SecondaryButton onClick={handlePrev}>Back</SecondaryButton>
                  <PrimaryButton onClick={handleGenerateProtocol} loading={loading} disabled={!selectedGap}>Draft Study Protocol</PrimaryButton>
                </div>
              </div>
            ) : (
              <SectionCard>
                <div className="text-center py-12">
                  <Search className="w-12 h-12 mx-auto mb-4 opacity-20" style={{ color: C.ink }} />
                  <p style={{ color: C.inkSoft }}>Click "Search Recent Literature" to ground the AI in recent publications and find actionable research gaps.</p>
                </div>
              </SectionCard>
            )}
          </div>
        )}

        {/* Phase 3: Protocol */}
        {currentStep === 3 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <SectionCard title="Study Protocol">
                  <MarkdownLite content={protocol.text || "No protocol generated yet."} />
                </SectionCard>
              </div>
              <div>
                <SectionCard title="Data Dictionary">
                  <p className="text-sm mb-4" style={{ color: C.inkSoft }}>The AI has determined these variables are required to conduct the study.</p>
                  
                  {protocol.template ? (
                    <div className="bg-gray-50 p-4 rounded border font-mono text-xs overflow-x-auto mb-6 whitespace-nowrap" style={{ borderColor: C.line }}>
                      {protocol.template}
                    </div>
                  ) : (
                     <div className="text-sm text-gray-400 italic mb-6">No template available.</div>
                  )}
                  
                  <PrimaryButton 
                    className="w-full mb-4" 
                    icon={Download}
                    disabled={!protocol.template}
                    onClick={() => {
                      const blob = new Blob([protocol.template], { type: 'text/csv' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'study_template.csv';
                      a.click();
                    }}
                  >
                    Download CSV Template
                  </PrimaryButton>
                  
                  <div className="pt-6 border-t flex gap-2" style={{ borderColor: C.line }}>
                    <SecondaryButton onClick={handlePrev} className="flex-1">Back</SecondaryButton>
                    <PrimaryButton onClick={handleNext} className="flex-1">Next Phase</PrimaryButton>
                  </div>
                </SectionCard>
              </div>
            </div>
          </div>
        )}

        {/* Phase 4: Results */}
        {currentStep === 4 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Eyebrow>Data Processing</Eyebrow>
            <h2 className="text-2xl font-bold mb-6" style={{ color: C.ink }}>Statistical Analysis</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              
              <div className="lg:col-span-1 space-y-6">
                <SectionCard title="Upload Data">
                  <p className="text-xs mb-2" style={{ color: C.inkSoft }}>Paste your CSV data (including headers) below.</p>
                  <textarea 
                    className="w-full h-48 p-3 border rounded text-xs font-mono mb-4 focus:outline-none focus:ring-1"
                    style={{ borderColor: C.line, backgroundColor: '#fff' }}
                    placeholder="Patient_ID,Age,Sex,Result\n1,45,M,2.4..."
                    value={csvData}
                    onChange={(e) => setCsvData(e.target.value)}
                  />
                  <div className="flex justify-between items-center text-xs" style={{ color: C.inkSoft }}>
                    <span>{headers.length} columns</span>
                    <span>{parsedCsv.rows.length} rows</span>
                  </div>
                </SectionCard>

                {headers.length > 0 && (
                  <SectionCard title="Run Test">
                     <select className="w-full p-2 mb-3 border rounded text-sm" value={analysis.col1} onChange={e => setAnalysis({...analysis, col1: e.target.value})}>
                       <option value="">Select Column 1...</option>
                       {headers.map(h => <option key={h} value={h}>{h}</option>)}
                     </select>
                     <select className="w-full p-2 mb-4 border rounded text-sm" value={analysis.col2} onChange={e => setAnalysis({...analysis, col2: e.target.value})}>
                       <option value="">Select Column 2...</option>
                       {headers.map(h => <option key={h} value={h}>{h}</option>)}
                     </select>
                     <PrimaryButton className="w-full" onClick={runAnalysis} loading={loading} icon={PlayCircle}>Run Inference</PrimaryButton>
                  </SectionCard>
                )}
              </div>

              <div className="lg:col-span-3">
                {!csvData ? (
                   <div className="h-full flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-12 text-center" style={{ borderColor: C.line }}>
                     <FileSpreadsheet className="w-12 h-12 mb-4 opacity-20" />
                     <p className="text-gray-500">Paste your dataset to begin exploratory analysis.</p>
                   </div>
                ) : (
                  <div className="space-y-6">
                    {/* Test Results Output */}
                    {analysis.result && (
                      <div className="p-6 rounded-xl border mb-6" style={{ backgroundColor: C.rustPale, borderColor: C.rust }}>
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[10px] uppercase font-black tracking-widest" style={{ color: C.rust }}>{analysis.result.name}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold text-white" style={{ backgroundColor: C.rust }}>{analysis.result.p < 0.05 ? 'SIGNIFICANT' : 'NOT SIGNIFICANT'}</span>
                        </div>
                        <div className="flex justify-between items-baseline mb-4">
                           <span className="text-4xl font-bold" style={{ color: C.ink }}>{analysis.result.p < 0.001 ? '< 0.001' : analysis.result.p?.toFixed(4)}</span>
                           <span className="text-sm font-bold" style={{ color: C.rust }}>p-value</span>
                        </div>
                        <div className="pt-4 border-t flex justify-between" style={{ borderColor: `${C.rust}33` }}>
                          <HeaderStat label="Statistic" value={analysis.result.stat?.toFixed(3)} />
                          <HeaderStat label="DF" value={analysis.result.df?.toFixed(1) || analysis.result.df} />
                          <HeaderStat label="Test" value={analysis.result.name.includes('T-Test') ? 'Welch' : 'Chi-Sq'} />
                        </div>

                        <div className="mt-6 flex-1 bg-white p-6 rounded-xl border shadow-sm relative overflow-hidden" style={{ borderColor: C.line }}>
                           <div className="absolute top-0 right-0 p-4">
                             <div className="flex items-center gap-2 px-3 py-1 rounded-full border" style={{ backgroundColor: C.paper, borderColor: C.line }}>
                               <Search className="w-3 h-3" style={{ color: C.teal }} strokeWidth={3} />
                               <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: C.teal }}>AI Interpretation</span>
                             </div>
                           </div>
                           <div className="mt-6">
                             {loading ? (
                               <div className="flex items-center gap-2 text-gray-500"><Loader2 className="w-4 h-4 animate-spin"/> Drafting interpretation...</div>
                             ) : (
                               <MarkdownLite content={analysis.interpretation} />
                             )}
                           </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Auto-Summary of first numeric and categorical column for visual proof */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {headers.slice(0, 4).map((col, idx) => {
                        const colIdx = headers.indexOf(col);
                        const vals = parsedCsv.rows.map(r => r[colIdx]);
                        const type = detectType(vals);
                        
                        if (type === 'numeric') {
                          const stats = describeNumeric(vals);
                          return (
                            <SectionCard key={col} title={col} subtitle="Numeric Variable">
                               <div className="grid grid-cols-2 gap-4">
                                 <HeaderStat label="Mean" value={stats.mean.toFixed(2)} />
                                 <HeaderStat label="Median" value={stats.median.toFixed(2)} />
                                 <HeaderStat label="Min" value={stats.min.toFixed(2)} />
                                 <HeaderStat label="Max" value={stats.max.toFixed(2)} />
                               </div>
                            </SectionCard>
                          )
                        } else {
                          const stats = describeCategorical(vals);
                          const chartData = stats.slice(0, 5); // top 5
                          return (
                             <SectionCard key={col} title={col} subtitle="Categorical Variable">
                                <div className="h-40 w-full mt-2">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={C.line} />
                                      <XAxis type="number" hide />
                                      <YAxis dataKey="label" type="category" width={80} tick={{ fontSize: 10, fill: C.inkSoft }} axisLine={false} tickLine={false} />
                                      <Tooltip cursor={{fill: C.paper}} contentStyle={{ borderRadius: '8px', border: `1px solid ${C.line}`, fontSize: '12px' }} />
                                      <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                                        {chartData.map((entry, index) => (
                                          <Cell key={`cell-${index}`} fill={index === 0 ? C.teal : C.tealDark} opacity={1 - (index * 0.15)} />
                                        ))}
                                      </Bar>
                                    </BarChart>
                                  </ResponsiveContainer>
                                </div>
                             </SectionCard>
                          )
                        }
                      })}
                    </div>
                    
                    <div className="flex justify-end pt-4">
                       <PrimaryButton onClick={handleNext} disabled={!analysis.result}>Draft Manuscript</PrimaryButton>
                    </div>

                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Phase 5: Report */}
        {currentStep === 5 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-end mb-6">
              <div>
                <Eyebrow>Final Output</Eyebrow>
                <h2 className="text-2xl font-bold" style={{ color: C.ink }}>Academic Manuscript</h2>
              </div>
              <div className="flex gap-3">
                <SecondaryButton onClick={generateReport} loading={loading} icon={RefreshCcw}>Generate Draft</SecondaryButton>
                {report && <PrimaryButton onClick={copyReport} icon={Clipboard}>Copy Text</PrimaryButton>}
              </div>
            </div>
            
            {!report && !loading ? (
               <SectionCard>
                 <div className="text-center py-12">
                   <PenTool className="w-12 h-12 mx-auto mb-4 opacity-20" style={{ color: C.ink }} />
                   <p style={{ color: C.inkSoft }}>Click "Generate Draft" to write the 5-part manuscript using your protocol and analysis.</p>
                 </div>
               </SectionCard>
            ) : (
              <div className="space-y-8 max-w-3xl mx-auto pb-8">
                <div className="text-center mb-10">
                   <h1 className="text-3xl font-bold mb-4 uppercase" style={{ color: C.ink }}>{formData.topic}</h1>
                   <p className="text-lg italic" style={{ color: C.inkSoft }}>A study in {formData.population}</p>
                </div>
                
                {['introduction', 'methods', 'results', 'discussion', 'conclusion', 'references'].map((section) => (
                  <div key={section} className="mb-8">
                    <h3 className="text-xl font-bold mb-4 uppercase tracking-wider border-b pb-2" style={{ color: C.tealDark, borderColor: C.line }}>
                      {section}
                    </h3>
                    <div className="text-sm leading-relaxed" style={{ color: C.ink }}>
                       {loading && !report?.[section] ? (
                         <div className="flex gap-2 items-center text-gray-400"><Loader2 className="w-4 h-4 animate-spin"/> Drafting {section}...</div>
                       ) : (
                         <MarkdownLite content={report?.[section] || ''} />
                       )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        </div>
      </main>
    </div>
  );
}
