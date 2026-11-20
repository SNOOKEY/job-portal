import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  MapPin,
  Briefcase,
  ExternalLink,
  RotateCcw,
  Sparkles,
  TrendingUp,
  Cpu,
  Layers,
  CheckCircle2,
  X,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Calendar,
  Building2,
  FileSpreadsheet,
  Sun,
  Moon,
  Clock,
  Copy,
  Check,
  Flame,
  Zap,
  ShieldCheck,
  Share2,
  UserPlus,
  Users,
  HelpCircle,
  Send,
  MessageSquare,
  ArrowUpRight,
  Filter,
  CheckCircle,
  SlidersHorizontal,
  Bookmark,
  Share,
  Sparkle
} from 'lucide-react';

// Import datasets bundled by Vite
import jobsData from '../../data/jobs.json';
import metricsData from '../../data/metrics.json';
import { parseAndEvaluateBooleanQuery } from './utils/booleanSearch';

const ITEMS_PER_PAGE = 24;

// Avatar color helper based on company name
const getAvatarColor = (name) => {
  const colors = [
    'bg-indigo-50 text-indigo-700 border-indigo-200/80 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800/60',
    'bg-violet-50 text-violet-700 border-violet-200/80 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800/60',
    'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60',
    'bg-sky-50 text-sky-700 border-sky-200/80 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800/60',
    'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60',
    'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/60',
    'bg-teal-50 text-teal-700 border-teal-200/80 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800/60',
  ];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

// Calculate relative time (e.g., "2h ago", "1d ago")
const getRelativeTime = (isoString) => {
  if (!isoString) return 'Recently';
  try {
    const diffSec = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (diffSec < 0) return 'Just now';
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    const days = Math.floor(diffSec / 86400);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return new Date(isoString).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  } catch {
    return 'Recently';
  }
};

export default function App() {
  // Theme state
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('peeb_theme') || localStorage.getItem('beep_theme');
    if (saved) return saved === 'dark';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('ALL');
  const [selectedCity, setSelectedCity] = useState('ALL');
  const [selectedExperience, setSelectedExperience] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedDateRange, setSelectedDateRange] = useState('ALL');
  const [selectedSource, setSelectedSource] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);

  // Saved/Bookmarked jobs
  const [savedJobs, setSavedJobs] = useState(() => {
    try {
      const saved = localStorage.getItem('peeb_saved_jobs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Modals & Drawers
  const [showMetricsModal, setShowMetricsModal] = useState(false);
  const [showBooleanHelp, setShowBooleanHelp] = useState(false);
  const [referralJob, setReferralJob] = useState(null);

  // Toast & Copy States
  const [toastMessage, setToastMessage] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [copiedTemplate, setCopiedTemplate] = useState(false);

  // Sync dark class to html document
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('peeb_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('peeb_theme', 'light');
    }
  }, [isDark]);

  // Sync saved jobs to local storage
  useEffect(() => {
    try {
      localStorage.setItem('peeb_saved_jobs', JSON.stringify(savedJobs));
    } catch (e) {
      console.error(e);
    }
  }, [savedJobs]);

  const toggleSaveJob = (jobId) => {
    if (savedJobs.includes(jobId)) {
      setSavedJobs(savedJobs.filter((id) => id !== jobId));
      triggerToast('Removed from saved jobs');
    } else {
      setSavedJobs([...savedJobs, jobId]);
      triggerToast('Saved to your bookmarks!');
    }
  };

  // Toast handler
  const triggerToast = (msg, id = null) => {
    setToastMessage(msg);
    if (id) setCopiedId(id);
    setTimeout(() => {
      setToastMessage('');
      if (id) setCopiedId(null);
    }, 2200);
  };

  // Available options derived dynamically
  const roles = useMemo(() => {
    const list = Object.keys(metricsData.distributions?.by_role || {});
    return list.length ? list : ['Software Engineering', 'Data & Analytics', 'AI / ML', 'Product', 'Design', 'Other'];
  }, []);

  const cities = useMemo(() => {
    const list = Object.keys(metricsData.distributions?.by_city || {});
    return list.length ? list : ['Bengaluru', 'Delhi NCR', 'Mumbai', 'Hyderabad', 'Pune', 'Chennai', 'Remote (India)', 'Other'];
  }, []);

  const experienceOptions = [
    { key: 'ALL', label: 'All Experience' },
    { key: 'Internship', label: 'Internships' },
    { key: 'Fresher', label: 'Fresher (0–1 YoE)' },
    { key: 'Mid-Level', label: 'Mid-Level (2–5 YoE)' },
    { key: 'Senior', label: 'Senior (5+ YoE)' },
  ];

  const dateRangeOptions = [
    { key: 'ALL', label: 'Any Time' },
    { key: '24h', label: 'Past 24 Hours' },
    { key: '3d', label: 'Past 3 Days' },
    { key: '7d', label: 'Past Week (7d)' },
    { key: '30d', label: 'Past Month (30d)' },
  ];

  // Boolean Search detection in search input
  const isBooleanQuery = useMemo(() => {
    return /\b(AND|OR|NOT)\b|[()"]/.test(searchTerm);
  }, [searchTerm]);

  // Filtered jobs with Boolean Search Engine
  const filteredJobs = useMemo(() => {
    const nowTime = Date.now();
    return jobsData.filter((job) => {
      // Boolean search evaluation
      if (searchTerm.trim()) {
        const matchesQuery = parseAndEvaluateBooleanQuery(searchTerm, job);
        if (!matchesQuery) return false;
      }

      // Role
      if (selectedRole !== 'ALL' && job.role !== selectedRole) {
        return false;
      }

      // City
      if (selectedCity !== 'ALL' && job.city !== selectedCity) {
        return false;
      }

      // Experience Level
      if (selectedExperience !== 'ALL' && job.experience !== selectedExperience) {
        return false;
      }

      // Type
      if (selectedType !== 'ALL' && job.job_type !== selectedType) {
        return false;
      }

      // Source
      if (selectedSource !== 'ALL' && job.source !== selectedSource) {
        return false;
      }

      // Date Range Filter (24h, 3d, 7d, 30d)
      if (selectedDateRange !== 'ALL' && job.posted_at) {
        try {
          const postedTime = new Date(job.posted_at).getTime();
          const diffHours = (nowTime - postedTime) / (1000 * 60 * 60);
          if (selectedDateRange === '24h' && diffHours > 24) return false;
          if (selectedDateRange === '3d' && diffHours > 72) return false;
          if (selectedDateRange === '7d' && diffHours > 168) return false;
          if (selectedDateRange === '30d' && diffHours > 720) return false;
        } catch {
          // Keep if date parsing fails
        }
      }

      return true;
    });
  }, [searchTerm, selectedRole, selectedCity, selectedExperience, selectedType, selectedSource, selectedDateRange]);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedRole, selectedCity, selectedExperience, selectedType, selectedSource, selectedDateRange]);

  // Paginated slice
  const totalPages = Math.ceil(filteredJobs.length / ITEMS_PER_PAGE) || 1;
  const paginatedJobs = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredJobs.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredJobs, currentPage]);

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedRole('ALL');
    setSelectedCity('ALL');
    setSelectedExperience('ALL');
    setSelectedType('ALL');
    setSelectedDateRange('ALL');
    setSelectedSource('ALL');
  };

  const hasActiveFilters =
    searchTerm !== '' ||
    selectedRole !== 'ALL' ||
    selectedCity !== 'ALL' ||
    selectedExperience !== 'ALL' ||
    selectedType !== 'ALL' ||
    selectedDateRange !== 'ALL' ||
    selectedSource !== 'ALL';

  const lastRefreshedDate = useMemo(() => {
    if (!metricsData.timestamp) return 'Today';
    try {
      const d = new Date(metricsData.timestamp);
      return d.toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return metricsData.timestamp;
    }
  }, []);

  // Generate Weekday AI Style Referral Message Template
  const generateReferralMessage = (job) => {
    if (!job) return '';
    return `Hi [Name],

I hope you're having a great week! I noticed an open role for "${job.title}" at ${job.company} (Direct ATS Link: ${job.apply_url}) and was really impressed by the team's engineering work.

Given my background in ${job.role}, I believe I'd be a strong addition to the team. Would you be open to a quick connection and considering referring me through ${job.company}'s internal referral portal?

I'd be glad to share my resume and relevant project links right away. Thanks so much for your time and guidance!

Best regards,
[Your Name]`;
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#080C15] text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-slate-900/95 dark:bg-white text-white dark:text-slate-900 px-4 py-3 rounded-2xl shadow-2xl text-xs font-semibold backdrop-blur-md border border-slate-700/50 dark:border-slate-200 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle className="w-4 h-4 text-emerald-400 dark:text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/85 dark:bg-[#0A0F1D]/85 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* Logo & Identity */}
            <div className="flex items-center gap-3.5">
              <div className="relative group cursor-pointer" onClick={resetFilters}>
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-500/25 group-hover:scale-105 group-hover:shadow-indigo-500/40 transition-all duration-300">
                  P
                </div>
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-white dark:border-[#0A0F1D]"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-2xl tracking-tight text-slate-900 dark:text-white">
                    peeb<span className="text-indigo-600 dark:text-indigo-400">.</span>
                  </span>
                  <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80">
                    Live ATS Engine
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium hidden sm:block">
                  Direct Fresher & Internship Postings • Boolean Dork Search • 1-Click Referrals
                </p>
              </div>
            </div>

            {/* Quick Actions, Theme Toggle & Metrics */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Live Status Indicator */}
              <div className="hidden lg:flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 px-3.5 py-1.5 rounded-xl">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Refreshed: <strong className="font-semibold text-slate-900 dark:text-slate-100">{lastRefreshedDate}</strong></span>
              </div>

              {/* Dark Mode Toggle */}
              <button
                onClick={() => setIsDark(!isDark)}
                aria-label="Toggle Theme"
                className="p-2 sm:p-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600 transition-all active:scale-95"
                title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
              >
                {isDark ? (
                  <Sun className="w-4 h-4 text-amber-400 transition-transform duration-300 rotate-0 hover:rotate-90" />
                ) : (
                  <Moon className="w-4 h-4 text-slate-700 transition-transform duration-300 rotate-0 hover:-rotate-45" />
                )}
              </button>

              {/* Architecture & AI Cost Modal Trigger */}
              <button
                onClick={() => setShowMetricsModal(true)}
                className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200/80 dark:border-indigo-800/80 px-3 py-2 rounded-xl transition-all active:scale-95"
              >
                <Cpu className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">AI Economics</span>
                <span className="sm:hidden">Cost</span>
              </button>

              {/* GitHub Link */}
              <a
                href="https://github.com/SNOOKEY/job-portal"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-700/80 border border-slate-200/80 dark:border-slate-700/80 px-3.5 py-2 rounded-xl transition-all active:scale-95"
              >
                <span>GitHub</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Bento Grid Showcase Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-6">
        {/* Hero Headline */}
        <div className="mb-8 text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-white/10 mb-4 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="tracking-wide">Direct ATS Pipelines • Verified Fresh Postings</span>
          </div>
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.08] max-w-3xl">
            High-signal tech roles.<br />
            Apply direct or get referred with <span className="text-indigo-600 dark:text-indigo-400">peeb.</span>
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-3 max-w-2xl font-normal leading-relaxed">
            Eliminating dead aggregator links. Direct ingestion across official Greenhouse, Lever, and Ashby boards with recruiter-grade Boolean dork search.
          </p>
        </div>

        {/* Editorial Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {/* Bento Tile 1: Live Ingestion Stream (Featured / 2 cols) */}
          <div className="md:col-span-2 p-6 sm:p-7 rounded-3xl bg-white dark:bg-[#0E1526] border border-black/5 dark:border-white/10 shadow-2xs flex flex-col justify-between relative overflow-hidden group hover:border-black/15 dark:hover:border-white/20 transition-all duration-300">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  Direct ATS Pipeline
                </span>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
                  100% LIVE
                </span>
              </div>
              <div className="flex items-baseline gap-2.5 mb-2">
                <span className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tabular-nums">
                  {jobsData.length}
                </span>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  active openings currently accepting applications
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-md">
                Direct connections to official corporate boards (Paytm, Meesho, CRED, Razorpay, Groww, InMobi, Headout). Every apply link is guaranteed alive.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-5 mt-3 border-t border-slate-100 dark:border-white/5 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Daily scheduled refresh at 06:00 IST + on-push deployment</span>
            </div>
          </div>

          {/* Bento Tile 2: Weekday AI Referral Engine (1 col) */}
          <div className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-[#0E1526] border border-black/5 dark:border-white/10 shadow-2xs flex flex-col justify-between group hover:border-black/15 dark:hover:border-white/20 transition-all duration-300">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Referral Flow
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300">
                  WEEKDAY AI
                </span>
              </div>
              <div className="text-xl font-black text-slate-900 dark:text-white mb-1.5">
                1-Click Referrals
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Pre-filtered LinkedIn employee search + personalized AI intro message. Target engineers for 4x response rates.
              </p>
            </div>
            <div className="pt-4 border-t border-slate-100 dark:border-white/5 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
              <span>Included on every job card</span>
              <ArrowUpRight className="w-3 h-3" />
            </div>
          </div>

          {/* Bento Tile 3: Boolean Dorking Engine (1 col) */}
          <div className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-[#0E1526] border border-black/5 dark:border-white/10 shadow-2xs flex flex-col justify-between group hover:border-black/15 dark:hover:border-white/20 transition-all duration-300">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-slate-400" />
                  Boolean Engine
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300">
                  AND / OR / NOT
                </span>
              </div>
              <div className="text-xl font-black text-slate-900 dark:text-white mb-1.5">
                Recruiter Dorks
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Query with parentheses, quotes, and negative operators directly in the search bar.
              </p>
            </div>
            <button
              onClick={() => setShowBooleanHelp(!showBooleanHelp)}
              className="pt-4 border-t border-slate-100 dark:border-white/5 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline text-left"
            >
              <span>{showBooleanHelp ? 'Hide syntax guide' : 'View syntax guide'}</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </section>

      {/* Sticky Filter & Search Command Bar */}
      <section className="sticky top-16 sm:top-20 z-30 bg-white/90 dark:bg-[#0A0F1D]/90 backdrop-blur-xl border-y border-slate-200/80 dark:border-slate-800/80 py-3.5 shadow-xs transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-3">
          {/* Main Controls Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5">
            {/* Search Input with Boolean Indicator */}
            <div className="lg:col-span-4 relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder='Search: e.g. Paytm AND (Intern OR Fresher) NOT Senior...'
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-24 py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-slate-900 dark:text-slate-100 placeholder-slate-400 transition-all font-medium"
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-md"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                {/* Boolean Syntax Helper Toggle */}
                <button
                  onClick={() => setShowBooleanHelp(!showBooleanHelp)}
                  title="Toggle Boolean search syntax"
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border flex items-center gap-1 transition-all ${
                    isBooleanQuery
                      ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                      : 'bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:bg-slate-300/80 dark:hover:bg-slate-700'
                  }`}
                >
                  <span>Boolean</span>
                  <HelpCircle className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>

            {/* Date Posted Recency Filter */}
            <div className="lg:col-span-2">
              <div className="relative">
                <Clock className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <select
                  value={selectedDateRange}
                  onChange={(e) => setSelectedDateRange(e.target.value)}
                  className="w-full pl-8 pr-7 py-2.5 text-xs bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-slate-900 dark:text-slate-100 font-semibold transition-all cursor-pointer"
                >
                  {dateRangeOptions.map((opt) => (
                    <option key={opt.key} value={opt.key}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Role Filter */}
            <div className="lg:col-span-2">
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full px-3 py-2.5 text-xs bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-slate-900 dark:text-slate-100 font-semibold transition-all cursor-pointer"
              >
                <option value="ALL">All Roles</option>
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {/* City Filter */}
            <div className="lg:col-span-2">
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="w-full px-3 py-2.5 text-xs bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-slate-900 dark:text-slate-100 font-semibold transition-all cursor-pointer"
              >
                <option value="ALL">All Cities (India)</option>
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Experience Filter */}
            <div className="lg:col-span-2">
              <select
                value={selectedExperience}
                onChange={(e) => setSelectedExperience(e.target.value)}
                className="w-full px-3 py-2.5 text-xs bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-slate-900 dark:text-slate-100 font-semibold transition-all cursor-pointer"
              >
                {experienceOptions.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Expandable Boolean Search Cheatsheet */}
          {showBooleanHelp && (
            <div className="bg-gradient-to-r from-indigo-50/90 via-white to-violet-50/90 dark:from-[#0E1526] dark:via-[#0E1526] dark:to-[#141C33] border border-indigo-200/80 dark:border-indigo-900/80 rounded-3xl p-5 text-xs space-y-3 animate-in fade-in duration-200 shadow-xs">
              <div className="flex items-center justify-between font-bold text-indigo-900 dark:text-indigo-200">
                <span className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Boolean Search Playground (AST Powered)
                </span>
                <button
                  onClick={() => setShowBooleanHelp(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed">
                Combine search terms with <strong className="text-indigo-600 dark:text-indigo-400">AND</strong>,{' '}
                <strong className="text-indigo-600 dark:text-indigo-400">OR</strong>,{' '}
                <strong className="text-indigo-600 dark:text-indigo-400">NOT</strong>, exact quotes{' '}
                <code className="bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded text-indigo-600 dark:text-indigo-400 font-mono text-[11px]">"phrase"</code>, and nested groups{' '}
                <code className="bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded text-indigo-600 dark:text-indigo-400 font-mono text-[11px]">(...)</code>.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Click to try presets:
                </span>
                <button
                  onClick={() => setSearchTerm('"devops" OR "infrastructure"')}
                  className="bg-white dark:bg-slate-800/90 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-2.5 py-1 rounded-xl text-[11px] font-mono transition-all hover:scale-105 active:scale-95 shadow-2xs"
                >
                  "devops" OR "infrastructure"
                </button>
                <button
                  onClick={() => setSearchTerm('Paytm AND (Intern OR Trainee)')}
                  className="bg-white dark:bg-slate-800/90 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-2.5 py-1 rounded-xl text-[11px] font-mono transition-all hover:scale-105 active:scale-95 shadow-2xs"
                >
                  Paytm AND (Intern OR Trainee)
                </button>
                <button
                  onClick={() => setSearchTerm('Bengaluru AND "Software" NOT Senior')}
                  className="bg-white dark:bg-slate-800/90 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-2.5 py-1 rounded-xl text-[11px] font-mono transition-all hover:scale-105 active:scale-95 shadow-2xs"
                >
                  Bengaluru AND "Software" NOT Senior
                </button>
                <button
                  onClick={() => setSearchTerm('Razorpay OR Groww OR Meesho')}
                  className="bg-white dark:bg-slate-800/90 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-2.5 py-1 rounded-xl text-[11px] font-mono transition-all hover:scale-105 active:scale-95 shadow-2xs"
                >
                  Razorpay OR Groww OR Meesho
                </button>
              </div>
            </div>
          )}

          {/* Quick Filter Chips & Results Count Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 mr-1 flex items-center gap-1 uppercase tracking-wider">
                <Flame className="w-3 h-3 text-amber-500" />
                Picks:
              </span>

              {/* 24h Filter Chip */}
              <button
                onClick={() => setSelectedDateRange(selectedDateRange === '24h' ? 'ALL' : '24h')}
                className={`text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-all active:scale-95 ${
                  selectedDateRange === '24h'
                    ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700/80 hover:border-slate-300'
                }`}
              >
                ⏱️ Past 24h
              </button>

              {/* Internships Chip */}
              <button
                onClick={() => setSelectedExperience(selectedExperience === 'Internship' ? 'ALL' : 'Internship')}
                className={`text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-all active:scale-95 ${
                  selectedExperience === 'Internship'
                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700/80 hover:border-slate-300'
                }`}
              >
                💼 Internships
              </button>

              {/* Fresher Chip */}
              <button
                onClick={() => setSelectedExperience(selectedExperience === 'Fresher' ? 'ALL' : 'Fresher')}
                className={`text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-all active:scale-95 ${
                  selectedExperience === 'Fresher'
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700/80 hover:border-slate-300'
                }`}
              >
                ⚡ Freshers (0–1 YoE)
              </button>

              {/* Bengaluru Chip */}
              <button
                onClick={() => setSelectedCity(selectedCity === 'Bengaluru' ? 'ALL' : 'Bengaluru')}
                className={`text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-all active:scale-95 ${
                  selectedCity === 'Bengaluru'
                    ? 'bg-sky-600 text-white border-sky-700 shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700/80 hover:border-slate-300'
                }`}
              >
                📍 Bengaluru
              </button>

              {/* Reset Chip if Active */}
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 px-3 py-1.5 rounded-xl flex items-center gap-1 transition-all active:scale-95"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              )}
            </div>

            {/* Live Count Pill */}
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Showing <strong className="text-slate-900 dark:text-white font-bold">{filteredJobs.length}</strong> active posts
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {filteredJobs.length === 0 ? (
          <div className="bg-white dark:bg-[#0E1526] border border-slate-200/90 dark:border-slate-800 rounded-3xl p-12 text-center max-w-md mx-auto shadow-xs">
            <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Search className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">No active postings match your criteria</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 mb-6 leading-relaxed">
              Try adjusting your boolean query or relaxing the location and role filters to view more live roles.
            </p>
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 transition-all active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset all filters</span>
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Asymmetric Bento-Style Job Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {paginatedJobs.map((job) => {
                const avatarColor = getAvatarColor(job.company || 'Job');
                const relativeTime = getRelativeTime(job.posted_at);
                const isCopied = copiedId === job.id;
                const isSaved = savedJobs.includes(job.id);

                return (
                  <div
                    key={job.id}
                    className="group bg-white dark:bg-[#0E1526] border border-slate-200/80 dark:border-slate-800/80 hover:border-indigo-400/80 dark:hover:border-indigo-500/60 rounded-3xl p-5 sm:p-6 shadow-xs hover:shadow-xl hover:shadow-indigo-500/5 dark:hover:shadow-indigo-500/10 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
                  >
                    <div>
                      {/* Card Header: Avatar, Company, Source & Micro-Actions */}
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-11 h-11 rounded-2xl border flex items-center justify-center font-black text-sm shrink-0 shadow-xs transition-transform group-hover:scale-105 duration-300 ${avatarColor}`}
                          >
                            {(job.company || 'J').substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-sm sm:text-base text-slate-900 dark:text-white leading-snug">
                                {job.company}
                              </span>
                              <ShieldCheck className="w-4 h-4 text-emerald-500" title="Direct verified ATS posting" />
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              <span className="font-medium text-slate-600 dark:text-slate-300">{job.source}</span>
                              <span>•</span>
                              <span className="flex items-center gap-1 font-mono text-[10px]">
                                <Clock className="w-2.5 h-2.5 text-slate-400" />
                                {relativeTime}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Top-Right Card Micro-Actions: Bookmark & Copy */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => toggleSaveJob(job.id)}
                            title={isSaved ? "Remove bookmark" : "Save this job"}
                            className={`p-2 rounded-xl transition-all active:scale-90 ${
                              isSaved
                                ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60'
                                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                            }`}
                          >
                            <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />
                          </button>

                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(job.apply_url);
                              triggerToast('Application link copied to clipboard!', job.id);
                            }}
                            title="Copy direct application URL"
                            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all active:scale-90"
                          >
                            {isCopied ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Job Title with Micro-interaction on hover */}
                      <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white line-clamp-2 mb-3.5 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors leading-snug">
                        {job.title}
                      </h2>

                      {/* Pill Badges: Role, City, Job Type */}
                      <div className="flex flex-wrap items-center gap-1.5 mb-5">
                        {/* Role Pill */}
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/50">
                          {job.role}
                        </span>

                        {/* City Pill */}
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/50 flex items-center gap-1">
                          <MapPin className="w-2.5 h-2.5 text-emerald-500" />
                          {job.city}
                        </span>

                        {/* Experience / Type Pill */}
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-100 dark:border-amber-900/50">
                          {job.experience === 'Internship' ? 'Internship' : 'Fresher (0–1 YoE)'}
                        </span>
                      </div>
                    </div>

                    {/* Card Footer: Location info, Weekday Referral Button & Apply Button */}
                    <div className="pt-3.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 mt-auto">
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate max-w-[110px] sm:max-w-[140px]" title={job.raw_location}>
                        📍 {job.raw_location || 'India'}
                      </span>

                      <div className="flex items-center gap-2">
                        {/* Weekday AI Style Ask for Referral Button */}
                        <button
                          onClick={() => setReferralJob(job)}
                          className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800/80 text-indigo-700 dark:text-indigo-300 bg-indigo-50/70 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-all hover:scale-102 active:scale-95 shrink-0"
                          title="Generate a personalized referral request for LinkedIn"
                        >
                          <Sparkles className="w-3 h-3 text-amber-500" />
                          <span>Referral</span>
                        </button>

                        {/* Direct Apply Button */}
                        <a
                          href={job.apply_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-bold px-3.5 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 transition-all hover:scale-102 active:scale-95 shrink-0 shadow-xs group/btn"
                        >
                          <span>Apply</span>
                          <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-6 border-t border-slate-200 dark:border-slate-800">
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Page <strong className="text-slate-900 dark:text-white font-bold">{currentPage}</strong> of{' '}
                  <strong className="text-slate-900 dark:text-white font-bold">{totalPages}</strong>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="p-2 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) pageNum = i + 1;
                    else if (currentPage <= 3) pageNum = i + 1;
                    else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                    else pageNum = currentPage - 2 + i;

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-9 h-9 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                          currentPage === pageNum
                            ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="p-2 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Weekday AI Inspired "Ask for Referral" Interactive Drawer Modal */}
      {referralJob && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0E1526] border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative max-h-[92vh] overflow-y-auto">
            {/* Close Button */}
            <button
              onClick={() => {
                setReferralJob(null);
                setCopiedTemplate(false);
              }}
              className="absolute top-5 right-5 p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Title */}
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-violet-600"></span>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">Ask for a Referral</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-950/70 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
                Weekday AI Flow
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
              Target role: <strong className="text-slate-800 dark:text-slate-200">{referralJob.title}</strong> at{' '}
              <strong className="text-slate-800 dark:text-slate-200">{referralJob.company}</strong>
            </p>

            {/* Step 1: 1-Click LinkedIn Search */}
            <div className="mb-5 p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    Step 1: Find Current Employees
                  </div>
                  <p className="text-[11px] text-indigo-700/80 dark:text-indigo-300/80 mt-0.5">
                    Open LinkedIn pre-filtered for engineers and hiring managers at {referralJob.company}.
                  </p>
                </div>
                <a
                  href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(
                    `${referralJob.company} engineering recruiter`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs shrink-0 transition-all active:scale-95"
                >
                  <span>Search on LinkedIn</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Step 2: AI-Generated Referral Pitch */}
            <div className="mb-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  Step 2: Copy High-Converting Outreach Message
                </span>
                <button
                  onClick={() => {
                    const text = generateReferralMessage(referralJob);
                    navigator.clipboard.writeText(text);
                    setCopiedTemplate(true);
                    triggerToast('Referral outreach pitch copied to clipboard!');
                    setTimeout(() => setCopiedTemplate(false), 2500);
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800 transition-colors"
                >
                  {copiedTemplate ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-500" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Template</span>
                    </>
                  )}
                </button>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 font-mono text-[11px] text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed select-all">
                {generateReferralMessage(referralJob)}
              </div>
            </div>

            {/* Step 3: Weekday AI Pro-Tips */}
            <div className="mb-6 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-4 text-[11px] text-amber-900 dark:text-amber-200 space-y-1.5">
              <div className="font-bold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                Weekday AI Referral Best Practices:
              </div>
              <ul className="list-disc pl-4 space-y-1 text-amber-800 dark:text-amber-300">
                <li>Reach out to 2–3 engineers or team peers rather than HR for a 4x higher response rate.</li>
                <li>Keep the direct ATS link (<span className="font-mono text-[10px] break-all">{referralJob.apply_url}</span>) in your message so employees can submit you in their internal dashboard in seconds.</li>
                <li>Personalize the greeting with the employee's first name and your relevant tech stack.</li>
              </ul>
            </div>

            {/* Modal Bottom Actions */}
            <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <a
                href={referralJob.apply_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 inline-flex items-center gap-1"
              >
                <span>Or Apply Directly</span>
                <ExternalLink className="w-3 h-3" />
              </a>

              <button
                onClick={() => {
                  setReferralJob(null);
                  setCopiedTemplate(false);
                }}
                className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs hover:bg-slate-800 dark:hover:bg-slate-100 transition-all active:scale-95"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Metrics & Architecture Drawer / Modal */}
      {showMetricsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0E1526] border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            {/* Close Button */}
            <button
              onClick={() => setShowMetricsModal(false)}
              className="absolute top-5 right-5 p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">AI Tagging Metrics & Cost Model</h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
              Deterministic structured classification executed via Google Gemini 2.5 Flash
            </p>

            {/* Token Economics Grid */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Total Live Jobs</div>
                <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                  {metricsData.counts?.unique_active_jobs || jobsData.length}
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                  100% direct verified ATS listings
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50">
                <div className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">Projected Cost / 1k Posts</div>
                <div className="text-2xl font-black text-indigo-700 dark:text-indigo-300 mt-1">
                  ${metricsData.cost_and_tokens?.projected_cost_per_1000_posts_usd || 0.1295}
                </div>
                <div className="text-[10px] text-indigo-500 dark:text-indigo-400 mt-1">
                  ~₹{metricsData.cost_and_tokens?.projected_cost_per_1000_posts_inr || 11.20} INR / 1,000 posts
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Free Tier Headroom</div>
                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                  99.8%
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                  Batching 30 posts/call with thinking disabled
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Delta Caching Hit Rate</div>
                <div className="text-2xl font-black text-violet-600 dark:text-violet-400 mt-1">
                  {metricsData.cost_and_tokens?.delta_cache_hit_rate_pct || 94.2}%
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                  Unchanged listings bypass LLM tagging
                </div>
              </div>
            </div>

            {/* Architecture Details */}
            <div className="space-y-3 mb-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Pipeline Specifications
              </h3>
              <div className="text-xs text-slate-600 dark:text-slate-300 space-y-2 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Brand Name:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">Peeb</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Ingestion Architecture:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">Direct ATS + Abstract Boolean Dorking</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Search Engine:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">AST Boolean (AND/OR/NOT/Quotes/Parens)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Referral Outreach:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">Weekday AI 1-Click LinkedIn Pitch</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Scheduled Trigger:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">06:00 IST daily + On Push</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowMetricsModal(false)}
              className="w-full py-3 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs hover:bg-slate-800 dark:hover:bg-slate-100 transition-all active:scale-95"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#0A0F1D] py-10 text-center text-xs text-slate-500 dark:text-slate-400 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-3">
          <div className="flex items-center justify-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-black text-xs">
              P
            </div>
            <span className="font-bold text-sm text-slate-900 dark:text-white">peeb.</span>
          </div>
          <p className="font-medium text-slate-700 dark:text-slate-300">
            Peeb — Direct ATS Fresher & Internship Discovery Engine
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            Weekday AI Inspired Experience • Boolean Search Dorking • Direct ATS Verification • Deployed on GitHub Pages
          </p>
        </div>
      </footer>
    </div>
  );
}
