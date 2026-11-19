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
  FileSpreadsheet
} from 'lucide-react';

// Import datasets bundled by Vite
import jobsData from '../../data/jobs.json';
import metricsData from '../../data/metrics.json';

const ITEMS_PER_PAGE = 24;

// Avatar color helper based on company name
const getAvatarColor = (name) => {
  const colors = [
    'bg-blue-100 text-blue-700 border-blue-200',
    'bg-indigo-100 text-indigo-700 border-indigo-200',
    'bg-purple-100 text-purple-700 border-purple-200',
    'bg-emerald-100 text-emerald-700 border-emerald-200',
    'bg-rose-100 text-rose-700 border-rose-200',
    'bg-amber-100 text-amber-700 border-amber-200',
    'bg-cyan-100 text-cyan-700 border-cyan-200',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

export default function App() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('ALL');
  const [selectedCity, setSelectedCity] = useState('ALL');
  const [selectedExperience, setSelectedExperience] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedSource, setSelectedSource] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [showMetricsModal, setShowMetricsModal] = useState(false);

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
    { key: 'Internship', label: 'Internship' },
    { key: 'Fresher', label: 'Fresher (0-1 YoE)' },
    { key: 'Mid-Level', label: 'Mid-Level (2-5 YoE)' },
    { key: 'Senior', label: 'Senior (5+ YoE)' },
  ];

  const sources = useMemo(() => {
    const list = Object.keys(metricsData.distributions?.by_source || {});
    return list.length ? list : ['Greenhouse', 'Lever', 'Ashby', 'SimplifyJobs'];
  }, []);

  // Filtered jobs
  const filteredJobs = useMemo(() => {
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

      // Experience Level (Internship, Fresher, Mid-Level, Senior)
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

      return true;
    });
  }, [searchTerm, selectedRole, selectedCity, selectedExperience, selectedType, selectedSource]);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedRole, selectedCity, selectedExperience, selectedType, selectedSource]);

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
    setSelectedSource('ALL');
  };

  const hasActiveFilters =
    searchTerm !== '' ||
    selectedRole !== 'ALL' ||
    selectedCity !== 'ALL' ||
    selectedExperience !== 'ALL' ||
    selectedType !== 'ALL' ||
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
    <div className="min-h-screen bg-[#F9FAFB] text-slate-900 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Identity */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-sm shadow-indigo-200">
                ⚡
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-lg text-slate-900 tracking-tight">Beep</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Fresher & Intern Jobs
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 hidden sm:block">
                  Auto-curated daily across public Greenhouse, Lever & Ashby boards
                </p>
              </div>
            </div>

            {/* Quick Actions & Metrics */}
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2 text-xs text-gray-600 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Refreshed: <strong>{lastRefreshedDate}</strong></span>
              </div>

              <button
                onClick={() => setShowMetricsModal(true)}
                className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>AI Cost Tracker</span>
              </button>

              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-gray-600 hover:text-gray-900 px-2 py-1.5 rounded-lg transition-colors"
              >
                GitHub
              </a>
            </div>
          </div>
        </div>

        {/* Filter Bar (Sticky directly below header) */}
        <div className="bg-white border-t border-gray-100 py-3 shadow-xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
              {/* Search Box */}
              <div className="relative flex-1 min-w-[240px]">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by role, company, skills, or city..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all placeholder:text-gray-400"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Dropdowns */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Role Filter */}
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="text-xs font-medium bg-gray-50 border border-gray-200 text-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="ALL">All Roles ({roles.length})</option>
                  {roles.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>

                {/* City Filter */}
                <select
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className="text-xs font-medium bg-gray-50 border border-gray-200 text-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="ALL">All Cities ({cities.length})</option>
                  {cities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                {/* Experience Level Filter (Internship, Fresher, Mid, Senior) */}
                <select
                  value={selectedExperience}
                  onChange={(e) => setSelectedExperience(e.target.value)}
                  className="text-xs font-semibold bg-indigo-50/70 border border-indigo-200 text-indigo-900 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
                >
                  {experienceOptions.map((opt) => (
                    <option key={opt.key} value={opt.key}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                {/* Type Filter */}
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="text-xs font-medium bg-gray-50 border border-gray-200 text-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="ALL">All Job Types</option>
                  <option value="Internship">Internship</option>
                  <option value="Full-Time Fresher">Full-Time Fresher</option>
                  <option value="Full-Time">Full-Time</option>
                </select>

                {/* Source Filter */}
                <select
                  value={selectedSource}
                  onChange={(e) => setSelectedSource(e.target.value)}
                  className="text-xs font-medium bg-gray-50 border border-gray-200 text-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="ALL">All ATS Sources</option>
                  {sources.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>

                {/* Clear Filter */}
                {hasActiveFilters && (
                  <button
                    onClick={resetFilters}
                    className="flex items-center gap-1 text-xs font-medium text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-2 rounded-lg transition-colors cursor-pointer"
                    title="Clear all active filters"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset</span>
                  </button>
                )}
              </div>
            </div>

            {/* Result Counter & Active Filter Pills */}
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50 text-xs text-gray-500">
              <div>
                Showing <strong className="text-gray-900">{filteredJobs.length}</strong> of{' '}
                <strong>{jobsData.length}</strong> fresher openings
              </div>
              <div className="text-[11px] text-gray-400">
                Page {currentPage} of {totalPages}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {filteredJobs.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-200 shadow-xs p-8 max-w-md mx-auto">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4 text-gray-400">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">No matching openings found</h3>
            <p className="text-xs text-gray-500 mb-4">
              Try adjusting your search query, or clear filters to view all active Indian tech posts.
            </p>
            <button
              onClick={resetFilters}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors"
            >
              Clear All Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedJobs.map((job) => {
              const avatarClass = getAvatarColor(job.company || 'Company');
              const initial = (job.company || 'C').charAt(0).toUpperCase();

              return (
                <div
                  key={job.id}
                  className="group bg-white rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all duration-200 p-5 flex flex-col justify-between"
                >
                  {/* Card Header: Company, Source, Title */}
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-9 h-9 rounded-lg border flex items-center justify-center font-bold text-sm shrink-0 ${avatarClass}`}
                        >
                          {initial}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-gray-900 truncate">
                            {job.company}
                          </h4>
                          <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                            via {job.source}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border shadow-2xs ${
                            (job.experience || job.job_type) === 'Internship'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : (job.experience || job.job_type) === 'Fresher'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : (job.experience || job.job_type) === 'Mid-Level'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {job.experience === 'Mid-Level'
                            ? 'Mid (2-5 YoE)'
                            : job.experience === 'Senior'
                            ? 'Senior (5+ YoE)'
                            : job.experience || job.job_type || 'Fresher'}
                        </span>
                      </div>
                    </div>

                    {/* Job Title */}
                    <h3
                      className="text-sm font-bold text-slate-900 line-clamp-2 mb-3 group-hover:text-indigo-600 transition-colors"
                      title={job.title}
                    >
                      {job.title}
                    </h3>

                    {/* Pills: Role, City */}
                    <div className="flex flex-wrap items-center gap-1.5 mb-3">
                      {/* LLM Role Badge */}
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                        <Briefcase className="w-3 h-3 text-indigo-500" />
                        {job.role}
                      </span>

                      {/* LLM City Badge */}
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 border border-gray-200">
                        <MapPin className="w-3 h-3 text-gray-400" />
                        {job.city}
                      </span>
                    </div>

                    {/* Raw Location Subtitle if different */}
                    <p className="text-[11px] text-gray-400 line-clamp-1 mb-4" title={job.raw_location}>
                      {job.raw_location}
                    </p>
                  </div>

                  {/* Card Footer: Apply Action */}
                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-[11px] text-gray-400">
                      {job.posted_at ? 'Active' : 'Recently Added'}
                    </span>
                    <a
                      href={job.apply_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors"
                    >
                      <span>Apply</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Bar */}
        {filteredJobs.length > ITEMS_PER_PAGE && (
          <div className="mt-8 flex items-center justify-between border-t border-gray-200 pt-4">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 text-xs font-medium text-gray-700 bg-white border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>

            <div className="text-xs text-gray-600 font-medium">
              Page <span className="text-gray-900 font-bold">{currentPage}</span> of{' '}
              <span className="text-gray-900 font-bold">{totalPages}</span>
            </div>

            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 text-xs font-medium text-gray-700 bg-white border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </main>

      {/* AI Token & Cost Metrics Modal */}
      {showMetricsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    Gemini AI Pipeline & Token Cost Tracker
                  </h3>
                  <p className="text-xs text-gray-500">
                    Live operational metrics and projected economics for 1,000 posts
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowMetricsModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Key Economics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-5">
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                <span className="text-[11px] text-gray-500 font-medium">Cost / 1k Posts</span>
                <div className="text-base font-extrabold text-indigo-600 mt-0.5">
                  ${metricsData.cost_and_tokens?.projected_cost_per_1000_posts_usd || 0.1295}
                </div>
                <div className="text-[10px] text-gray-400">
                  ₹{metricsData.cost_and_tokens?.projected_cost_per_1000_posts_inr || 11.2} INR
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                <span className="text-[11px] text-gray-500 font-medium">Run Actual Cost</span>
                <div className="text-base font-extrabold text-gray-900 mt-0.5">
                  ${metricsData.cost_and_tokens?.run_cost_usd || 0.0079}
                </div>
                <div className="text-[10px] text-gray-400">
                  ₹{metricsData.cost_and_tokens?.run_cost_inr || 0.68} INR
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                <span className="text-[11px] text-gray-500 font-medium">Total Tokens</span>
                <div className="text-base font-extrabold text-gray-900 mt-0.5">
                  {(metricsData.cost_and_tokens?.total_tokens || 0).toLocaleString()}
                </div>
                <div className="text-[10px] text-gray-400">
                  {metricsData.cost_and_tokens?.input_tokens?.toLocaleString()} in /{' '}
                  {metricsData.cost_and_tokens?.output_tokens?.toLocaleString()} out
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                <span className="text-[11px] text-gray-500 font-medium">Active Posts</span>
                <div className="text-base font-extrabold text-emerald-600 mt-0.5">
                  {metricsData.counts?.unique_active_jobs || jobsData.length}
                </div>
                <div className="text-[10px] text-gray-400">
                  -{metricsData.counts?.duplicates_removed || 0} duplicates
                </div>
              </div>
            </div>

            {/* Pricing Model Specs */}
            <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-3.5 mb-5 text-xs">
              <div className="font-bold text-indigo-950 mb-1 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-indigo-600" />
                <span>Reference Model: Google Gemini 2.5 Flash</span>
              </div>
              <p className="text-indigo-800 text-[11px]">
                Structured outputs (JSON Schema) at $0.30/1M input tokens and $2.50/1M output tokens.
                Targeting ₹11.20 ($0.13) total compute cost per 1,000 processed jobs.
              </p>
            </div>

            {/* Role & City Breakdown */}
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold text-gray-900 mb-2 uppercase tracking-wider">
                  Role Distribution
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(metricsData.distributions?.by_role || {}).map(([r, count]) => (
                    <div
                      key={r}
                      className="flex items-center justify-between text-xs bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-200"
                    >
                      <span className="truncate text-gray-600">{r}</span>
                      <strong className="text-gray-900 ml-2">{count}</strong>
                    </div>
                  ))}
                </div>
              </div>

              {/* Experience Breakdown */}
              <div>
                <h4 className="text-xs font-bold text-gray-900 mb-2 uppercase tracking-wider">
                  Experience Levels
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {['Internship', 'Fresher', 'Mid-Level', 'Senior'].map((lvl) => {
                    const count = metricsData.distributions?.by_experience?.[lvl] || 
                      jobsData.filter(j => j.experience === lvl).length;
                    return (
                      <div
                        key={lvl}
                        className="flex items-center justify-between text-xs bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-200"
                      >
                        <span className="truncate text-gray-600 font-medium">
                          {lvl === 'Mid-Level' ? 'Mid (2-5 YoE)' : lvl === 'Senior' ? 'Senior (5+ YoE)' : lvl}
                        </span>
                        <strong className="text-gray-900 ml-2">{count}</strong>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-gray-900 mb-2 uppercase tracking-wider">
                  Top Hubs
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(metricsData.distributions?.by_city || {}).map(([c, count]) => (
                    <div
                      key={c}
                      className="flex items-center justify-between text-xs bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-200"
                    >
                      <span className="truncate text-gray-600">{c}</span>
                      <strong className="text-gray-900 ml-2">{count}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <span>Pipeline Duration: {metricsData.duration_seconds || 1.2}s</span>
              <button
                onClick={() => setShowMetricsModal(false)}
                className="px-4 py-2 font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
          <div>
            <strong>Beep Fresher & Internship Job Portal</strong> • Built with Gemini 2.5 Flash, Vite & Tailwind CSS.
          </div>
          <div className="flex items-center gap-4">
            <span>Runs daily at 06:00 IST via GitHub Actions</span>
            <span>•</span>
            <button
              onClick={() => setShowMetricsModal(true)}
              className="text-indigo-600 hover:underline cursor-pointer"
            >
              Cost & Architecture
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
