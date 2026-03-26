import React, { useState, useEffect } from 'react';
import Markdown from 'react-markdown';
import { Sparkles, Loader2, Search, FileText, Globe, AlertCircle, Copy, Check, Briefcase, Settings, ChevronDown, Zap, ShieldCheck, Activity, PenTool, Edit, Link } from 'lucide-react';
import { AVAILABLE_MODELS, determineBestModel, generateWithFallback, APIKeys, getStoredKeys, saveStoredKeys, AIModel } from './services/aiService';
import { loggingService } from './services/loggingService';

export default function App() {
  const [keyword, setKeyword] = useState('');
  const [brandName, setBrandName] = useState('');
  const [audienceSelect, setAudienceSelect] = useState('Beginners');
  const [customAudience, setCustomAudience] = useState('');
  const [language, setLanguage] = useState('Vietnamese');
  const [referenceUrl, setReferenceUrl] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [enableSearch, setEnableSearch] = useState(false);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [appMode, setAppMode] = useState<'rewrite' | 'write'>('rewrite');

  // New State for Multi-Model & Mode
  const [mode, setMode] = useState<'Fast' | 'Quality' | 'Auto'>('Auto');
  const [selectedModelId, setSelectedModelId] = useState<string>('auto'); // 'auto' means let the system decide based on mode
  const [activeModel, setActiveModel] = useState<AIModel | null>(null);
  const [fallbackMessage, setFallbackMessage] = useState('');

  // API Keys State
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeys, setApiKeys] = useState<APIKeys>({ gemini: '', openai: '', openrouter: '' });

  useEffect(() => {
    setApiKeys(getStoredKeys());
  }, []);

  useEffect(() => {
    if (isGenerating && result.length > 0 && progressStep < 2) {
      setProgressStep(2);
    }
  }, [result, isGenerating, progressStep]);

  const handleSaveKeys = (keys: APIKeys) => {
    setApiKeys(keys);
    saveStoredKeys(keys);
    setShowSettings(false);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword) {
      setError('Please fill in the required field: Keyword.');
      return;
    }
    if (appMode === 'rewrite' && !originalContent) {
      setError('Please fill in the required field: Original Content.');
      return;
    }

    const finalAudience = audienceSelect === 'Custom' ? customAudience : audienceSelect;

    setIsGenerating(true);
    setProgressStep(0);
    setResult('');
    setError('');
    setCopied(false);
    setFallbackMessage('');

    setTimeout(() => {
      setProgressStep(prev => prev === 0 ? 1 : prev);
    }, 1500);

    try {
      let targetModel: AIModel;
      if (selectedModelId === 'auto') {
        targetModel = determineBestModel(mode, 'rewrite');
      } else {
        targetModel = AVAILABLE_MODELS.find(m => m.id === selectedModelId) || AVAILABLE_MODELS[0];
      }

      setActiveModel(targetModel);

      const rewriteInstruction = `You are a senior SEO content auditor and editor with deep expertise in modern SEO (2025 standards), including search intent optimization, EEAT (Experience, Expertise, Authoritativeness, Trustworthiness), semantic SEO, topical authority, and conversion-focused content.

SEARCH ENGINE & INTENT RULES:
- Search Engine: Google.com.vn
- Device Type: Mobile
- All SERP analysis MUST reflect Vietnamese mobile search results only.
- Automatically detect the search intent based on the main keyword. If Google Search is enabled, use the SERP data to validate and refine this intent.
- All outputs must be in the requested language (default: Vietnamese).

CORE OBJECTIVE:
- Do NOT return an audit report
- Your final output MUST be a fully rewritten, SEO-optimized article
- The rewritten version must be significantly better than the original
- The content must be ready to publish without further editing

CONTENT ENRICHMENT & EDITING RULES:
- Base your rewrite on the "Original Article Content".
- IF Google Search is enabled, you MUST analyze the top search results for the main keyword. Extract valuable insights, missing details, and modern perspectives from these top results to ENRICH and EXPAND the original content.
- You are ALLOWED to add new sections and expand the scope if they provide significant value to the Target Audience based on top SERP competitors.
- Ensure the final content is comprehensive, detailed, and superior to the top-ranking pages.

TARGET AUDIENCE ADAPTATION (CRITICAL):
- Tone: Authentic (chân thật), friendly (thân thiện), and highly engaging.
- Depth: Provide detailed explanations, real-world examples, and actionable advice specifically tailored to the selected Target Audience.
- Speak directly to the audience's pain points, needs, and level of understanding.

NO FABRICATION POLICY (STRICT):
- You MUST NOT fabricate any information.
- Only use verified knowledge, realistic SEO practices, and data inferred from SERP (if search is enabled).
- If information is uncertain or not available, DO NOT guess. Skip or generalize carefully without making false claims.

BRAND NAME & EEAT:
- Use the provided "Brand Name" to align the tone and positioning of the content.
- Reflect the brand voice consistently in the rewritten article.
- Use the brand name to support EEAT signals (authority, trust, credibility).

WRITING REQUIREMENTS:
- Follow SEO best practices (2025)
- Strong alignment with search intent
- Clear, logical structure (H1 → H2 → H3 → bullet points when needed)
- Natural keyword distribution (no keyword stuffing)
- Distribute the main keyword evenly across headings and body content.
- Explicitly mention specific AI models by name (e.g., ChatGPT, Claude, Midjourney, Gemini, etc.) when discussing course content, tools, or applications.
- Include:
  - Engaging introduction (hook + intent match)
  - Well-structured body content
  - Actionable insights
  - Real value for beginners and practitioners
  - Conversion elements (CTA where appropriate)
  - FAQ section for SEO (if relevant and within original scope)
- Improve readability:
  - Clear explanations
  - Simple but professional tone
  - Avoid fluff and generic statements
- NO ICONS / NO EMOJIS: Do NOT use any icons, emojis, or decorative symbols in the output. Ensure the content is clean, professional, and suitable for SEO articles.

OUTPUT FORMAT (STRICT):
Return ONLY the final rewritten article.

DO NOT:
- Return JSON
- Return audit explanation
- Return analysis steps
- Mention tools, APIs, or process
- Use icons or emojis
- Prefix headings with "H1:", "H2:", "H3:", etc. Just use standard markdown formatting (e.g., # Heading 1, ## Heading 2).

OUTPUT MUST INCLUDE:
- SEO-optimized title
- Meta description (approximately 120 words, placed right below H1, main keyword MUST appear in the first line)
- Full article content (well-structured with headings)
- FAQ section (if relevant and within original scope)
- A "References:" section at the end. List real URLs only (no fake links) used during analysis. If Google Search is enabled, include real URLs from SERP results.

WRITING STYLE:
- Professional but friendly
- Clear and easy to understand
- Focused on real value
- Suitable for beginners but still authoritative

FINAL RULE:
Your output must be better, clearer, more complete, and more SEO-optimized than the original content in every aspect. Make it highly authentic, friendly, and deeply detailed for the target audience.`;

      const writeInstruction = `You are an expert SEO content writer specialized in educational course content in Vietnam.

Your task is to write a full SEO article by strictly following the writing style, structure, and optimization techniques described below.

SEARCH ENGINE & INTENT RULES:
- Search Engine: Google.com.vn
- Device Type: Mobile
- All SERP analysis MUST reflect Vietnamese mobile search results only.
- Automatically detect the search intent based on the main keyword. If Google Search is enabled, use the SERP data to validate and refine this intent.
- All outputs must be in the requested language (default: Vietnamese).

IMPORTANT:
- Do NOT focus on keyword research
- Focus on writing style, structure, and content depth
- The article must feel like a high-converting SEO landing page + blog hybrid
- IF Google Search is enabled, you MUST analyze the top search results for the main keyword. Extract valuable insights, cover all necessary subtopics, answer user intent fully, and ensure your article is superior to the top-ranking pages.

BRAND NAME & TARGET AUDIENCE:
- Use the provided "Brand Name" to align the tone and positioning of the content.
- Adapt the depth and tone specifically to the provided "Target Audience". Speak directly to the audience's pain points, needs, and level of understanding.

---

WRITING STRUCTURE (MANDATORY):

1) Introduction
- Start with a trend or problem (technology, AI, market change)
- Explain why the topic is important
- Naturally introduce the solution (course/training)

---

2) Benefits Section
- Use H2 heading
- Use bullet points
- Each bullet MUST include:
  - Clear action (what user can do)
  - Real outcome (specific benefit)
  - Practical application

---

3) Learning Roadmap / Course Structure
- Break into sessions / steps
- Each section must include:
  - What will be learned
  - What users can do after learning

---

4) Learning Objectives
- Explain what users will master
- Go deeper than surface-level benefits
- Include real-world applications

---

5) Detailed Content Section
- Expand into deeper knowledge
- Explain concepts clearly for beginners
- Cover multiple aspects of the topic (broad coverage)

---

6) Tools / Applications
- Mention real tools, platforms, or methods
- Explain how they are used in practice

---

7) Conversion Section (CTA)
- Encourage action (enroll, register, contact)
- Reinforce value and urgency
- Highlight experience, credibility, or trust

---

WRITING STYLE:

- Tone: Professional but friendly
- Style: Educational + advisory (like a consultant)
- Avoid generic statements
- Always explain clearly for beginners
- Each paragraph must provide value (no filler)

---

KEY CONTENT TECHNIQUES:

1) Semantic Expansion
- Always expand ideas with examples and use cases

2) Benefit-Driven Writing
- Focus on outcomes, not just features

3) Structured Readability
- Use H2 → H3 → bullet points
- Make content easy to scan

4) Natural Keyword Distribution
- Repeat important phrases naturally across:
  - headings
  - opening sentences
  - bullet points
- Distribute the main keyword evenly across headings and body content.
- Avoid keyword stuffing

5) Topical Authority & AI Models
- Cover the topic comprehensively
- Include multiple angles and practical insights
- MUST explicitly mention specific AI models by name (e.g., ChatGPT, Claude, Midjourney, Gemini, etc.) in the course content/tools sections.

---

OUTPUT REQUIREMENTS:

- Full SEO article
- Clear heading structure
- Well-formatted sections
- No emojis or icons
- No fluff
- Must feel like a real course landing page optimized for SEO and conversion
- Meta description (approximately 120 words, placed right below H1, main keyword MUST appear in the first line)
- DO NOT prefix headings with "H1:", "H2:", "H3:", etc. Just use standard markdown formatting (e.g., # Heading 1, ## Heading 2).
- A "References:" section at the end. List real URLs only (no fake links) used during analysis. If Google Search is enabled, include real URLs from SERP results.

---

FINAL RULE:

The article must:
- Be highly informative
- Be conversion-oriented
- Be easy to understand
- Provide real practical value
- Follow modern SEO (EEAT + helpful content)`;

      const systemInstruction = appMode === 'rewrite' ? rewriteInstruction : writeInstruction;

      const prompt = appMode === 'rewrite' 
        ? `Please rewrite the following article based on the provided details:\n\nMain Keyword: ${keyword}\nBrand Name: ${brandName || 'Not provided'}\nTarget Audience: ${finalAudience || 'General'}\nCountry / Language: ${language || 'Vietnamese'}\nReference URL: ${referenceUrl || 'None'}\n\nOriginal Article Content:\n${originalContent}`
        : `Please write a comprehensive SEO article from scratch based on the following details:\n\nMain Keyword: ${keyword}\nBrand Name: ${brandName || 'Not provided'}\nTarget Audience: ${finalAudience || 'General'}\nCountry / Language: ${language || 'Vietnamese'}\nReference URL: ${referenceUrl || 'None'}`;

      const finalContent = await generateWithFallback(
        targetModel,
        systemInstruction,
        prompt,
        apiKeys,
        (chunk) => {
          setResult((prev) => prev + chunk);
        },
        (fallbackModel) => {
          setFallbackMessage(`Switched to fallback model: ${fallbackModel.name}`);
          setActiveModel(fallbackModel);
        },
        enableSearch
      );

      setProgressStep(3);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred while generating the content.');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans relative overflow-hidden">
      {/* Background Geometric Pattern */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-10" 
           style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #1E3A8A 1px, transparent 0)', backgroundSize: '32px 32px' }}>
      </div>

      {/* Top Bar */}
      <header className="bg-gradient-to-r from-[#0F172A] to-[#1E3A8A] text-white sticky top-0 z-20 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-cyan-400/20 p-2 rounded-lg text-cyan-300 backdrop-blur-sm border border-cyan-400/30">
              <Sparkles size={20} />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">SEO Rewriter Pro</h1>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Mode Selector */}
            <div className="flex items-center bg-white/10 rounded-lg p-1 backdrop-blur-sm border border-white/10">
              {(['Fast', 'Quality', 'Auto'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${
                    mode === m 
                      ? 'bg-cyan-500 text-slate-900 shadow-sm' 
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {m === 'Fast' && <Zap size={14} className="inline mr-1 mb-0.5" />}
                  {m === 'Quality' && <ShieldCheck size={14} className="inline mr-1 mb-0.5" />}
                  {m === 'Auto' && <Activity size={14} className="inline mr-1 mb-0.5" />}
                  {m}
                </button>
              ))}
            </div>

            {/* Model Selector */}
            <div className="relative group">
              <select
                value={selectedModelId}
                onChange={(e) => setSelectedModelId(e.target.value)}
                className="appearance-none bg-white/10 border border-white/20 text-white text-sm rounded-lg pl-3 pr-8 py-1.5 outline-none focus:ring-2 focus:ring-cyan-400 backdrop-blur-sm cursor-pointer"
              >
                <option value="auto" className="text-slate-900">Auto-Select (Recommended)</option>
                <optgroup label="Gemini" className="text-slate-900">
                  {AVAILABLE_MODELS.filter(m => m.provider === 'Gemini').map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </optgroup>
                <optgroup label="OpenAI" className="text-slate-900">
                  {AVAILABLE_MODELS.filter(m => m.provider === 'OpenAI').map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </optgroup>
                <optgroup label="OpenRouter" className="text-slate-900">
                  {AVAILABLE_MODELS.filter(m => m.provider === 'OpenRouter').map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </optgroup>
              </select>
              <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
            </div>

            {/* Settings Button */}
            <button 
              onClick={() => setShowSettings(true)}
              className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors border border-transparent hover:border-white/20"
              title="API Keys & Settings"
            >
              <Settings size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Input Form */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-slate-200/60 p-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-400 to-blue-600"></div>
              
              {/* Mode Switcher */}
              <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
                <button
                  type="button"
                  onClick={() => setAppMode('rewrite')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all ${appMode === 'rewrite' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Edit size={16} />
                  Rewrite / Audit
                </button>
                <button
                  type="button"
                  onClick={() => setAppMode('write')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all ${appMode === 'write' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <PenTool size={16} />
                  Write with Keyword
                </button>
              </div>

              <h2 className="text-lg font-bold mb-6 flex items-center gap-2 text-[#0F172A]">
                <FileText size={20} className="text-blue-600" />
                {appMode === 'rewrite' ? 'Article Details' : 'Topic Details'}
              </h2>
              
              <form onSubmit={handleGenerate} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Main Keyword <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                        placeholder="e.g., best running shoes"
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Brand Name
                    </label>
                    <div className="relative">
                      <Briefcase size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={brandName}
                        onChange={(e) => setBrandName(e.target.value)}
                        placeholder="e.g., TechBlog"
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Target Audience
                    </label>
                    <select
                      value={audienceSelect}
                      onChange={(e) => setAudienceSelect(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm appearance-none"
                    >
                      <option value="Beginners">Beginners</option>
                      <option value="Office workers">Office workers</option>
                      <option value="Students">Students</option>
                      <option value="Business owners">Business owners</option>
                      <option value="Marketers">Marketers</option>
                      <option value="Developers">Developers</option>
                      <option value="Custom">Custom</option>
                    </select>
                    {audienceSelect === 'Custom' && (
                      <input
                        type="text"
                        value={customAudience}
                        onChange={(e) => setCustomAudience(e.target.value)}
                        placeholder="Enter custom audience..."
                        className="w-full mt-2 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Country / Language
                    </label>
                    <div className="relative">
                      <Globe size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        placeholder="e.g., Vietnam / Vietnamese"
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Reference URL (Optional)
                  </label>
                  <div className="relative">
                    <Link size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="url"
                      value={referenceUrl}
                      onChange={(e) => setReferenceUrl(e.target.value)}
                      placeholder="e.g., https://example.com/article-to-learn-from"
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                    />
                  </div>
                </div>

                {appMode === 'rewrite' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Original Article Content <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={originalContent}
                      onChange={(e) => setOriginalContent(e.target.value)}
                      placeholder="Paste the original article content here..."
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none h-48 font-mono text-sm leading-relaxed"
                      required={appMode === 'rewrite'}
                    />
                  </div>
                )}

                <div className="flex items-center gap-3 p-3.5 bg-blue-50/50 rounded-xl border border-blue-100">
                  <input
                    type="checkbox"
                    id="enableSearch"
                    checked={enableSearch}
                    onChange={(e) => setEnableSearch(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-blue-300 focus:ring-blue-500 shrink-0"
                  />
                  <div className="flex flex-col">
                    <label htmlFor="enableSearch" className="text-sm font-semibold text-blue-900 cursor-pointer select-none">
                      Enable Top Results Enrichment (Google Search)
                    </label>
                    <span className="text-xs text-blue-700/70 mt-0.5">
                      AI will fetch top SERP results to expand and detail the content.
                    </span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 ml-auto bg-blue-100 px-2 py-1 rounded-md whitespace-nowrap hidden sm:block">
                    Deep Research
                  </span>
                </div>

                {error && (
                  <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-red-700 text-sm font-medium">
                    <AlertCircle size={18} className="mt-0.5 flex-shrink-0 text-red-500" />
                    <p>{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isGenerating}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:translate-y-0"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      {appMode === 'rewrite' ? 'Rewriting & Optimizing...' : 'Generating Article...'}
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} />
                      {appMode === 'rewrite' ? 'Generate SEO Content' : 'Write Article'}
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Output */}
          <div className="lg:col-span-7">
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-slate-200/60 h-full min-h-[600px] flex flex-col relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-400 to-blue-600"></div>
              
              <div className="p-4 border-b border-slate-200/60 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <h2 className="text-sm font-bold text-[#0F172A] flex items-center gap-2 uppercase tracking-wider">
                    <FileText size={16} className="text-blue-600" />
                    Optimized Output
                  </h2>
                  {activeModel && (
                    <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded-md uppercase tracking-wider border border-blue-200">
                      {activeModel.name}
                    </span>
                  )}
                </div>
                {result && (
                  <button
                    onClick={copyToClipboard}
                    className="text-xs flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-blue-300 transition-all text-slate-700 font-semibold shadow-sm"
                  >
                    {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} className="text-blue-600" />}
                    {copied ? 'Copied!' : 'Copy Content'}
                  </button>
                )}
              </div>
              
              {fallbackMessage && (
                <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 text-amber-700 text-xs font-medium flex items-center gap-2">
                  <AlertCircle size={14} />
                  {fallbackMessage}
                </div>
              )}

              <div className="p-6 flex-1 overflow-auto">
                {!result && !isGenerating ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                    <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center border border-blue-100 shadow-inner">
                      <Sparkles size={32} className="text-blue-300" />
                    </div>
                    <p className="text-sm text-center max-w-sm font-medium text-slate-500">
                      {appMode === 'rewrite' 
                        ? 'Fill in the article details and click "Generate SEO Content" to see the optimized result here.'
                        : 'Enter your keyword and details, then click "Write Article" to generate a brand new SEO-optimized post.'}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col h-full">
                    {isGenerating && (
                      <div className="mb-6 p-4 bg-white border border-blue-100 rounded-xl shadow-sm shrink-0">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tiến trình tạo nội dung</span>
                          <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md">{Math.round(((progressStep + 1) / 4) * 100)}%</span>
                        </div>
                        <div className="flex gap-2">
                          {["Khởi tạo AI", "Phân tích SEO", appMode === 'rewrite' ? "Đang viết lại" : "Đang viết bài", "Hoàn tất"].map((step, idx) => {
                            const isActive = idx === progressStep;
                            const isCompleted = idx < progressStep;
                            return (
                              <div key={idx} className="flex-1 flex flex-col gap-2 relative">
                                <div className={`h-1.5 rounded-full transition-all duration-500 ${isCompleted || isActive ? 'bg-blue-500' : 'bg-slate-100'} ${isActive ? 'animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]' : ''}`}></div>
                                <span className={`text-[10px] font-bold uppercase tracking-wider transition-colors duration-300 ${isCompleted || isActive ? 'text-blue-700' : 'text-slate-400'}`}>
                                  {step}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <div className="prose prose-slate prose-blue max-w-none prose-headings:font-bold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-a:text-blue-600 flex-1">
                      <Markdown>{result}</Markdown>
                      {isGenerating && (
                        <span className="inline-block w-2.5 h-5 ml-1 bg-blue-500 animate-pulse rounded-sm align-middle" />
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Settings size={18} className="text-blue-600" />
                API Configuration
              </h3>
              <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600">
                &times;
              </button>
            </div>
            <div className="p-6 space-y-5">
              <p className="text-sm text-slate-500 mb-4">
                Enter your API keys to use different AI models. Keys are stored locally in your browser.
              </p>
              
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Gemini API Key
                </label>
                <input
                  type="password"
                  value={apiKeys.gemini}
                  onChange={(e) => setApiKeys({...apiKeys, gemini: e.target.value})}
                  placeholder="AIzaSy..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  OpenAI API Key
                </label>
                <input
                  type="password"
                  value={apiKeys.openai}
                  onChange={(e) => setApiKeys({...apiKeys, openai: e.target.value})}
                  placeholder="sk-..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  OpenRouter API Key
                </label>
                <input
                  type="password"
                  value={apiKeys.openrouter}
                  onChange={(e) => setApiKeys({...apiKeys, openrouter: e.target.value})}
                  placeholder="sk-or-v1-..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono"
                />
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button 
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleSaveKeys(apiKeys)}
                className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
              >
                Save Keys
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

