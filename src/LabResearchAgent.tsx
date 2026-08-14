import React, { useState, useEffect, useMemo } from 'react';
import { 
  Beaker, Search, FileSpreadsheet, BarChart2, PenTool, CheckCircle, 
  Loader2, ArrowRight, Download, AlertCircle, PlayCircle,
  Trash2, FolderOpen, Plus, X, Moon, Sun, Activity, BookOpen, FileText, Database, Microscope
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';

// API Helper
async function callGemini(prompt: string, opts: { system?: string, webSearch?: boolean, highThinking?: boolean } = {}) {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, system: opts.system, webSearch: opts.webSearch, highThinking: opts.highThinking })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch');
  return data.text;
}

// Stats Math Helpers
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
    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-[var(--text-primary)]">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/```(.*?)```/gs, '<pre class="p-4 rounded-xl my-4 text-sm font-mono overflow-x-auto bg-[var(--bg-paper-hover)] border border-[var(--border-color)] text-[var(--text-primary)]"><code>$1</code></pre>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/^- (.*)$/gm, '<li class="ml-4">$1</li>')
    .replace(/(<li class="ml-4">.*<\/li>)/s, '<ul class="list-disc pl-5 my-4 space-y-2 text-[var(--text-secondary)]">$1</ul>')
    .replace(/### (.*)/g, '<h4 class="text-md font-bold mt-6 mb-3 text-[var(--text-primary)] font-serif">$1</h4>')
    .replace(/## (.*)/g, '<h3 class="text-xl font-bold mt-8 mb-4 border-b pb-2 border-[var(--border-color)] text-[var(--text-primary)] font-serif">$1</h3>');

  return <div dangerouslySetInnerHTML={{ __html: parsed }} className="text-[15px] leading-relaxed text-[var(--text-secondary)]" />;
};

const SectionCard = ({ children, title, subtitle, className="" }: { children: React.ReactNode, title?: string, subtitle?: string, className?: string }) => (
  <motion.div 
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className={`bg-[var(--bg-paper)] p-6 md:p-8 rounded-2xl border border-[var(--border-color)] shadow-sm mb-6 ${className}`}
  >
    {(title || subtitle) && (
      <div className="mb-6 pb-4 border-b border-[var(--border-color)]">
        {subtitle && <span className="text-[10px] uppercase font-black block tracking-widest mb-2 text-[var(--accent-primary)]">{subtitle}</span>}
        {title && <h3 className="text-xl font-bold font-serif text-[var(--text-primary)]">{title}</h3>}
      </div>
    )}
    {children}
  </motion.div>
);

const PrimaryButton = ({ children, onClick, disabled, loading, icon: Icon, className="" }: any) => (
  <button 
    onClick={onClick} 
    disabled={disabled || loading}
    className={`px-6 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 
      bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)]
      disabled:opacity-50 disabled:cursor-not-allowed shadow-sm ${className}`}
  >
    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (Icon && <Icon className="w-4 h-4" />)}
    {children}
  </button>
);

const SecondaryButton = ({ children, onClick, disabled, loading, icon: Icon, className="" }: any) => (
  <button 
    onClick={onClick} 
    disabled={disabled || loading}
    className={`px-6 py-3 rounded-xl text-sm font-bold border transition-colors flex items-center justify-center gap-2 
      border-[var(--border-color)] bg-[var(--bg-paper)] text-[var(--text-primary)] hover:bg-[var(--bg-paper-hover)]
      disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
  >
    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (Icon && <Icon className="w-4 h-4" />)}
    {children}
  </button>
);

const HeaderStat = ({ label, value }: { label: string, value: string|number }) => (
  <div className="flex flex-col">
    <span className="text-[10px] uppercase font-bold tracking-widest text-[var(--text-muted)] mb-1">{label}</span>
    <span className="text-xl font-bold font-serif text-[var(--text-primary)]">{value}</span>
  </div>
);

// Main Component
export default function LabResearchAgent() {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Theme state
  const [isDark, setIsDark] = useState(() => {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDark]);
  
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
      startNewProject();
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
    { id: 1, label: 'Parameters', desc: 'Define clinical focus', icon: Microscope },
    { id: 2, label: 'Literature', desc: 'Identify research gaps', icon: BookOpen },
    { id: 3, label: 'Protocol', desc: 'Draft study design', icon: FileText },
    { id: 4, label: 'Inference', desc: 'Statistical analysis', icon: Database },
    { id: 5, label: 'Manuscript', desc: 'Generate final paper', icon: PenTool }
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
      
      const res = await callGemini(prompt, { highThinking: true });
      
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
      
      const interpretation = await callGemini(aiPrompt, { highThinking: true });
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
        
        const res = await callGemini(prompt, { highThinking: true });
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
    <div className="flex h-screen w-full overflow-hidden bg-[var(--bg-app)]">
      
      {/* Sidebar Navigation */}
      <aside className="w-72 flex-shrink-0 bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)] flex flex-col z-20 hidden md:flex">
        <div className="p-8 border-b border-[var(--sidebar-border)] flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-primary-hover)] flex items-center justify-center shadow-lg">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold font-serif text-[var(--sidebar-text)] leading-tight">Synapse</h1>
            <p className="text-[10px] uppercase tracking-widest text-[var(--accent-primary)] font-bold">Research Studio</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <div className="text-[11px] font-bold uppercase tracking-widest text-[var(--sidebar-text-muted)] mb-4 px-4 mt-4">Study Pipeline</div>
          {steps.map((step) => {
            const isActive = currentStep === step.id;
            const isPast = currentStep > step.id;
            const Icon = step.icon;
            
            return (
              <button
                key={step.id}
                onClick={() => isPast ? setCurrentStep(step.id) : null}
                disabled={!isPast && !isActive}
                className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all text-left
                  ${isActive ? 'bg-[var(--sidebar-active)] text-white shadow-md' : 
                    isPast ? 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)]' : 
                    'text-[var(--sidebar-text-muted)] opacity-50 cursor-not-allowed'}`}
              >
                <div className={`p-2 rounded-lg ${isActive ? 'bg-white/20' : 'bg-[var(--sidebar-border)]'}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-bold">{step.label}</div>
                  <div className={`text-xs ${isActive ? 'text-white/80' : 'text-[var(--sidebar-text-muted)]'}`}>{step.desc}</div>
                </div>
              </button>
            )
          })}
        </nav>

        <div className="p-4 border-t border-[var(--sidebar-border)]">
           <button 
             onClick={() => setShowHistory(true)}
             className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] transition-colors border border-[var(--sidebar-border)]"
           >
             <FolderOpen className="w-4 h-4 text-[var(--accent-primary)]" />
             <span className="text-sm font-bold">Workspace Memory</span>
           </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        
        {/* Mobile Header (Hidden on Desktop) */}
        <header className="md:hidden p-4 border-b border-[var(--border-color)] bg-[var(--bg-paper)] flex justify-between items-center z-10">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg bg-[var(--accent-primary)] flex items-center justify-center">
               <Activity className="w-4 h-4 text-white" />
             </div>
             <h1 className="text-lg font-bold font-serif text-[var(--text-primary)]">Synapse</h1>
          </div>
          <button onClick={() => setShowHistory(true)} className="p-2 rounded-lg bg-[var(--bg-paper-hover)]">
            <FolderOpen className="w-5 h-5 text-[var(--text-primary)]" />
          </button>
        </header>

        {/* Topbar Actions */}
        <div className="absolute top-6 right-8 z-10 hidden md:flex items-center gap-4">
          <button 
            onClick={() => setIsDark(!isDark)}
            className="p-3 rounded-full bg-[var(--bg-paper)] border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--bg-paper-hover)] transition-colors shadow-sm"
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>

        <main className="flex-1 overflow-y-auto p-6 md:p-12 relative z-0">
          <div className="max-w-4xl mx-auto pb-24">
            
            <AnimatePresence mode="wait">
              {error && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-6">
                   <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400 border border-red-200 dark:border-red-900/50 flex items-start gap-3">
                     <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                     <p className="text-sm font-medium">{error}</p>
                   </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
            
            {/* Phase 1: Specimen */}
            {currentStep === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                <div className="mb-10">
                  <span className="text-[10px] uppercase font-black tracking-widest text-[var(--accent-primary)] mb-2 block">Phase 01</span>
                  <h2 className="text-4xl font-serif font-bold text-[var(--text-primary)]">Study Parameters</h2>
                  <p className="text-[var(--text-secondary)] mt-2">Define the clinical setting and focus of your diagnostic study.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <SectionCard className="md:col-span-2 m-0 border-none shadow-md bg-[var(--bg-paper)]">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-bold mb-2 text-[var(--text-primary)]">Research Topic</label>
                        <input 
                          className="w-full p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent outline-none transition-all"
                          placeholder="e.g. Troponin I vs Troponin T performance"
                          value={formData.topic}
                          onChange={(e) => setFormData({...formData, topic: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold mb-2 text-[var(--text-primary)]">Patient Population</label>
                        <input 
                          className="w-full p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent outline-none transition-all"
                          placeholder="e.g. Emergency Department chest pain"
                          value={formData.population}
                          onChange={(e) => setFormData({...formData, population: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold mb-2 text-[var(--text-primary)]">Laboratory Section</label>
                        <select 
                          className="w-full p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent outline-none transition-all appearance-none"
                          value={formData.labSection}
                          onChange={(e) => setFormData({...formData, labSection: e.target.value})}
                        >
                          {['Hematology', 'Clinical Chemistry', 'Microbiology', 'Blood Bank', 'Immunology', 'Molecular Diagnostics'].map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold mb-2 text-[var(--text-primary)]">Study Type</label>
                        <select 
                          className="w-full p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent outline-none transition-all appearance-none"
                          value={formData.studyType}
                          onChange={(e) => setFormData({...formData, studyType: e.target.value})}
                        >
                          {['Method Comparison', 'Reference Interval', 'Diagnostic Accuracy', 'Quality Control Evaluation', 'Workflow Analysis'].map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </SectionCard>
                </div>
                <div className="flex justify-end pt-4">
                  <PrimaryButton onClick={handleNext} icon={ArrowRight}>Proceed to Literature Search</PrimaryButton>
                </div>
              </motion.div>
            )}

            {/* Phase 2: Literature */}
            {currentStep === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
                  <div>
                    <span className="text-[10px] uppercase font-black tracking-widest text-[var(--accent-primary)] mb-2 block">Phase 02</span>
                    <h2 className="text-4xl font-serif font-bold text-[var(--text-primary)]">Literature Review</h2>
                    <p className="text-[var(--text-secondary)] mt-2">Identify high-impact research gaps using AI grounded in recent literature.</p>
                  </div>
                  <PrimaryButton onClick={handleGenerateGaps} loading={loading} icon={Search}>Generate Novel Gaps</PrimaryButton>
                </div>
                
                {gaps.length > 0 ? (
                  <div className="space-y-4">
                    {gaps.map((gap, idx) => (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        key={idx} 
                        onClick={() => setSelectedGap(gap)}
                        className={`p-6 rounded-2xl border-2 cursor-pointer transition-all ${selectedGap === gap ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-light)] shadow-md' : 'border-[var(--border-color)] bg-[var(--bg-paper)] hover:border-[var(--text-muted)]'}`}
                      >
                        <div className="flex gap-4">
                          <div className="pt-1 shrink-0">
                            <CheckCircle className={`w-6 h-6 ${selectedGap === gap ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)]'}`} />
                          </div>
                          <p className={`text-base leading-relaxed font-medium ${selectedGap === gap ? 'text-[var(--accent-primary-light)] dark:text-[var(--text-primary)]' : 'text-[var(--text-primary)]'}`}>{gap}</p>
                        </div>
                      </motion.div>
                    ))}
                    
                    <div className="mt-8 flex justify-between pt-8 border-t border-[var(--border-color)]">
                      <SecondaryButton onClick={handlePrev}>Back</SecondaryButton>
                      <PrimaryButton onClick={handleGenerateProtocol} loading={loading} disabled={!selectedGap}>Draft Study Protocol</PrimaryButton>
                    </div>
                  </div>
                ) : (
                  <SectionCard className="text-center py-20 bg-transparent border-dashed">
                    <BookOpen className="w-16 h-16 mx-auto mb-6 opacity-20 text-[var(--text-primary)]" />
                    <p className="text-[var(--text-secondary)] text-lg max-w-md mx-auto">Click the button above to scan recent scientific literature and generate actionable research hypotheses.</p>
                  </SectionCard>
                )}
              </motion.div>
            )}

            {/* Phase 3: Protocol */}
            {currentStep === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                <div className="mb-8">
                  <span className="text-[10px] uppercase font-black tracking-widest text-[var(--accent-primary)] mb-2 block">Phase 03</span>
                  <h2 className="text-4xl font-serif font-bold text-[var(--text-primary)]">Study Protocol</h2>
                  <p className="text-[var(--text-secondary)] mt-2">Generated methodology and required data dictionary.</p>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                  <div className="xl:col-span-2">
                    <SectionCard title="Methodology">
                      <MarkdownLite content={protocol.text || "No protocol generated yet."} />
                    </SectionCard>
                  </div>
                  <div>
                    <SectionCard title="Data Dictionary">
                      <p className="text-sm mb-6 text-[var(--text-secondary)]">The AI generated a structural template for data collection required for this study.</p>
                      
                      {protocol.template ? (
                        <div className="bg-[var(--bg-app)] p-4 rounded-xl border border-[var(--border-color)] font-mono text-[11px] overflow-x-auto mb-6 whitespace-nowrap text-[var(--text-primary)]">
                          {protocol.template}
                        </div>
                      ) : (
                         <div className="text-sm italic mb-6 text-[var(--text-muted)]">No template available.</div>
                      )}
                      
                      <PrimaryButton 
                        className="w-full mb-6" 
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
                      
                      <div className="pt-6 border-t border-[var(--border-color)] flex flex-col gap-3">
                        <PrimaryButton onClick={handleNext} className="w-full">Proceed to Analysis</PrimaryButton>
                        <SecondaryButton onClick={handlePrev} className="w-full">Back</SecondaryButton>
                      </div>
                    </SectionCard>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Phase 4: Analysis */}
            {currentStep === 4 && (
              <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                <div className="mb-8">
                  <span className="text-[10px] uppercase font-black tracking-widest text-[var(--accent-primary)] mb-2 block">Phase 04</span>
                  <h2 className="text-4xl font-serif font-bold text-[var(--text-primary)]">Statistical Analysis</h2>
                  <p className="text-[var(--text-secondary)] mt-2">Upload your collected CSV data and run automated statistical inference.</p>
                </div>
                
                <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
                  
                  <div className="xl:col-span-1 space-y-6">
                    <SectionCard title="Data Input" className="!p-5">
                      <p className="text-xs mb-3 text-[var(--text-secondary)]">Paste your CSV contents below.</p>
                      <textarea 
                        className="w-full h-48 p-4 border rounded-xl text-xs font-mono mb-4 bg-[var(--bg-app)] border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                        placeholder="Patient_ID,Age,Sex,Result\n1,45,M,2.4..."
                        value={csvData}
                        onChange={(e) => setCsvData(e.target.value)}
                      />
                      <div className="flex justify-between items-center text-xs text-[var(--text-muted)] font-bold tracking-wider uppercase">
                        <span>{headers.length} columns</span>
                        <span>{parsedCsv.rows.length} rows</span>
                      </div>
                    </SectionCard>

                    <AnimatePresence>
                      {headers.length > 0 && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                          <SectionCard title="Inference Engine" className="!p-5 border-l-4 border-l-[var(--accent-primary)]">
                             <select className="w-full p-3 mb-3 border rounded-xl text-sm bg-[var(--bg-app)] border-[var(--border-color)] text-[var(--text-primary)] appearance-none outline-none focus:ring-2" value={analysis.col1} onChange={e => setAnalysis({...analysis, col1: e.target.value})}>
                               <option value="">Select Target A...</option>
                               {headers.map(h => <option key={h} value={h}>{h}</option>)}
                             </select>
                             <select className="w-full p-3 mb-4 border rounded-xl text-sm bg-[var(--bg-app)] border-[var(--border-color)] text-[var(--text-primary)] appearance-none outline-none focus:ring-2" value={analysis.col2} onChange={e => setAnalysis({...analysis, col2: e.target.value})}>
                               <option value="">Select Target B...</option>
                               {headers.map(h => <option key={h} value={h}>{h}</option>)}
                             </select>
                             <PrimaryButton className="w-full" onClick={runAnalysis} loading={loading} icon={PlayCircle}>Run Test</PrimaryButton>
                          </SectionCard>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="xl:col-span-3">
                    {!csvData ? (
                       <div className="h-full flex flex-col items-center justify-center border-2 border-dashed rounded-3xl p-12 text-center border-[var(--border-color)] bg-[var(--bg-paper)] min-h-[400px]">
                         <FileSpreadsheet className="w-16 h-16 mb-6 opacity-20 text-[var(--text-primary)]" />
                         <p className="text-[var(--text-secondary)] text-lg">Provide a dataset to activate the inference engine.</p>
                       </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Test Results Output */}
                        {analysis.result && (
                          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="p-8 rounded-3xl border border-[var(--border-color)] bg-[var(--bg-paper)] shadow-lg relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[var(--accent-primary)] to-indigo-500"></div>
                            
                            <div className="flex justify-between items-start mb-4 mt-2">
                              <span className="text-sm uppercase font-black tracking-widest text-[var(--accent-primary)]">{analysis.result.name}</span>
                              <span className={`px-3 py-1 rounded-full text-xs font-bold text-white ${analysis.result.p < 0.05 ? 'bg-[var(--accent-primary)]' : 'bg-[var(--text-muted)]'}`}>
                                {analysis.result.p < 0.05 ? 'SIGNIFICANT' : 'NOT SIGNIFICANT'}
                              </span>
                            </div>
                            
                            <div className="flex items-end gap-3 mb-8">
                               <span className="text-6xl font-bold font-serif text-[var(--text-primary)] leading-none tracking-tighter">
                                 {analysis.result.p < 0.001 ? '< 0.001' : analysis.result.p?.toFixed(4)}
                               </span>
                               <span className="text-lg font-bold text-[var(--text-muted)] mb-1">p-value</span>
                            </div>
                            
                            <div className="pt-6 border-t border-[var(--border-color)] flex gap-12">
                              <HeaderStat label="Statistic" value={analysis.result.stat?.toFixed(3)} />
                              <HeaderStat label="Degrees of Freedom" value={analysis.result.df?.toFixed(1) || analysis.result.df} />
                            </div>

                            <div className="mt-8 p-6 rounded-2xl bg-[var(--bg-app)] border border-[var(--border-color)] relative">
                               <div className="flex items-center gap-2 mb-4">
                                 <Activity className="w-4 h-4 text-[var(--accent-primary)]" strokeWidth={3} />
                                 <span className="text-xs font-black uppercase tracking-widest text-[var(--accent-primary)]">Automated Interpretation</span>
                               </div>
                               <div>
                                 {loading ? (
                                   <div className="flex items-center gap-3 text-[var(--text-muted)]"><Loader2 className="w-5 h-5 animate-spin"/> Synthesizing clinical interpretation...</div>
                                 ) : (
                                   <MarkdownLite content={analysis.interpretation} />
                                 )}
                               </div>
                            </div>
                          </motion.div>
                        )}
                        
                        {/* Auto-Summary distributions */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {headers.slice(0, 4).map((col, idx) => {
                            const colIdx = headers.indexOf(col);
                            const vals = parsedCsv.rows.map(r => r[colIdx]);
                            const type = detectType(vals);
                            
                            if (type === 'numeric') {
                              const stats = describeNumeric(vals);
                              return (
                                <SectionCard key={col} title={col} subtitle="Numeric Variable" className="!p-6">
                                   <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                                     <HeaderStat label="Mean" value={stats.mean.toFixed(2)} />
                                     <HeaderStat label="Median" value={stats.median.toFixed(2)} />
                                     <HeaderStat label="Min" value={stats.min.toFixed(2)} />
                                     <HeaderStat label="Max" value={stats.max.toFixed(2)} />
                                   </div>
                                </SectionCard>
                              )
                            } else {
                              const stats = describeCategorical(vals);
                              const chartData = stats.slice(0, 5);
                              return (
                                 <SectionCard key={col} title={col} subtitle="Categorical Variable" className="!p-6">
                                    <div className="h-40 w-full mt-2">
                                      <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-color)" />
                                          <XAxis type="number" hide />
                                          <YAxis dataKey="label" type="category" width={80} tick={{ fontSize: 11, fill: 'var(--text-muted)', fontWeight: 600 }} axisLine={false} tickLine={false} />
                                          <Tooltip cursor={{fill: 'var(--bg-paper-hover)'}} contentStyle={{ borderRadius: '12px', border: `1px solid var(--border-color)`, backgroundColor: 'var(--bg-paper)', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 'bold' }} />
                                          <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                                            {chartData.map((entry, index) => (
                                              <Cell key={`cell-${index}`} fill="var(--accent-primary)" opacity={1 - (index * 0.15)} />
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
                        
                        <div className="flex justify-between pt-6 border-t border-[var(--border-color)]">
                           <SecondaryButton onClick={handlePrev}>Back</SecondaryButton>
                           <PrimaryButton onClick={handleNext} disabled={!analysis.result}>Draft Manuscript</PrimaryButton>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Phase 5: Report */}
            {currentStep === 5 && (
              <motion.div key="step5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
                  <div>
                    <span className="text-[10px] uppercase font-black tracking-widest text-[var(--accent-primary)] mb-2 block">Phase 05</span>
                    <h2 className="text-4xl font-serif font-bold text-[var(--text-primary)]">Final Manuscript</h2>
                    <p className="text-[var(--text-secondary)] mt-2">Generate a fully drafted academic paper based on your results.</p>
                  </div>
                  <div className="flex gap-3">
                    {report && <SecondaryButton onClick={copyReport} icon={Clipboard}>Copy Text</SecondaryButton>}
                    <PrimaryButton onClick={generateReport} loading={loading} icon={PenTool}>{report ? "Regenerate" : "Draft Manuscript"}</PrimaryButton>
                  </div>
                </div>

                {!report && !loading && (
                  <SectionCard className="text-center py-24 bg-transparent border-dashed">
                     <PenTool className="w-16 h-16 mx-auto mb-6 opacity-20 text-[var(--text-primary)]" />
                     <p className="text-[var(--text-secondary)] text-lg max-w-md mx-auto">Click "Draft Manuscript" to instruct the LLM to write a complete academic paper using your statistical findings and literature gap.</p>
                  </SectionCard>
                )}

                {loading && (
                  <SectionCard className="text-center py-32 flex flex-col items-center justify-center">
                    <Loader2 className="w-12 h-12 animate-spin text-[var(--accent-primary)] mb-6" />
                    <h3 className="text-xl font-bold font-serif text-[var(--text-primary)] mb-2">Drafting Manuscript...</h3>
                    <p className="text-[var(--text-muted)] max-w-sm">Synthesizing introduction, methods, results, and discussion into an academic format with real citations.</p>
                  </SectionCard>
                )}

                {report && !loading && (
                  <div className="bg-[var(--bg-paper)] border border-[var(--border-color)] rounded-3xl p-8 md:p-16 shadow-lg max-w-4xl mx-auto">
                    <div className="text-center mb-16 border-b border-[var(--border-color)] pb-12">
                       <h1 className="text-3xl md:text-5xl font-bold font-serif mb-6 text-[var(--text-primary)] leading-tight">
                         {formData.topic}
                       </h1>
                       <p className="text-xl italic font-serif text-[var(--text-secondary)]">A study in {formData.population}</p>
                    </div>
                    
                    {['introduction', 'methods', 'results', 'discussion', 'conclusion', 'references'].map((section) => (
                      <div key={section} className="mb-12">
                        <h3 className="text-2xl font-bold font-serif mb-6 uppercase tracking-wider text-[var(--text-primary)] border-b border-[var(--border-color)] pb-3">
                          {section}
                        </h3>
                        <MarkdownLite content={report[section] || ''} />
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* History Slide-over */}
      <AnimatePresence>
        {showHistory && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setShowHistory(false)}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-full max-w-md z-50 bg-[var(--bg-paper)] shadow-2xl flex flex-col border-l border-[var(--border-color)]"
            >
              <div className="p-6 border-b border-[var(--border-color)] flex justify-between items-center bg-[var(--bg-app)]">
                <div className="flex items-center gap-3">
                  <FolderOpen className="w-5 h-5 text-[var(--accent-primary)]" />
                  <h2 className="text-lg font-bold uppercase tracking-widest text-[var(--text-primary)]">Workspace</h2>
                </div>
                <button onClick={() => setShowHistory(false)} className="p-2 rounded-lg hover:bg-[var(--border-color)] text-[var(--text-secondary)] transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 flex-1 overflow-y-auto flex flex-col gap-4">
                <button 
                  onClick={startNewProject}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-xl border-2 border-dashed border-[var(--accent-primary)] text-[var(--accent-primary)] hover:bg-[var(--accent-primary-light)] dark:hover:bg-[var(--accent-primary)]/10 transition-colors shadow-sm"
                >
                  <Plus className="w-5 h-5" />
                  <span className="font-bold uppercase tracking-wider text-sm">Initialize New Study</span>
                </button>
                
                <div className="mt-4 space-y-3">
                  {projectsList.sort((a,b) => b.updatedAt - a.updatedAt).map(proj => (
                    <div 
                      key={proj.id} 
                      onClick={() => loadProject(proj)}
                      className={`p-5 rounded-xl border-2 cursor-pointer transition-all flex justify-between items-start group
                        ${proj.id === projectId 
                          ? 'border-[var(--accent-primary)] bg-[var(--bg-app)] shadow-md' 
                          : 'border-[var(--border-color)] bg-[var(--bg-paper)] hover:border-[var(--text-muted)]'}`}
                    >
                      <div className="flex-1 pr-4">
                        <p className={`text-sm font-bold uppercase tracking-wider mb-2 line-clamp-2 leading-snug 
                          ${proj.id === projectId ? 'text-[var(--accent-primary)]' : 'text-[var(--text-primary)]'}`}>
                          {proj.formData.topic || "Untitled Study"}
                        </p>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] px-2 py-1 rounded bg-[var(--bg-paper-hover)] uppercase tracking-widest font-bold text-[var(--text-secondary)]">
                            Phase {proj.currentStep}
                          </span>
                          <span className="text-[10px] uppercase tracking-widest font-semibold text-[var(--text-muted)]">
                            {new Date(proj.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <button 
                        onClick={(e) => deleteProject(proj.id, e)}
                        className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-[var(--text-muted)] hover:text-red-600 transition-colors"
                        title="Delete project"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
