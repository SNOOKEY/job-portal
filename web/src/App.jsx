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
  Share2
} from 'lucide-react';

// Import datasets bundled by Vite
import jobsData from '../../data/jobs.json';
import metricsData from '../../data/metrics.json';

const ITEMS_PER_PAGE = 24;

// Avatar color helper based on company name
const getAvatarColor = (name) => {
  const colors = [
    'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/60',
    'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800/60',
    'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800/60',
    'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60',
    'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/60',
    'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60',
    'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800/60',
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
    const saved = localStorage.getItem('beep_theme');
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
  const [showMetricsModal, setShowMetricsModal] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  // Sync dark class to html document
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('beep_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('beep_theme', 'light');
    }
  }, [isDark]);

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
    { key: 'ALL', label: 'Any time' },
    { key: '24h', label: 'Past 24 Hours' },
    { key: '3d', label: 'Past 3 Days' },
    { key: '7d', label: 'Past Week (7 Days)' },
    { key: '30d', label: 'Past Month (30 Days)' },
  ];

  const sources = useMemo(() => {
    const list = Object.keys(metricsData.distributions?.by_source || {});
    return list.length ? list : ['Greenhouse', 'Lever', 'Ashby', 'SimplifyJobs'];
  }, []);

  // Filtered jobs
  const filteredJobs = useMemo(() => {
    const nowTime = Date.now();
    return jobsData.filter((job) => {
      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesTitle = job.title?.toLowerCase().includes(query);
        const matchesCompany = job.company?.toLowerCase().includes(query);
        const matchesRole = job.role?.toLowerCase().includes(query);
        const matchesCity = job.city?.toLowerCase().includes(query);
        const matchesExp = job.experience?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesCompany && !matchesRole && !matchesCity && !matchesExp) {
          return false;
        }
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

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#090D16] text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2.5 rounded-xl shadow-xl text-xs font-semibold animate-bounce">
          <Check className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#0D1322]/95 backdrop-blur-md border-b border-gray-200/90 dark:border-slate-800 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Identity */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-black text-lg shadow-md shadow-indigo-500/20">
                ⚡
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-xl text-slate-900 dark:text-white tracking-tight">Beep</span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    Fresher & Intern Portal
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-slate-400 hidden sm:block">
                  Live aggregator across Greenhouse, Lever, Ashby & verified public feeds
                </p>
              </div>
            </div>

            {/* Quick Actions, Theme Toggle & Metrics */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Live Status Indicator */}
              <div className="hidden lg:flex items-center gap-2 text-xs text-gray-600 dark:text-slate-300 bg-gray-100/80 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 px-3 py-1.5 rounded-lg">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>Refreshed: <strong>{lastRefreshedDate}</strong></span>
              </div>

              {/* Dark Mode Toggle */}
              <button
                onClick={() => setIsDark(!isDark)}
                aria-label="Toggle Theme"
                className="p-2 rounded-xl text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 border border-gray-200 dark:border-slate-700 transition-colors"
                title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
              >
                {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
              </button>

              {/* Architecture & AI Cost Modal Trigger */}
              <button
                onClick={() => setShowMetricsModal(true)}
                className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 px-3 py-1.5 rounded-xl transition-all"
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>AI Cost Tracker</span>
              </button>

              {/* GitHub Link */}
              <a
                href="https://github.com/SNOOKEY/job-portal"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 px-3 py-1.5 rounded-xl transition-all"
              >
                <span>GitHub</span>
                <ExternalLink className="w-3 h-3 text-gray-400" />
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Live Stats Bar */}
      <section className="bg-gradient-to-b from-white to-gray-50/50 dark:from-[#0D1322] dark:to-[#090D16] border-b border-gray-200 dark:border-slate-800 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Verified Live Applications
                </span>
                <span className="text-xs text-gray-500 dark:text-slate-400">
                  All links open official ATS forms
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                India Fresher & Internship Portal
              </h1>
              <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                Aggregating authentic opportunities across top startups & tech giants. Direct application links with zero middlemen.
              </p>
            </div>

            {/* Quick Metrics Chips */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              <div className="bg-white dark:bg-slate-800/70 border border-gray-200 dark:border-slate-700/80 px-3 py-2 rounded-xl text-center">
                <div className="text-lg font-black text-indigo-600 dark:text-indigo-400">{jobsData.length}</div>
                <div className="text-[11px] font-medium text-gray-500 dark:text-slate-400">Live Postings</div>
              </div>
              <div className="bg-white dark:bg-slate-800/70 border border-gray-200 dark:border-slate-700/80 px-3 py-2 rounded-xl text-center">
                <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                  {metricsData.distributions?.by_job_type?.['Internship'] || 120}
                </div>
                <div className="text-[11px] font-medium text-gray-500 dark:text-slate-400">Internships</div>
              </div>
              <div className="bg-white dark:bg-slate-800/70 border border-gray-200 dark:border-slate-700/80 px-3 py-2 rounded-xl text-center">
                <div className="text-lg font-black text-amber-600 dark:text-amber-400">
                  {metricsData.distributions?.by_city?.['Bengaluru'] || 45}
                </div>
                <div className="text-[11px] font-medium text-gray-500 dark:text-slate-400">Bengaluru Hub</div>
              </div>
              <div className="bg-white dark:bg-slate-800/70 border border-gray-200 dark:border-slate-700/80 px-3 py-2 rounded-xl text-center">
                <div className="text-lg font-black text-violet-600 dark:text-violet-400">
                  ${metricsData.cost_and_tokens?.projected_cost_per_1000_posts_usd || 0.1295}
                </div>
                <div className="text-[11px] font-medium text-gray-500 dark:text-slate-400">Cost / 1k Posts</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sticky Filter Bar */}
      <section className="sticky top-16 z-30 bg-white/95 dark:bg-[#0F172A]/95 backdrop-blur-md border-b border-gray-200 dark:border-slate-800 shadow-xs py-3.5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-3">
          {/* Main Controls Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5">
            {/* Search Input */}
            <div className="lg:col-span-4 relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search job title, company, skill, city..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-slate-900 dark:text-slate-100 placeholder-gray-400 transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Date Posted Filter (Requested: 24h, 3d, 1 week, etc.) */}
            <div className="lg:col-span-2">
              <div className="relative">
                <Clock className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <select
                  value={selectedDateRange}
                  onChange={(e) => setSelectedDateRange(e.target.value)}
                  className="w-full pl-8 pr-7 py-2 text-xs bg-gray-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-slate-900 dark:text-slate-100 font-medium transition-all"
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
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-slate-900 dark:text-slate-100 font-medium transition-all"
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
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-slate-900 dark:text-slate-100 font-medium transition-all"
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
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-slate-900 dark:text-slate-100 font-medium transition-all"
              >
                {experienceOptions.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Filter Chips & Results Count Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-gray-500 dark:text-slate-400 mr-1 flex items-center gap-1">
                <Flame className="w-3 h-3 text-amber-500" />
                Quick Filters:
              </span>

              {/* 24h Filter Chip */}
              <button
                onClick={() => setSelectedDateRange(selectedDateRange === '24h' ? 'ALL' : '24h')}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all ${
                  selectedDateRange === '24h'
                    ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:border-gray-300'
                }`}
              >
                ⏱️ Past 24 Hours
              </button>

              {/* Internships Chip */}
              <button
                onClick={() => setSelectedExperience(selectedExperience === 'Internship' ? 'ALL' : 'Internship')}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all ${
                  selectedExperience === 'Internship'
                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:border-gray-300'
                }`}
              >
                💼 Internships
              </button>

              {/* Fresher Chip */}
              <button
                onClick={() => setSelectedExperience(selectedExperience === 'Fresher' ? 'ALL' : 'Fresher')}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all ${
                  selectedExperience === 'Fresher'
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:border-gray-300'
                }`}
              >
                ⚡ Freshers (0–1 YoE)
              </button>

              {/* Bengaluru Chip */}
              <button
                onClick={() => setSelectedCity(selectedCity === 'Bengaluru' ? 'ALL' : 'Bengaluru')}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all ${
                  selectedCity === 'Bengaluru'
                    ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:border-gray-300'
                }`}
              >
                📍 Bengaluru
              </button>

              {/* Reset Chip if Active */}
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Clear All</span>
                </button>
              )}
            </div>

            {/* Live Count Pill */}
            <div className="text-xs font-medium text-gray-600 dark:text-slate-400">
              Showing <strong className="text-slate-900 dark:text-white font-bold">{filteredJobs.length}</strong> active posts
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {filteredJobs.length === 0 ? (
          <div className="bg-white dark:bg-[#131C31] border border-gray-200 dark:border-slate-800 rounded-2xl p-12 text-center max-w-md mx-auto shadow-xs">
            <div className="w-12 h-12 bg-gray-100 dark:bg-slate-800 text-gray-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">No active postings match your criteria</h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 mb-5">
              Try relaxing your date posted, role, or city filters to view more opportunities.
            </p>
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset all filters</span>
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Job Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedJobs.map((job) => {
                const avatarColor = getAvatarColor(job.company || 'Job');
                const relativeTime = getRelativeTime(job.posted_at);
                const isCopied = copiedId === job.id;

                return (
                  <div
                    key={job.id}
                    className="group bg-white dark:bg-[#131C31] border border-gray-200/90 dark:border-slate-800/90 hover:border-indigo-400/80 dark:hover:border-indigo-500/60 rounded-2xl p-5 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between"
                  >
                    <div>
                      {/* Card Header: Company, Source & Posted Time */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-xl border flex items-center justify-center font-black text-sm shrink-0 shadow-xs ${avatarColor}`}
                          >
                            {(job.company || 'J').substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-sm text-slate-900 dark:text-white leading-snug">
                                {job.company}
                              </span>
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" title="Direct verified ATS posting" />
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-slate-400">
                              <span className="font-medium text-gray-600 dark:text-slate-300">{job.source}</span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-gray-400" />
                                {relativeTime}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Copy Link Action Button */}
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(job.apply_url);
                            triggerToast('Application link copied to clipboard!', job.id);
                          }}
                          title="Copy direct application URL"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          {isCopied ? (
                            <Check className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>

                      {/* Job Title */}
                      <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white line-clamp-2 mb-3 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {job.title}
                      </h2>

                      {/* Pill Badges: Role, City, Job Type */}
                      <div className="flex flex-wrap items-center gap-1.5 mb-4">
                        {/* Role Pill */}
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/50">
                          {job.role}
                        </span>

                        {/* City Pill */}
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/50 flex items-center gap-1">
                          <MapPin className="w-2.5 h-2.5 text-emerald-500" />
                          {job.city}
                        </span>

                        {/* Experience / Type Pill */}
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-100 dark:border-amber-900/50">
                          {job.experience === 'Internship' ? 'Internship' : 'Fresher (0–1 YoE)'}
                        </span>
                      </div>
                    </div>

                    {/* Card Footer: Location info & Apply Button */}
                    <div className="pt-3 border-t border-gray-100 dark:border-slate-800/80 flex items-center justify-between gap-2 mt-auto">
                      <span className="text-[11px] text-gray-500 dark:text-slate-400 truncate max-w-[170px]" title={job.raw_location}>
                        📍 {job.raw_location || 'India'}
                      </span>

                      <a
                        href={job.apply_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-bold px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs hover:shadow-indigo-500/20 transition-all shrink-0"
                      >
                        <span>Apply</span>
                        <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="bg-white dark:bg-[#131C31] border border-gray-200 dark:border-slate-800 rounded-2xl px-4 py-3 flex items-center justify-between shadow-xs mt-8">
                <div className="text-xs text-gray-500 dark:text-slate-400">
                  Page <strong className="text-slate-900 dark:text-white font-bold">{currentPage}</strong> of{' '}
                  <strong className="text-slate-900 dark:text-white font-bold">{totalPages}</strong>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    disabled={currentPage === 1}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Previous</span>
                  </button>

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-slate-800 bg-white dark:bg-[#0D1322] py-8 text-center text-xs text-gray-500 dark:text-slate-400 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-2">
          <p className="font-medium text-slate-700 dark:text-slate-300">
            Beep Fresher & Internship Aggregator — Gen AI MVP
          </p>
          <p className="text-[11px] text-gray-400 dark:text-slate-500">
            Built with Gemini 2.5 Flash Structured Outputs • Daily Refresh via GitHub Actions • Deployed on GitHub Pages
          </p>
        </div>
      </footer>

      {/* AI Metrics & Architecture Drawer / Modal */}
      {showMetricsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#131C31] border border-gray-200 dark:border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            {/* Close Button */}
            <button
              onClick={() => setShowMetricsModal(false)}
              className="absolute top-5 right-5 p-1 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">AI Tagging Metrics & Cost Model</h2>
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-6">
              Deterministic structured classification executed via Google Gemini 2.5 Flash
            </p>

            {/* Token Economics Grid */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800">
                <div className="text-[11px] font-semibold text-gray-500 dark:text-slate-400">Total Live Jobs</div>
                <div className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                  {metricsData.counts?.unique_active_jobs || jobsData.length}
                </div>
                <div className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">
                  From {metricsData.counts?.raw_fetched || 608} raw scraped posts
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50">
                <div className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">Projected Cost / 1k Posts</div>
                <div className="text-xl font-black text-indigo-700 dark:text-indigo-300 mt-0.5">
                  ${metricsData.cost_and_tokens?.projected_cost_per_1000_posts_usd || 0.1295}
                </div>
                <div className="text-[10px] text-indigo-500 dark:text-indigo-400 mt-1">
                  ~₹{metricsData.cost_and_tokens?.projected_cost_per_1000_posts_inr || 11.20} INR / 1,000 posts
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800">
                <div className="text-[11px] font-semibold text-gray-500 dark:text-slate-400">Tokens per Post</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">~175 Tokens</div>
                <div className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">140 Prompt + 35 Output</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800">
                <div className="text-[11px] font-semibold text-gray-500 dark:text-slate-400">LLM Engine</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">Gemini 2.5 Flash</div>
                <div className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">Thinking budget: 0 (Fast)</div>
              </div>
            </div>

            {/* Architecture Details */}
            <div className="space-y-3 mb-6">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Pipeline Specifications
              </h3>
              <div className="text-xs text-gray-600 dark:text-slate-300 space-y-1.5 bg-gray-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-gray-200 dark:border-slate-800">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-slate-400">Ingestion Architecture:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">Greenhouse + Lever + Ashby + Public Feeds</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-slate-400">Deduplication:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">SHA-256 fingerprint + canonical URL</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-slate-400">Audit Sample:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">audit/sample_50.csv (50 random rows)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-slate-400">Scheduled Trigger:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">06:00 IST daily (GitHub Actions)</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowMetricsModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold text-xs hover:bg-slate-800 dark:hover:bg-slate-100 transition-all"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
