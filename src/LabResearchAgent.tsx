import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Beaker, Search, FileSpreadsheet, BarChart2, PenTool, CheckCircle, 
  Loader2, ArrowRight, Download, AlertCircle, PlayCircle,
  Trash2, FolderOpen, Plus, X, Moon, Sun, Activity, BookOpen, FileText, Database, Microscope, Clipboard, AlertTriangle, Upload
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import Papa from 'papaparse';
import jStat from 'jstat';

import { Button } from "@/components/ui/button";
import { Card as ShadCard, CardContent as ShadCardContent, CardHeader as ShadCardHeader, CardTitle as ShadCardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge as ShadBadge } from "@/components/ui/badge";
import { Progress as ShadProgress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, Metric, Text, ProgressBar, Badge, BarList, List, ListItem, Tracker } from "@/components/tremor";


// API Helper
async function callGemini(prompt: string, opts: { system?: string, webSearch?: boolean, highThinking?: boolean, schemaId?: string } = {}) {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, system: opts.system, webSearch: opts.webSearch, highThinking: opts.highThinking, schemaId: opts.schemaId })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch');
  return data.text;
}

// Stats Math Helpers
const parseCSV = (csv: string) => {
  const result = Papa.parse(csv.trim(), { skipEmptyLines: true });
  if (result.data.length < 2) return { headers: [], rows: [] };
  const headers = (result.data[0] as string[]).map(h => h.trim());
  const rows = result.data.slice(1).map((row: any) => {
    return row.map((val: string) => {
      const trimmed = val.trim();
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
  return Object.entries(counts).map(([label, count]) => {
    const c = count as number;
    return { label, count: c, percentage: ((c / total) * 100).toFixed(1) };
  }).sort((a, b) => b.count - a.count);
};

const chiSquarePValue = (chiSq: number, df: number) => {
  if (df <= 0) return 1;
  return 1 - jStat.chisquare.cdf(chiSq, df);
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
  
  const p = 2 * (1 - jStat.studentt.cdf(Math.abs(t), df));
  
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

const SectionCard: React.FC<{ children: React.ReactNode, title?: string, subtitle?: string, className?: string }> = ({ children, title, subtitle, className="" }) => (
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

  // New API State
  const [pubMedResults, setPubMedResults] = useState<any[]>([]); // Deprecated, replaced by evidencePool but kept for now
  const [evidencePool, setEvidencePool] = useState<any[]>([]);
  const [topicSaturation, setTopicSaturation] = useState<any>(null); // { saturation: string, justification: string }
  const [loadingPubMed, setLoadingPubMed] = useState(false);
  const [selectedPaperForAnnotation, setSelectedPaperForAnnotation] = useState<any>(null);
  const [clinicalTrials, setClinicalTrials] = useState<any[]>([]);
  const [loadingTrials, setLoadingTrials] = useState(false);

  // Refinement pass state
  const [refinementFlags, setRefinementFlags] = useState<any[]>([]);
  const [isRefining, setIsRefining] = useState(false);
  const [isReportFinalized, setIsReportFinalized] = useState(false);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

  const [screeningCounts, setScreeningCounts] = useState<{initial: number, deduplicated: number, screened: number, included: number} | null>(null);
  const [preFinalChecklist, setPreFinalChecklist] = useState({
    citationsVerified: false,
    methodologyDocumented: false,
    criteriaStated: false,
    exclusionsDocumented: false,
    limitationsAcknowledged: false,
    stardAdherence: false,
    biasAcknowledged: false
  });

  const [literatureData, setLiteratureData] = useState<any[]>([]);

  const loadProject = (p: any) => {
    setProjectId(p.id);
    setFormData(p.formData || { topic: '', labSection: 'Hematology', studyType: 'Method Comparison', population: '' });
    setGaps(p.gaps || []);
    setSelectedGap(p.selectedGap || '');
    setProtocol(p.protocol || { text: '', template: '' });
    setCsvData(p.csvData || '');
    setAnalysis(p.analysis || { col1: '', col2: '', result: null, interpretation: '' });
    setReport(p.report || null);
    setPubMedResults(p.pubMedResults || []);
    setEvidencePool(p.evidencePool || []);
    setTopicSaturation(p.topicSaturation || null);
    setClinicalTrials(p.clinicalTrials || []);
    setLiteratureData(p.literatureData || []);
    setScreeningCounts(p.screeningCounts || null);
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
    setPubMedResults([]);
    setEvidencePool([]);
    setTopicSaturation(null);
    setClinicalTrials([]);
    setLiteratureData([]);
    setScreeningCounts(null);
    setRefinementFlags([]);
    setIsReportFinalized(false);
    setPreFinalChecklist({
      citationsVerified: false,
      methodologyDocumented: false,
      criteriaStated: false,
      exclusionsDocumented: false,
      limitationsAcknowledged: false,
      stardAdherence: false,
      biasAcknowledged: false
    });
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

  const fileInputRef = useRef<HTMLInputElement>(null);

  const exportProject = () => {
    const projectData = {
      id: projectId,
      updatedAt: Date.now(),
      currentStep, formData, gaps, selectedGap, protocol, csvData, analysis, report
    };
    const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `project_${projectId}.json`;
    a.click();
  };

  const importProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (imported.id) {
          loadProject(imported);
        } else {
          setError("Invalid project file format.");
        }
      } catch (err) {
        setError("Failed to parse project file.");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
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
        currentStep, formData, gaps, selectedGap, protocol, csvData, analysis, report, pubMedResults, evidencePool, topicSaturation, clinicalTrials, literatureData
      };
      const nextList = [...prev];
      if (idx >= 0) nextList[idx] = newProj;
      else nextList.push(newProj);
      
      mockStorage.setItem('lab_research_projects', JSON.stringify(nextList));
      return nextList;
    });
  }, [currentStep, formData, gaps, selectedGap, protocol, csvData, analysis, report, projectId, evidencePool, topicSaturation]);

  const handleNext = () => setCurrentStep(prev => Math.min(prev + 1, 5));
  const handlePrev = () => setCurrentStep(prev => Math.max(prev - 1, 1));

  const handleSearchPubMed = async () => {
    if (!formData.topic) return setError("Enter a research topic in Phase 1 first.");
    setLoadingPubMed(true);
    try {
      const searchRes = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(formData.topic)}&retmode=json&retmax=5`);
      const searchData = await searchRes.json();
      if (!searchData.esearchresult || !searchData.esearchresult.idlist.length) {
        throw new Error("No PubMed results found.");
      }
      const ids = searchData.esearchresult.idlist.join(',');
      const summaryRes = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids}&retmode=json`);
      const summaryData = await summaryRes.json();
      const docs = searchData.esearchresult.idlist.map((id: string) => summaryData.result[id]);
      setPubMedResults(docs);
    } catch (err: any) {
      setError("PubMed search failed: " + err.message);
    } finally {
      setLoadingPubMed(false);
    }
  };

  const handleSearchTrials = async () => {
    if (!formData.topic) return setError("Enter a research topic in Phase 1 first.");
    setLoadingTrials(true);
    try {
      const res = await fetch(`https://clinicaltrials.gov/api/v2/studies?query.cond=${encodeURIComponent(formData.topic)}&pageSize=3`);
      const data = await res.json();
      if (!data.studies || data.studies.length === 0) throw new Error("No clinical trials found.");
      setClinicalTrials(data.studies);
    } catch (err: any) {
      setError("ClinicalTrials.gov search failed: " + err.message);
    } finally {
      setLoadingTrials(false);
    }
  };

  const loadSampleDataset = () => {
    const sample = `Patient_ID,Age,Sex,Troponin_I,Troponin_T,Clinical_Outcome
1,45,M,0.04,0.05,Negative
2,62,F,0.12,0.14,Positive
3,55,M,0.08,0.09,Negative
4,71,M,0.45,0.52,Positive
5,38,F,0.01,0.02,Negative
6,82,F,0.88,1.05,Positive
7,49,M,0.06,0.06,Negative
8,66,F,0.22,0.25,Positive
9,53,M,0.05,0.06,Negative
10,77,M,0.31,0.34,Positive
11,41,F,0.02,0.02,Negative
12,69,M,0.55,0.61,Positive
13,58,F,0.07,0.08,Negative
14,74,M,0.92,1.10,Positive
15,35,M,0.03,0.03,Negative
16,61,F,0.18,0.21,Positive
17,50,M,0.05,0.06,Negative
18,80,F,0.76,0.85,Positive
19,48,M,0.04,0.05,Negative
20,68,F,0.41,0.47,Positive`;
    setCsvData(sample);
  };

  const steps = [
    { id: 1, label: 'Parameters', desc: 'Define clinical focus', icon: Microscope },
    { id: 2, label: 'Literature', desc: 'Identify research gaps', icon: BookOpen },
    { id: 3, label: 'Protocol', desc: 'Draft study design', icon: FileText },
    { id: 4, label: 'Inference', desc: 'Statistical analysis', icon: Database },
    { id: 5, label: 'Manuscript', desc: 'Generate final paper', icon: PenTool }
  ];

  const handleAutomatedReview = async () => {
    if (!formData.topic) return setError("Enter a research topic in Phase 1 first.");
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(formData.topic)}&limit=40&fields=title,abstract,year,authors,citationCount`);
      const data = await res.json();
      
      if (!data.data || data.data.length === 0) {
         throw new Error("No papers found on Semantic Scholar for this topic.");
      }
      
      setLiteratureData(data.data);
      
      const prompt = `Perform a statistical synthesis and meta-analysis summary of the following ${data.data.length} papers on the topic: "${formData.topic}". 
      Extract common themes, conflicting evidence, and overall consensus. Write this as a highly academic, quantitative summary.
      
      Papers Data:
      ${JSON.stringify(data.data.map((p: any) => ({ title: p.title, year: p.year, citations: p.citationCount, abstract: p.abstract?.substring(0, 300) })))}
      `;
      
      const synthesis = await callGemini(prompt, { highThinking: true });
      
      setAnalysis({
        result: { name: 'Automated Meta-Analysis', p: 0.001, stat: data.data.length, df: 'Papers' },
        interpretation: synthesis
      });
      
    } catch(err: any) {
      setError("Literature Review Failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAndScreenLiterature = async () => {
    if (!formData.topic || !formData.population) return setError("Please fill out all fields.");
    setError('');
    setLoading(true);
    try {
      // 1. Fetch from backend API
      let docs: any[] = [];
      let counts = { initial: 0, deduplicated: 0, screened: 0, included: 0 };
      try {
        setLoadingPubMed(true);
        const query = `${formData.topic} ${formData.population} ${formData.labSection}`;
        const searchRes = await fetch(`/api/literature-search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query })
        });
        const searchData = await searchRes.json();
        if (searchData.results && searchData.results.length > 0) {
          docs = searchData.results;
          counts.initial = searchData.counts?.initial || docs.length;
          counts.deduplicated = searchData.counts?.deduplicated || docs.length;
          counts.screened = docs.length;
        } else {
          throw new Error("No literature found.");
        }
      } catch (e) {
        console.warn("Could not fetch literature for context", e);
        throw new Error("Failed to fetch literature.");
      } finally {
        setLoadingPubMed(false);
      }

      const litContext = docs.map((d: any) => `ID: ${d.uid} | Title: ${d.title} | Abstract: ${d.abstract?.substring(0,300)}...`).join('\n');

      const prompt = `Act as an expert systematic review screener. 
      The user is planning a ${formData.studyType} study on "${formData.topic}" in "${formData.population}".
      
      Here are the fetched papers:
      ${litContext}
      
      Screen these papers for relevance to the specific topic and population.
      Format the output EXACTLY as a JSON array of objects:
      [
        {
          "uid": "ID of the paper",
          "included": true or false,
          "reason": "1-line reason for inclusion or exclusion"
        }
      ]
      Do not include markdown formatting for the JSON.`;
      
      const res = await callGemini(prompt, { webSearch: false, highThinking: false, schemaId: 'screening-funnel' });
      const parsed = JSON.parse(res);
      
      const screenedDocs = docs.map(d => {
        const screenResult = parsed.find((p: any) => p.uid === String(d.uid));
        return {
          ...d,
          included: screenResult ? screenResult.included : true,
          reason: screenResult ? screenResult.reason : 'Auto-included'
        };
      });

      counts.included = screenedDocs.filter(d => d.included).length;
      setScreeningCounts(counts);
      setEvidencePool(screenedDocs);
    } catch (err: any) {
      setError(err.message || "Failed to fetch and screen literature.");
    } finally {
      setLoading(false);
      setCurrentStep(2); // Move to step 2 after fetching and screening
    }
  };

  const handleGenerateGaps = async () => {
    if (evidencePool.filter(d => d.included).length === 0) return setError("No included papers to analyze.");
    setError('');
    setLoading(true);
    try {
      const includedDocs = evidencePool.filter(d => d.included);
      const litContext = includedDocs.map((d: any) => `ID: ${d.uid} | Title: ${d.title} (${d.pubdate}, ${d.origin}) | Abstract: ${d.abstract}`).join('\n\n');

      const prompt = `Act as an expert medical laboratory scientist and literature analyst. 
      The user is planning a single-center ${formData.studyType} study in the ${formData.labSection} department focusing on "${formData.topic}" in "${formData.population}".
      
      Here is the fetched, included evidence pool:
      ${litContext}
      
      CRITICAL RULE 1: You must never state a finding, statistic, or pooled result unless it is directly present in the provided abstract text.
      CRITICAL RULE 2: The gaps you identify MUST NOT be generated from your general knowledge. They MUST be derived STRICTLY from the provided abstracts. You can only identify a gap if the authors of the provided papers explicitly state a limitation, mention a direction for future research, or if you identify a direct conflict between two provided papers.
      CRITICAL RULE 3: If a gap cannot be traced to specific text in an Included paper, you MUST NOT generate it. If the provided literature does not mention any gaps, return an empty array for gaps and state explicitly in the justification that no clear gap was found in the current evidence pool.
      
      First, classify the topic's current state of "Topic Saturation" based ONLY on the fetched literature. Categories: Saturated, Superficially Crowded, Strategically Occupied, Open. Provide a 1-2 sentence justification.
      
      Second, identify up to 3 distinct, highly specific, and clinically actionable research gaps derived DIRECTLY from the literature pool above.
      CRITICAL METHODOLOGY: You MUST organize your gap analysis by overarching theme (e.g., "diagnostic methods", "patient population factors", "reported limitations") and perform a cross-study comparison. Compare and contrast across studies within each theme, noting where studies agree or conflict.
      
      For each gap, you MUST explicitly name which Included paper(s) it is derived from (using the Title and/or ID) in the text. You MUST also provide explicit provenance tracking: cite the UID of the paper(s) that support this gap, and extract a brief verbatim quote from their abstract that explicitly points to this limitation or future need.
      
      Format EXACTLY as a JSON object:
      {
        "saturation": "...",
        "justification": "...",
        "gaps": [
          {
            "text": "Gap description explicitly naming the source paper(s) and thematic cross-study synthesis...",
            "provenance": [
              { "uid": "UID here", "quote": "Verbatim quote from abstract supporting this limitation/gap..." }
            ]
          }
        ]
      }`;
      
      const res = await callGemini(prompt, { webSearch: false, highThinking: true, schemaId: 'gap-synthesis' });
      const parsed = JSON.parse(res);
      
      if (parsed.gaps && Array.isArray(parsed.gaps)) {
        setGaps(parsed.gaps);
        setTopicSaturation({ saturation: parsed.saturation, justification: parsed.justification });
      } else {
        throw new Error("Invalid format returned by AI.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to analyze gaps. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleNextPhase1 = () => {
    fetchAndScreenLiterature();
  };

  const handleGenerateProtocol = async () => {
    if (!selectedGap) return setError("Please select a research gap.");
    setError('');
    setLoading(true);
    try {
      let trialsContext = "";
      try {
        setLoadingTrials(true);
        const res = await fetch(`https://clinicaltrials.gov/api/v2/studies?query.cond=${encodeURIComponent(formData.topic)}&pageSize=3`);
        const data = await res.json();
        if (data.studies && data.studies.length > 0) {
          setClinicalTrials(data.studies);
          trialsContext = data.studies.map((t: any) => {
            const p = t.protocolSection;
            return `- ${p?.identificationModule?.briefTitle || 'Trial'} (Status: ${p?.statusModule?.overallStatus || 'Unknown'})`;
          }).join('\n');
        }
      } catch (e) {
        console.warn("Could not fetch ClinicalTrials for context", e);
      } finally {
        setLoadingTrials(false);
      }

      const prompt = `Write a study protocol for this research gap: "${selectedGap.text || selectedGap}". 
      The study type is "${formData.studyType}".
      
      Here are some real-world clinical trials currently registered for this topic to use as a baseline for how others have structured their studies:
      ${trialsContext || 'No recent clinical trials found. Use standard protocol design.'}

      CRITICAL RULE: You must not fabricate trial results, prior findings, or statistics. Base all design on standard scientific methodology and the provided context.

      FIRST, explicitly define the Estimand in a distinct block at the top formatted as:
      ### Estimand Definition
      - Target Population: 
      - Index Test/Exposure: 
      - Comparator/Reference Standard: 
      - Outcome(s): 
      - Causal/Diagnostic Contrast: 

      THEN, draft the study design. Since this is a point-of-care/lab diagnostic accuracy study, default to STARD (Standards for Reporting of Diagnostic Accuracy Studies) for the protocol design structure, while acknowledging PRISMA for the literature review portion.
      
      Include STARD-aligned structure:
      1. Primary Objective
      2. Explicit Inclusion/Exclusion Criteria (inspired by how real clinical trials structure them)
      3. Minimum Sample Size estimation approach (just the logic, no complex math). Define assumptions for disease prevalence, target sensitivity, target specificity, and precision.
      4. Variables to collect.
      5. Search Strategy Documentation (note that we screened ${evidencePool.length} papers, included ${evidencePool.filter(d=>d.included).length}).
      
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
      
      const commonInferenceInstructions = `
      CRITICAL INFERENCE REQUIREMENTS:
      1. Define the Analysis Population: Explicitly name the analysis population and briefly note how it might differ from anyone excluded.
      2. Confidence Intervals: You MUST discuss confidence intervals alongside p-values (do not report p-values alone). If exact CIs aren't provided in the prompt, estimate their implications or explicitly state they must be calculated for final reporting.
      3. Bias & Confounding: Identify at least one plausible source of bias or confounding (e.g., using DAG-based logic) relevant to this specific comparison.`;

      if (t1 === 'categorical' && t2 === 'categorical') {
        statResult = chiSquare(vals1, vals2);
        if (!statResult.valid) throw new Error(statResult.msg || "Invalid data for Chi-Square");
        aiPrompt = `I ran a Chi-Square test to compare ${analysis.col1} and ${analysis.col2}. The test statistic was ${statResult.stat.toFixed(2)}, degrees of freedom: ${statResult.df}, p-value: ${statResult.p.toFixed(4)}. 
        ${formData.studyType === 'Diagnostic Accuracy' ? 'Since this is a Diagnostic Accuracy study, please interpret these categorical results in terms of likely Sensitivity, Specificity, Positive Predictive Value, and Negative Predictive Value if applicable, considering the statistical significance (small-n adjustments if n < 50).' : ''}
        Write a plain English, academic interpretation of these results for a lab medicine paper. Be concise.
        ${commonInferenceInstructions}`;
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
        ${formData.studyType === 'Diagnostic Accuracy' ? 'Since this is a Diagnostic Accuracy study, discuss how this continuous biomarker distribution implies discriminative capability (e.g., predicted ROC AUC performance and optimal cutoff logic) between the target condition groups.' : ''}
        Write a plain English, academic interpretation for a lab medicine paper. State whether the difference is statistically significant (assume alpha=0.05).
        ${commonInferenceInstructions}`;
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

  const runRefinementPass = async (manuscript: any) => {
    setIsRefining(true);
    setRefinementFlags([]);
    setIsReportFinalized(false);
    
    try {
      const fullText = Object.entries(manuscript).map(([k, v]) => `${k.toUpperCase()}:\n${v}`).join('\n\n');
      const litContext = evidencePool.map((d: any) => `ID: ${d.uid} | Title: ${d.title} | Abstract: ${d.abstract?.substring(0,300)}`).join('\n');
      
      let statsContext = "No statistical analysis computed.";
      if (analysis.result) {
        statsContext = `Computed Stats - Test: ${analysis.result.name}, p-value: ${analysis.result.p}, Statistic: ${analysis.result.stat}`;
      }

      const prompt = `Act as a rigorous scientific reviewer. You are performing a report-refinement pass on a drafted manuscript.
      
      Here is the Fetched Evidence Pool (the ONLY valid sources for claims):
      ${litContext || 'No evidence fetched.'}
      
      Here are the Computed Statistical Results (the ONLY valid results for this study):
      ${statsContext}
      
      Here is the Drafted Manuscript:
      ${fullText}
      
      Your task is to flag any issues based on three criteria:
      1. Unsupported claims: Any claim, statistic, or citation in the text that isn't traceable to the Fetched Evidence Pool.
      2. Inconsistent stats: Any statistical claim in the text that doesn't match the Computed Statistical Results.
      3. Reasoning shortcuts: Flag if an adjusted odds ratio/effect size is treated as a direct causal effect without justification; if statistical significance (p < 0.05) is treated as sufficient evidence without reporting effect size/confidence intervals; or if a subgroup finding is claimed as significant without noting it wasn't pre-specified.
      
      Format the output EXACTLY as a JSON array of objects:
      [
        {
          "id": "unique-string-id",
          "quote": "The exact quote from the draft that is problematic",
          "issue": "Explanation of what is wrong",
          "type": "unsupported claim" OR "inconsistent with computed result" OR "reasoning shortcut",
          "section": "introduction|methods|results|discussion|conclusion|references"
        }
      ]
      Return an empty array [] if no issues are found. Do not include markdown formatting for the JSON.`;
      
      const res = await callGemini(prompt, { highThinking: true, schemaId: 'refinement-pass' });
      const parsed = JSON.parse(res);
      let flags = Array.isArray(parsed) ? parsed : [];
      
      // Additional DOI CrossRef Verification
      if (manuscript.references) {
        const doiRegex = /\b(10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)\b/g;
        let match;
        const dois = new Set<string>();
        while ((match = doiRegex.exec(manuscript.references)) !== null) {
          dois.add(match[1]);
        }
        
        for (const doi of Array.from(dois)) {
          try {
            const verRes = await fetch('/api/verify-doi', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ doi })
            });
            const verData = await verRes.json();
            if (!verData.verified) {
              flags.push({
                id: `doi-err-${doi}`,
                quote: doi,
                issue: `DOI ${doi} could not be verified via CrossRef. It may be hallucinated or incorrect.`,
                type: 'unverified citation',
                section: 'references'
              });
            }
          } catch (e) {
            console.warn("Failed to verify DOI", doi, e);
          }
        }
      }

      if (flags.length > 0) {
        setRefinementFlags(flags.map((f: any) => ({ ...f, resolved: false })));
      } else {
        setIsReportFinalized(true);
      }
    } catch (err: any) {
      console.error("Refinement pass failed:", err);
      // If refinement fails, we just don't block the user, or show a small error.
      setIsReportFinalized(true); 
    } finally {
      setIsRefining(false);
    }
  };

  const generateReport = async () => {
    setError('');
    setLoading(true);
    setIsReportFinalized(false);
    setRefinementFlags([]);
    try {
      const isLitReview = formData.studyType === 'Automated Literature Review';
      const parts = ['Introduction', 'Methods', 'Results', 'Discussion', 'Conclusion', 'References'];
      let manuscript: any = {};
      
      const litContext = evidencePool.map((d: any) => `- ${d.title} (${d.pubdate}) [Source: ${d.origin}] ${d.doi ? `DOI: ${d.doi}` : ''}`).join('\n');

      const baseContext = isLitReview 
        ? `Topic: ${formData.topic}. Study Type: Systematic Review / Meta-Analysis. 
           We fetched ${literatureData.length} papers from academic databases.
           Synthesis Results: ${analysis.interpretation || 'No synthesis completed yet.'}`
        : `Topic: ${formData.topic}. Study Type: ${formData.studyType}. Gap addressed: ${selectedGap.text || selectedGap}. 
           Protocol details: ${protocol.text.substring(0, 500)}... 
           Statistical Findings: ${analysis.interpretation || 'No statistical analysis was finalized.'}`;
      
      for (const part of parts) {
        let prompt = `You are writing a lab medicine manuscript for a ${isLitReview ? 'Review Article' : 'Primary Research Article'}. 
        Based on this context: "${baseContext}"
        Write the **${part}** section of the manuscript. Keep it strictly to the ${part} section, use an academic tone, and make it around 150-250 words. Do not add titles or markdown headings for the section name itself.`;
        
        if (part !== 'References') {
          prompt += ` CRITICAL RULE: Never state a prior finding, statistic, or pooled result unless you are referencing the fetched evidence pool. 
          Fetched Evidence Pool Titles:
          ${litContext}
          Include realistic in-text academic citations (e.g., [1], [2]) that correspond ONLY to the titles in the fetched evidence pool.`;
        } else {
          prompt = `You are writing a lab medicine manuscript. 
          Write the **References** section of the manuscript. 
          CRITICAL RULE: You MUST ONLY include references from the following fetched evidence pool. Do NOT invent fake DOIs or authors, and do not use outside knowledge. If the pool is small, only list what is there.
          CRITICAL RULE: You MUST include the exact DOI for every reference you list (format: doi:10.xxxx/yyyy) if one is provided in the pool.
          
          Fetched Evidence Pool:
          ${litContext}
          
          Provide a numbered list. Do not add titles or markdown headings for the section name itself.`;
        }
        
        const res = await callGemini(prompt, { highThinking: true });
        manuscript[part.toLowerCase()] = res;
      }
      
      setReport(manuscript);
      setLoading(false); // End initial loading before refinement
      await runRefinementPass(manuscript);
    } catch (err: any) {
      setError(err.message || "Failed to generate report.");
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
                          {['Method Comparison', 'Reference Interval', 'Diagnostic Accuracy', 'Quality Control Evaluation', 'Workflow Analysis', 'Automated Literature Review'].map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </SectionCard>
                </div>
                <div className="flex justify-end pt-4">
                  <PrimaryButton onClick={handleNextPhase1} loading={loading} icon={ArrowRight}>Proceed to Literature Search</PrimaryButton>
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
                  <PrimaryButton onClick={fetchAndScreenLiterature} loading={loading} icon={Search}>Rescan Literature</PrimaryButton>
                </div>
                
                {gaps.length > 0 ? (
                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                    <div className="xl:col-span-2 space-y-6">
                      
                      {topicSaturation && (
                        <div className="p-6 rounded-2xl border-l-4 border-[var(--accent-secondary)] bg-[var(--bg-app)]">
                          <h4 className="text-xs font-black uppercase tracking-widest text-[var(--accent-secondary)] mb-2">Topic Saturation: {topicSaturation.saturation}</h4>
                          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{topicSaturation.justification}</p>
                        </div>
                      )}

                      <div className="space-y-4">
                        <h4 className="text-sm font-bold text-[var(--text-primary)] mb-2">Identified Gaps (Select one to proceed):</h4>
                        {gaps.map((gap, idx) => (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            key={idx} 
                            onClick={() => setSelectedGap(gap)}
                            className={`p-6 rounded-2xl border-2 cursor-pointer transition-all ${selectedGap === gap ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-light)] shadow-md' : 'border-[var(--border-color)] bg-[var(--bg-paper)] hover:border-[var(--text-muted)]'}`}
                          >
                            <div className="flex gap-4 mb-3">
                              <div className="pt-1 shrink-0">
                                <CheckCircle className={`w-6 h-6 ${selectedGap === gap ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)]'}`} />
                              </div>
                              <p className={`text-base leading-relaxed font-medium ${selectedGap === gap ? 'text-[var(--accent-primary-light)] dark:text-[var(--text-primary)]' : 'text-[var(--text-primary)]'}`}>{gap.text || gap}</p>
                            </div>
                            
                            {gap.provenance && gap.provenance.length > 0 && (
                               <div className="pl-10 space-y-2 mt-4">
                                 {gap.provenance.map((prov: any, pIdx: number) => {
                                   const sourceDoc = evidencePool.find(d => String(d.uid) === String(prov.uid));
                                   return (
                                     <div key={pIdx} className="p-3 bg-[var(--bg-app)] border border-[var(--border-color)] rounded-lg">
                                        <div className="flex justify-between items-start mb-1">
                                          <span className="text-[10px] uppercase font-black tracking-widest text-[var(--accent-secondary)]">Provenance Link</span>
                                          {sourceDoc && <button onClick={(e) => { e.stopPropagation(); setSelectedPaperForAnnotation(sourceDoc); }} className="text-[10px] text-[var(--text-muted)] hover:underline">View Source</button>}
                                        </div>
                                        <p className="text-xs text-[var(--text-secondary)] italic border-l-2 border-[var(--border-color)] pl-2">"{prov.quote}"</p>
                                        <p className="text-[10px] text-[var(--text-muted)] mt-1 font-mono">Source ID: {prov.uid} {!sourceDoc && '(Unverified Source)'}</p>
                                     </div>
                                   );
                                 })}
                               </div>
                            )}
                          </motion.div>
                        ))}
                      </div>
                      
                      <div className="mt-8 flex justify-between pt-8 border-t border-[var(--border-color)]">
                        <SecondaryButton onClick={handlePrev}>Back</SecondaryButton>
                        <PrimaryButton onClick={handleGenerateProtocol} loading={loading} disabled={!selectedGap}>Draft Study Protocol</PrimaryButton>
                      </div>
                    </div>

                    <div className="xl:col-span-1">
                      <SectionCard title="ASReview Screening" subtitle="Fetched Literature" className="!p-5 bg-[var(--bg-app)]">
                        {screeningCounts && (
                          <Card className="mb-4 !p-4 !shadow-none">
                            <Text className="text-[10px] uppercase font-bold mb-4 tracking-wider">Screening Funnel</Text>
                            <div className="space-y-4">
                              <ProgressBar 
                                value={(screeningCounts.deduplicated / screeningCounts.initial) * 100 || 0} 
                                label="Deduplicated" 
                                subLabel={`${screeningCounts.deduplicated} / ${screeningCounts.initial}`} 
                              />
                              <ProgressBar 
                                value={(screeningCounts.included / screeningCounts.screened) * 100 || 0} 
                                label="Included" 
                                subLabel={`${screeningCounts.included} / ${screeningCounts.screened}`} 
                              />
                            </div>
                          </Card>
                        )}
                        <p className="text-xs text-[var(--text-secondary)] mb-4">Click to toggle inclusion.</p>
                        
                        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                          {evidencePool.map((doc: any, i: number) => (
                            <div key={i} className={`p-3 border rounded-xl relative transition-all ${doc.included ? 'bg-[var(--bg-paper)] border-[var(--border-color)]' : 'bg-[var(--bg-app)] border-red-900/20 opacity-60'}`}>
                              <div className="flex justify-between items-start mb-2">
                                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-[var(--bg-app)] text-[var(--text-muted)] border border-[var(--border-color)]">{doc.origin}</span>
                                <button 
                                  onClick={() => {
                                    const next = [...evidencePool];
                                    next[i].included = !next[i].included;
                                    setEvidencePool(next);
                                  }}
                                  className={`text-[10px] font-bold px-2 py-1 rounded ${doc.included ? 'bg-[var(--accent-primary)] text-white' : 'bg-gray-300 text-black hover:bg-gray-400'}`}
                                >
                                  {doc.included ? 'Included' : 'Excluded'}
                                </button>
                              </div>
                              <h4 className="text-xs font-bold mb-1 leading-tight text-[var(--text-primary)]">{doc.title}</h4>
                              <div className="flex gap-2 items-center mb-1">
                                <span className="text-[9px] text-[var(--text-muted)]">{doc.pubdate}</span>
                                {doc.citations != null && (
                                  <Badge color={doc.citations > 50 ? "warm" : "neutral"} className="!text-[9px]">
                                    {doc.citations} citations
                                  </Badge>
                                )}
                              </div>
                              <p className="text-[10px] text-[var(--text-muted)] mb-2 italic">"{doc.reason}"</p>
                              
                              <div className="flex gap-4">
                                {doc.url && <a href={doc.url} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-[var(--accent-secondary)] hover:underline block">Link &rarr;</a>}
                                <button onClick={() => setSelectedPaperForAnnotation(doc)} className="text-[10px] font-bold text-[var(--text-secondary)] hover:underline">View Extract</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </SectionCard>
                    </div>
                  </div>
                ) : (
                  <SectionCard className="text-center py-20 bg-transparent border-dashed">
                    {loading ? (
                       <div className="flex flex-col items-center justify-center">
                         <Loader2 className="w-12 h-12 animate-spin text-[var(--accent-primary)] mb-4" />
                         <p className="text-[var(--text-secondary)]">Fetching literature and screening based on ASReview principles...</p>
                       </div>
                    ) : (
                       <>
                        <BookOpen className="w-16 h-16 mx-auto mb-6 opacity-20 text-[var(--text-primary)]" />
                        <p className="text-[var(--text-secondary)] text-lg max-w-md mx-auto mb-6">Literature screened. Review the evidence pool on the right, toggle inclusions if needed, and generate gaps.</p>
                        <PrimaryButton onClick={handleGenerateGaps} icon={Search}>Generate Gaps from Included Papers</PrimaryButton>
                        
                        <div className="mt-8 pt-8 border-t border-[var(--border-color)] grid grid-cols-2 md:grid-cols-3 gap-4 max-h-[300px] overflow-y-auto">
                           {evidencePool.map((doc, i) => (
                             <div key={i} className={`p-3 border text-left rounded-lg text-xs ${doc.included ? 'border-green-500/30' : 'border-red-500/30 opacity-50'}`}>
                                <p className="font-bold truncate mb-1">{doc.title}</p>
                                <p className="text-[9px] truncate">{doc.reason}</p>
                                <button onClick={() => {
                                  const next = [...evidencePool];
                                  next[i].included = !next[i].included;
                                  setEvidencePool(next);
                                }} className="text-blue-500 underline mt-2 block">{doc.included ? 'Exclude' : 'Re-include'}</button>
                             </div>
                           ))}
                        </div>
                       </>
                    )}
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

                    <SectionCard title="Similar Trials" subtitle="ClinicalTrials.gov Integration" className="!p-5 bg-[var(--bg-app)] mt-6">
                      <p className="text-xs text-[var(--text-secondary)] mb-4">View how other researchers designed studies for {formData.topic}.</p>
                      <PrimaryButton className="w-full mb-4" onClick={handleSearchTrials} loading={loadingTrials} icon={Search}>Search ClinicalTrials.gov</PrimaryButton>
                      
                      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                        {clinicalTrials.map((trial: any, i: number) => {
                          const p = trial.protocolSection;
                          const title = p?.identificationModule?.briefTitle;
                          const status = p?.statusModule?.overallStatus;
                          const nctId = p?.identificationModule?.nctId;
                          return (
                            <div key={i} className="p-3 bg-[var(--bg-paper)] border border-[var(--border-color)] rounded-xl">
                              <h4 className="text-xs font-bold mb-1 leading-tight text-[var(--text-primary)]">{title}</h4>
                              <p className="text-[10px] text-[var(--text-muted)] mb-2 uppercase tracking-wide">Status: {status}</p>
                              {nctId && <a href={`https://clinicaltrials.gov/study/${nctId}`} target="_blank" rel="noreferrer" className="text-[11px] font-bold text-[var(--accent-secondary)] hover:underline block">View Protocol &rarr;</a>}
                            </div>
                          );
                        })}
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
                  <h2 className="text-4xl font-serif font-bold text-[var(--text-primary)]">
                    {formData.studyType === 'Automated Literature Review' ? 'Literature Synthesis' : 'Statistical Analysis'}
                  </h2>
                  <p className="text-[var(--text-secondary)] mt-2">
                    {formData.studyType === 'Automated Literature Review' 
                      ? 'Fetch and synthesize academic literature automatically.' 
                      : 'Upload your collected CSV data and run automated statistical inference.'}
                  </p>
                </div>
                
                {formData.studyType === 'Automated Literature Review' ? (
                  <div className="grid grid-cols-1 gap-8">
                     <SectionCard title="Automated Literature Fetch & Meta-Analysis" className="!p-8">
                       <p className="text-sm text-[var(--text-secondary)] mb-6">Fetch the most relevant recent papers and automatically perform a thematic synthesis.</p>
                       
                       <PrimaryButton onClick={handleAutomatedReview} loading={loading} icon={Search} className="mb-8">
                          Fetch Literature & Synthesize
                       </PrimaryButton>
                       
                       {literatureData.length > 0 && (
                         <div className="space-y-6">
                           <div className="p-6 rounded-2xl bg-[var(--bg-app)] border border-[var(--border-color)]">
                              <div className="flex items-center gap-2 mb-4">
                               <Activity className="w-4 h-4 text-[var(--accent-secondary)]" strokeWidth={3} />
                               <span className="text-xs font-black uppercase tracking-widest text-[var(--accent-secondary)]">AI Meta-Analysis Synthesis</span>
                             </div>
                             <MarkdownLite content={analysis.interpretation} />
                           </div>
                           
                           <div className="pt-6 border-t border-[var(--border-color)]">
                             <h4 className="text-sm font-bold mb-4 uppercase tracking-widest text-[var(--text-muted)]">Sources Retrieved ({literatureData.length})</h4>
                             <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                                {literatureData.map((paper: any, i: number) => (
                                  <div key={i} className="p-4 bg-[var(--bg-paper)] border border-[var(--border-color)] rounded-xl flex flex-col gap-2">
                                    <h4 className="text-sm font-bold leading-tight text-[var(--text-primary)]">{paper.title}</h4>
                                    <div className="text-xs text-[var(--text-muted)] flex gap-4 font-medium">
                                      <span>{paper.year || 'Unknown'}</span>
                                      <span>{paper.authors?.map((a:any)=>a.name).join(', ').substring(0, 100)}{paper.authors?.length > 3 ? ' et al.' : ''}</span>
                                      {paper.citationCount !== undefined && <span className="font-bold text-[var(--accent-primary)]">{paper.citationCount} Citations</span>}
                                    </div>
                                  </div>
                                ))}
                             </div>
                           </div>
                         </div>
                       )}
                       
                       <div className="mt-8 flex justify-between pt-8 border-t border-[var(--border-color)]">
                          <SecondaryButton onClick={handlePrev}>Back</SecondaryButton>
                          <PrimaryButton onClick={handleNext} disabled={literatureData.length === 0}>Proceed to Manuscript</PrimaryButton>
                       </div>
                     </SectionCard>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
                    
                    <div className="xl:col-span-1 space-y-6">
                      <SectionCard title="Data Input" className="!p-5">
                        <div className="flex justify-between items-center mb-3">
                          <p className="text-xs text-[var(--text-secondary)]">Paste your CSV contents below.</p>
                          <button onClick={loadSampleDataset} className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent-secondary)] hover:underline">
                            Load Sample Data
                          </button>
                        </div>
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
                              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)]"></div>
                              
                              <div className="flex justify-between items-start mb-4 mt-2">
                                <span className="text-sm uppercase font-black tracking-widest text-[var(--accent-secondary)]">{analysis.result.name}</span>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold text-white ${analysis.result.p < 0.05 ? 'bg-[var(--status-success)]' : 'bg-[var(--text-muted)]'}`}>
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
                                   <Activity className="w-4 h-4 text-[var(--accent-secondary)]" strokeWidth={3} />
                                   <span className="text-xs font-black uppercase tracking-widest text-[var(--accent-secondary)]">Automated Interpretation</span>
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
                            const COLORS = ['var(--cat-1)', 'var(--cat-2)', 'var(--cat-3)', 'var(--cat-4)', 'var(--cat-5)', 'var(--cat-6)'];
                            
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
                                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
                )}
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
                    {report && (
                      <SecondaryButton 
                        onClick={copyReport} 
                        disabled={!isReportFinalized || !Object.values(preFinalChecklist).every(Boolean)} 
                        icon={Clipboard}
                      >
                        {isReportFinalized && Object.values(preFinalChecklist).every(Boolean) ? 'Copy Text' : 'Resolve Flags & Checklist to Export'}
                      </SecondaryButton>
                    )}
                    <PrimaryButton onClick={generateReport} loading={loading} icon={PenTool}>{report ? "Regenerate" : "Draft Manuscript"}</PrimaryButton>
                  </div>
                </div>

                {!report && !loading && (
                  <SectionCard className="text-center py-24 bg-transparent border-dashed">
                     <PenTool className="w-16 h-16 mx-auto mb-6 opacity-20 text-[var(--text-primary)]" />
                     <p className="text-[var(--text-secondary)] text-lg max-w-md mx-auto">
                        Click "Draft Manuscript" to instruct the LLM to write a complete academic paper using your 
                        {formData.studyType === 'Automated Literature Review' ? ' literature synthesis.' : ' statistical findings and literature gap.'}
                     </p>
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
                  <>
                    {isRefining && (
                      <SectionCard className="text-center py-12 flex flex-col items-center justify-center bg-blue-900/10 border-blue-500/30">
                        <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
                        <h3 className="text-lg font-bold font-serif text-blue-400 mb-2">Refining Manuscript...</h3>
                        <p className="text-[var(--text-muted)] text-sm max-w-md">Running a secondary review pass to verify internal consistency and trace all claims back to the fetched evidence pool.</p>
                      </SectionCard>
                    )}

                    {!isRefining && refinementFlags.length > 0 && !isReportFinalized && (
                      <div className="bg-red-900/10 border border-red-500/30 rounded-2xl p-6 mb-8 shadow-lg">
                        <div className="flex items-center gap-3 mb-4">
                          <AlertTriangle className="text-red-500 w-6 h-6" />
                          <h3 className="text-lg font-bold text-red-500">Refinement Pass: Issues Detected</h3>
                        </div>
                        <p className="text-sm text-[var(--text-secondary)] mb-6">The secondary review pass flagged potential inconsistencies or unsupported claims. Please review, edit the text to fix them, and then mark as resolved.</p>
                        
                        <div className="space-y-4">
                          {refinementFlags.map((flag, idx) => (
                            <div key={idx} className={`p-4 rounded-xl border transition-all ${flag.resolved ? 'bg-green-900/10 border-green-500/30 opacity-60' : 'bg-[var(--bg-paper)] border-red-500/30'}`}>
                              <div className="flex justify-between items-start mb-2">
                                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${flag.type.includes('unsupported') ? 'bg-orange-500/20 text-orange-400' : 'bg-red-500/20 text-red-400'}`}>
                                  {flag.type}
                                </span>
                                <div className="flex gap-2">
                                  {!flag.resolved && (
                                    <>
                                      <button onClick={() => {
                                          const sec = flag.section?.toLowerCase();
                                          setEditingSection(sec);
                                          setEditingContent(report[sec] || '');
                                        }} 
                                        className="text-[10px] font-bold px-3 py-1 rounded bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)]">
                                        Edit {flag.section}
                                      </button>
                                      <button onClick={() => {
                                          const next = [...refinementFlags];
                                          next[idx].resolved = true;
                                          setRefinementFlags(next);
                                          if (next.every(f => f.resolved)) setIsReportFinalized(true);
                                        }} 
                                        className="text-[10px] font-bold px-3 py-1 rounded bg-[var(--bg-app)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-white">
                                        Mark Resolved
                                      </button>
                                    </>
                                  )}
                                  {flag.resolved && <span className="text-[10px] font-bold text-green-400 uppercase tracking-widest">Resolved</span>}
                                </div>
                              </div>
                              <p className="text-xs font-bold text-[var(--text-primary)] mb-1">"{flag.quote}"</p>
                              <p className="text-[11px] text-[var(--text-secondary)]">{flag.issue}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {!isRefining && isReportFinalized && refinementFlags.length > 0 && (
                      <div className="bg-green-900/10 border border-green-500/30 rounded-2xl p-4 mb-8 flex items-center justify-between shadow-lg">
                        <div className="flex items-center gap-3">
                          <CheckCircle className="text-green-500 w-5 h-5" />
                          <p className="text-sm font-bold text-green-500">All refinement flags resolved. Report finalized.</p>
                        </div>
                      </div>
                    )}

                    {!isRefining && report && (
                      <div className="bg-[var(--bg-paper)] border border-[var(--border-color)] rounded-2xl p-6 mb-8 shadow-lg">
                        <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4">Pre-Finalization Checklist</h3>
                        <List className="space-y-0">
                          {[
                            { key: 'citationsVerified', label: 'Citations verified against CrossRef/DOI' },
                            { key: 'methodologyDocumented', label: 'Search methodology documented (databases, dates, terms)' },
                            { key: 'criteriaStated', label: 'Inclusion/exclusion criteria stated' },
                            { key: 'exclusionsDocumented', label: 'Exclusions documented with reasons' },
                            { key: 'limitationsAcknowledged', label: 'Study limitations acknowledged' },
                            { key: 'stardAdherence', label: 'Protocol designed adhering to STARD reporting guidelines' },
                            { key: 'biasAcknowledged', label: 'Plausible sources of bias/confounding explicitly addressed' }
                          ].map(item => (
                            <ListItem key={item.key}>
                              <label className="flex items-center gap-3 cursor-pointer group w-full">
                                <Checkbox 
                                  checked={preFinalChecklist[item.key as keyof typeof preFinalChecklist]} 
                                  onCheckedChange={(checked) => setPreFinalChecklist({...preFinalChecklist, [item.key]: checked === true})} 
                                />
                                <span className="text-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">{item.label}</span>
                              </label>
                            </ListItem>
                          ))}
                        </List>
                      </div>
                    )}

                    <div className={`bg-[var(--bg-paper)] border ${isReportFinalized || refinementFlags.length === 0 ? 'border-[var(--border-color)]' : 'border-red-500/30'} rounded-3xl p-8 md:p-16 shadow-lg max-w-4xl mx-auto transition-colors`}>
                      <div className="text-center mb-16 border-b border-[var(--border-color)] pb-12">
                         <h1 className="text-3xl md:text-5xl font-bold font-serif mb-6 text-[var(--text-primary)] leading-tight">
                           {formData.topic}
                         </h1>
                         <p className="text-xl italic font-serif text-[var(--text-secondary)]">A study in {formData.population}</p>
                      </div>
                      
                      {['introduction', 'methods', 'results', 'discussion', 'conclusion', 'references'].map((section) => (
                        <div key={section} className="mb-12">
                          <div className="flex justify-between items-end border-b border-[var(--border-color)] pb-3 mb-6">
                            <h3 className="text-2xl font-bold font-serif uppercase tracking-wider text-[var(--text-primary)]">
                              {section}
                            </h3>
                            {report && !isRefining && (
                              <button 
                                onClick={() => {
                                  if (editingSection === section) {
                                    setReport({ ...report, [section]: editingContent });
                                    setEditingSection(null);
                                  } else {
                                    setEditingSection(section);
                                    setEditingContent(report[section] || '');
                                  }
                                }}
                                className={`text-xs font-bold px-3 py-1 rounded-full border transition-colors ${editingSection === section ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]' : 'bg-transparent text-[var(--accent-primary)] border-[var(--accent-primary)] hover:bg-[var(--accent-primary)] hover:text-white'}`}
                              >
                                {editingSection === section ? 'Save Changes' : 'Edit Section'}
                              </button>
                            )}
                          </div>
                          {editingSection === section ? (
                            <textarea 
                              value={editingContent}
                              onChange={(e) => setEditingContent(e.target.value)}
                              className="w-full h-64 bg-[var(--bg-app)] text-[var(--text-primary)] border border-[var(--accent-primary)] p-4 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                            />
                          ) : (
                            <MarkdownLite content={report[section] || ''} />
                          )}
                        </div>
                      ))}
                    </div>
                  </>
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
                
                <div className="bg-[var(--status-warning)]/10 border border-[var(--status-warning)]/30 rounded-xl p-4 flex gap-3 items-start">
                  <AlertTriangle className="w-5 h-5 text-[var(--status-warning)] shrink-0 mt-0.5" />
                  <p className="text-xs text-[var(--status-warning)] leading-relaxed font-medium">
                    <strong className="block mb-1">Local Storage Only</strong>
                    Your study data is currently saved only in this browser. Export to JSON to back up your work or move it to another device.
                  </p>
                </div>

                <button 
                  onClick={startNewProject}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-xl border-2 border-dashed border-[var(--accent-primary)] text-[var(--accent-primary)] hover:bg-[var(--accent-primary-light)] dark:hover:bg-[var(--accent-primary)]/10 transition-colors shadow-sm"
                >
                  <Plus className="w-5 h-5" />
                  <span className="font-bold uppercase tracking-wider text-sm">Initialize New Study</span>
                </button>
                
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={exportProject} className="flex items-center justify-center gap-2 py-3 rounded-xl bg-[var(--bg-paper-hover)] text-[var(--text-primary)] border border-[var(--border-color)] hover:bg-[var(--bg-app)] transition-colors text-xs font-bold uppercase tracking-wider">
                    <Download className="w-4 h-4" /> Export JSON
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-2 py-3 rounded-xl bg-[var(--bg-paper-hover)] text-[var(--text-primary)] border border-[var(--border-color)] hover:bg-[var(--bg-app)] transition-colors text-xs font-bold uppercase tracking-wider">
                    <Upload className="w-4 h-4" /> Import JSON
                  </button>
                  <input type="file" accept=".json" ref={fileInputRef} onChange={importProject} className="hidden" />
                </div>

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

      {/* Source Annotation Modal */}
      {selectedPaperForAnnotation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setSelectedPaperForAnnotation(null)}>
          <div className="bg-[var(--bg-paper)] border border-[var(--border-color)] rounded-3xl p-8 max-w-3xl w-full max-h-[80vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
             <div className="flex justify-between items-start mb-6">
               <div>
                 <span className="text-[10px] font-black uppercase tracking-widest text-[var(--accent-secondary)] mb-2 block">{selectedPaperForAnnotation.origin} • {selectedPaperForAnnotation.uid}</span>
                 <h2 className="text-2xl font-bold text-[var(--text-primary)] leading-tight">{selectedPaperForAnnotation.title}</h2>
               </div>
               <button onClick={() => setSelectedPaperForAnnotation(null)} className="text-[var(--text-muted)] hover:text-white"><X className="w-6 h-6" /></button>
             </div>
             <p className="text-sm font-medium text-[var(--text-muted)] mb-6">{selectedPaperForAnnotation.source} ({selectedPaperForAnnotation.pubdate})</p>
             <div className="prose prose-invert max-w-none prose-p:text-sm prose-p:leading-relaxed text-[var(--text-secondary)] border-t border-[var(--border-color)] pt-6">
                <h4 className="text-sm font-bold text-[var(--text-primary)] mb-3">Abstract Excerpt</h4>
                {selectedPaperForAnnotation.abstract ? (
                  <p>{selectedPaperForAnnotation.abstract}</p>
                ) : (
                  <p className="italic opacity-50">No full abstract text available for this paper. Synthesis relies on title and metadata.</p>
                )}
             </div>
             {selectedPaperForAnnotation.url && (
               <a href={selectedPaperForAnnotation.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 mt-8 text-sm font-bold text-[var(--accent-primary)] hover:underline">
                 View Original Publication <ArrowRight className="w-4 h-4" />
               </a>
             )}
          </div>
        </div>
      )}
    </div>
  );
}
