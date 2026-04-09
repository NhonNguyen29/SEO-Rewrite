import React, { useState, useEffect, useRef } from 'react';
import Markdown from 'react-markdown';
import { Sparkles, Loader2, Search, FileText, Globe, AlertCircle, Copy, Check, Briefcase, Settings, ChevronDown, Zap, ShieldCheck, Activity, PenTool, Edit, Link, History, Users, Plus, Trash2, LogIn, User } from 'lucide-react';
import { AVAILABLE_MODELS, determineBestModel, generateWithFallback, APIKeys, getStoredKeys, saveStoredKeys, AIModel, scoreSEO, chatWithBot, fetchTopUrls } from './services/aiService';
import { loggingService } from './services/loggingService';
import { HistoryModal, HistoryItem } from './components/HistoryModal';
import { SEOScoreCard, SEOScoreData } from './components/SEOScoreCard';
import { AIChatBot } from './components/AIChatBot';
import { UserProfileModal } from './components/UserProfileModal';
import { auth, signInWithGoogle } from './firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';

export interface AutoKeyword {
  id: string;
  main: string;
  secondary: string;
  isAnalyzing?: boolean;
}

export default function App() {
  const [keyword, setKeyword] = useState('');
  const [secondaryKeywords, setSecondaryKeywords] = useState('');
  const [autoKeywords, setAutoKeywords] = useState<AutoKeyword[]>([{ id: '1', main: '', secondary: '' }]);
  
  const [brandName, setBrandName] = useState('');
  const [savedBrands, setSavedBrands] = useState<string[]>([]);
  
  const [audienceSelect, setAudienceSelect] = useState('Beginners');
  const [savedAudiences, setSavedAudiences] = useState<string[]>(['Beginners', 'Professionals', 'Students']);
  const [customAudience, setCustomAudience] = useState('');
  
  const [language, setLanguage] = useState('Vietnamese');
  const [referenceUrls, setReferenceUrls] = useState('');
  const [isFetchingUrls, setIsFetchingUrls] = useState(false);
  const [originalContent, setOriginalContent] = useState('');
  const [enableSearch, setEnableSearch] = useState(false);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [appMode, setAppMode] = useState<'rewrite' | 'write' | 'autoWrite'>('rewrite');
  const [isAutoWriting, setIsAutoWriting] = useState(false);
  const [autoWriteProgress, setAutoWriteProgress] = useState({ current: 0, total: 0 });

  // New State for Multi-Model & Mode
  const [mode, setMode] = useState<'Fast' | 'Quality' | 'Auto'>('Auto');
  const [selectedModelId, setSelectedModelId] = useState<string>('auto'); // 'auto' means let the system decide based on mode
  const [activeModel, setActiveModel] = useState<AIModel | null>(null);
  const [fallbackMessage, setFallbackMessage] = useState('');

  // API Keys State
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeys, setApiKeys] = useState<APIKeys>({ gemini: '', openai: '', openrouter: '' });

  // History State
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null);
  const [articleVersions, setArticleVersions] = useState<{timestamp: number, content: string}[]>([]);

  // Update history when result changes
  useEffect(() => {
    if (currentHistoryId && result) {
      const timeoutId = setTimeout(() => {
        setHistory(prev => {
          const newHistory = prev.map(h => h.id === currentHistoryId ? { ...h, content: result } : h);
          localStorage.setItem('seo_history', JSON.stringify(newHistory));
          return newHistory;
        });
      }, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [result, currentHistoryId]);

  // SEO Score State
  const [seoScore, setSeoScore] = useState<SEOScoreData | null>(null);
  const [isScoring, setIsScoring] = useState(false);

  // Chat Bot State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{role: 'user'|'assistant', content: string}[]>([]);
  const [isChatTyping, setIsChatTyping] = useState(false);
  const [isAnalyzingKeywords, setIsAnalyzingKeywords] = useState(false);
  const [isAnalyzingAudience, setIsAnalyzingAudience] = useState(false);

  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setApiKeys(getStoredKeys());
    const savedHistory = localStorage.getItem('seo_history');
    if (savedHistory) {
      try { setHistory(JSON.parse(savedHistory)); } catch (e) {}
    }
    const b = localStorage.getItem('seo_brands');
    if (b) { try { setSavedBrands(JSON.parse(b)); } catch(e){} }
    const a = localStorage.getItem('seo_audiences');
    if (a) { try { setSavedAudiences(JSON.parse(a)); } catch(e){} }
  }, []);

  const saveBrands = (brands: string[]) => {
    setSavedBrands(brands);
    localStorage.setItem('seo_brands', JSON.stringify(brands));
  };

  const saveAudiences = (audiences: string[]) => {
    setSavedAudiences(audiences);
    localStorage.setItem('seo_audiences', JSON.stringify(audiences));
  };

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

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      const errorCode = error.code || '';
      const errorMessage = error.message || '';
      
      if (errorCode === 'auth/popup-closed-by-user' || errorMessage.includes('popup-closed-by-user')) {
        // User closed the popup intentionally, ignore
        return;
      } else if (errorCode === 'auth/network-request-failed' || errorMessage.includes('network-request-failed')) {
        setError('Lỗi kết nối mạng hoặc cửa sổ đăng nhập bị đóng đột ngột. Vui lòng thử lại.');
      } else {
        setError(errorMessage || 'Đăng nhập thất bại. Vui lòng thử lại.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleAutoFetchUrls = async () => {
    const targetKeyword = appMode === 'autoWrite' ? autoKeywords[0]?.main : keyword;
    if (!targetKeyword) {
      setError('Please enter a Main Keyword first.');
      return;
    }
    setIsFetchingUrls(true);
    try {
      let targetModel = AVAILABLE_MODELS.find(m => m.id === selectedModelId) || AVAILABLE_MODELS[0];
      const result = await fetchTopUrls(targetKeyword, targetModel, apiKeys);
      setReferenceUrls(result);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch URLs.');
    } finally {
      setIsFetchingUrls(false);
    }
  };

  const handleAnalyzeKeywords = async () => {
    if (!keyword) {
      setError('Please enter a Main Keyword first.');
      return;
    }
    setIsAnalyzingKeywords(true);
    try {
      let targetModel: AIModel;
      if (selectedModelId === 'auto') {
        targetModel = determineBestModel(mode, 'write');
      } else {
        targetModel = AVAILABLE_MODELS.find(m => m.id === selectedModelId) || AVAILABLE_MODELS[0];
      }
      const { analyzeSecondaryKeywords } = await import('./services/aiService');
      const result = await analyzeSecondaryKeywords(keyword, targetModel, apiKeys);
      setSecondaryKeywords(result);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze keywords.');
    } finally {
      setIsAnalyzingKeywords(false);
    }
  };

  const handleAnalyzeAudience = async () => {
    if (!keyword) {
      setError('Please enter a Main Keyword first to analyze target audience.');
      return;
    }
    setIsAnalyzingAudience(true);
    try {
      let targetModel: AIModel;
      if (selectedModelId === 'auto') {
        targetModel = determineBestModel(mode, 'write');
      } else {
        targetModel = AVAILABLE_MODELS.find(m => m.id === selectedModelId) || AVAILABLE_MODELS[0];
      }
      const { analyzeTargetAudience } = await import('./services/aiService');
      const result = await analyzeTargetAudience(keyword, targetModel, apiKeys);
      setAudienceSelect(result);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze target audience.');
    } finally {
      setIsAnalyzingAudience(false);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (appMode !== 'autoWrite' && !keyword) {
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

    if (appMode === 'autoWrite') {
      const validKeywords = autoKeywords.filter(k => k.main.trim() !== '');
      if (validKeywords.length === 0) {
        setError('Please enter at least one keyword.');
        setIsGenerating(false);
        return;
      }
      setIsAutoWriting(true);
      setAutoWriteProgress({ current: 0, total: validKeywords.length });
      
      let currentHistory = [...history];

      try {
        let targetModel: AIModel;
        if (selectedModelId === 'auto') {
          targetModel = determineBestModel(mode, 'write');
        } else {
          targetModel = AVAILABLE_MODELS.find(m => m.id === selectedModelId) || AVAILABLE_MODELS[0];
        }
        setActiveModel(targetModel);

        for (let i = 0; i < validKeywords.length; i++) {
          const currentAk = validKeywords[i];
          setAutoWriteProgress({ current: i + 1, total: validKeywords.length });
          setResult(''); // Clear result for the new keyword
          
          let finalSecondary = currentAk.secondary;
          if (!finalSecondary) {
             const { analyzeSecondaryKeywords } = await import('./services/aiService');
             try {
               finalSecondary = await analyzeSecondaryKeywords(currentAk.main, targetModel, apiKeys);
               // Update state so user sees it
               setAutoKeywords(prev => prev.map(k => k.id === currentAk.id ? { ...k, secondary: finalSecondary } : k));
             } catch (e) {
               console.error("Auto analyze failed", e);
             }
          }

          let currentFinalAudience = finalAudience;
          let currentReferenceUrls = referenceUrls;

          if (enableSearch) {
             const { analyzeTargetAudience, fetchTopUrls } = await import('./services/aiService');
             try {
               currentFinalAudience = await analyzeTargetAudience(currentAk.main, targetModel, apiKeys);
               currentReferenceUrls = await fetchTopUrls(currentAk.main, targetModel, apiKeys);
             } catch (e) {
               console.error("Deep research failed", e);
             }
          }
          
          const systemInstruction = `SEO CONTENT ENGINE 2026 (MASTER PROMPT)
Role: You are a Senior SEO Content Strategist and Expert Copywriter (2026 Standards). Your expertise includes Google SGE (Search Generative Experience), AI Overview optimization, EEAT 2.0, and Semantic SEO.

Core Objective: Generate a high-quality, comprehensive educational course article fully optimized for modern SEO performance.

📋 MANDATORY WRITING GUIDELINES (2026 STANDARDS)
1. AI Overview & SGE Optimization
The "Direct Answer" Rule: Immediately after the H1 and under each H2 heading, provide a concise, factual "Direct Answer" (40-60 words). These snippets must be clear and authoritative to capture Google’s AI Overview boxes.

2. Information Gain (Unique Value)
The "Pro-Tip" Requirement: You MUST integrate 1-2 unique "Expert Insights," "Practical Case Studies," or "Pro-tips" throughout the article. This ensures Google sees the content as "Value Added."

3. Entity-Based & Semantic SEO
Topical Authority: Instead of keyword stuffing, use a rich "Entity Map." Include LSI (Latent Semantic Indexing) keywords and related concepts naturally to prove deep expertise in the subject matter.
Natural Distribution: Distribute the Primary Keyword naturally (1-1.5% density). Priority is given to user intent and readability.

4. EEAT & Experience-Driven Language
The "Practitioner" Voice: Use first-person or experience-based phrases (e.g., "Theo đánh giá của Trung Tâm...", "Dựa trên quan sát của Trung Tâm...", "Một sai lầm phổ biến mà Trung Tâm nhận thấy..."). Avoid generic AI-sounding filler.

5. Modern UX & Formatting
Hierarchy: Use a logical H1 -> H2 -> H3 structure.
Scanability: Use Bold text for key takeaways, Bullet points for lists, and Tables for comparisons to improve the user's "Time on Page."

SEARCH ENGINE & INTENT RULES:
- Search Engine: Google.com.vn
- Device Type: Mobile
- All SERP analysis MUST reflect Vietnamese mobile search results only.
- Automatically detect the search intent based on the main keyword. If Google Search is enabled, you MUST use your search capabilities to query Google.com.vn for the top 10 articles related to the keyword to validate and refine this intent.
- All outputs must be in the requested language (default: Vietnamese).

IMPORTANT:
- Do NOT focus on keyword research
- Focus on writing style, structure, and content depth
- The article must feel like a high-converting SEO landing page + blog hybrid
- IF Google Search is enabled, you MUST query Google.com.vn for the top 10 search results for the main keyword. Extract valuable insights, cover all necessary subtopics, answer user intent fully, and ensure your article is superior to the top-ranking pages.

BRAND NAME, TARGET AUDIENCE & PROMOTION:
- Use the provided "Brand Name" to align the tone and positioning of the content.
- Brand Elevation: Subtly but effectively elevate the "Brand Name" as the premier authority, expert, and top-tier solution related to the main keyword.
- Weave the brand name naturally into the narrative, especially in the introduction, practical applications, and CTA, without sounding overly promotional (spammy).
- Adapt the depth and tone specifically to the provided "Target Audience". Speak directly to the audience's pain points, needs, and level of understanding.

---

WRITING STRUCTURE (MANDATORY):

1) Introduction
- Start with a trend or problem (technology, AI, market change)
- Explain why the topic is important
- Naturally introduce the solution (course/training)

---

2) Đối Tượng Học Viên Tham Gia Khóa Học [Main Keyword]
- Use H2 heading
- Clearly define who the course is for (e.g., working professionals, adults looking to upskill).

---

3) Lý Do Bạn Nên Tham Gia Khóa Học [Main Keyword] Tại [Brand Name]
- Use H2 heading
- List 3-5 unique selling points (USPs) of the brand/course.
- Focus on practical outcomes and career advancement.

---

4) Course Content / Roadmap (Chương trình học)
- Use H2 heading
- Break down the content into logical chapters or modules (e.g., "Chương 1:", "Chương 2:").
- Explain what the student will learn in each module.

---

5) Các Câu Hỏi Thường Gặp Về Khóa Học [Main Keyword]
- Use H2 heading: "## Các Câu Hỏi Thường Gặp Về Khóa Học [Main Keyword]"
- Answer common questions (PAA) to build trust and improve SEO.

---

6) Conversion Section (CTA)
- Encourage action (enroll, register, contact)
- Reinforce value and urgency
- Highlight experience, credibility, or trust

---

WRITING STYLE:

- Tone: Professional, friendly, highly engaging, and specifically appealing to adults and working professionals (lứa tuổi trưởng thành và người đi làm).
- PRONOUN USAGE: Do NOT use "Chúng tôi" (We). Always use "Trung Tâm" (The Center) or the provided [Brand Name] when referring to the organization/brand.
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

4) Natural Keyword Distribution & Formatting
- Repeat important phrases naturally across:
  - headings
  - opening sentences
  - bullet points
- Distribute the main keyword evenly across headings and body content.
- Avoid keyword stuffing
- BOLDING: You MUST bold the main keyword and important secondary keywords (which you should auto-analyze and suggest) naturally throughout the article to improve scannability and SEO.

5) Topical Authority & AI Models
- Cover the topic comprehensively
- Include multiple angles and practical insights
- MUST explicitly mention specific AI models by name (e.g., ChatGPT, Claude, Midjourney, Gemini, etc.) in the course content/tools sections.

6) Brand Integration
- Position the brand as the logical answer or trusted guide for the user's search intent.
- Highlight the brand's unique value proposition subtly throughout the text.

---

OUTPUT REQUIREMENTS:

- Full SEO article
- Clear heading structure
- Well-formatted sections
- No emojis or icons
- No fluff
- Must feel like a real course landing page optimized for SEO and conversion
- Meta description (approximately 120 words, placed right below H1, main keyword MUST appear in the first line). Make it highly authentic and engaging by using questions that speak directly to the user's pain points (e.g., "Bạn đang mong muốn...?", "Bạn đang tìm kiếm...?").
- DO NOT prefix headings with "H1:", "H2:", "H3:", etc. Just use standard markdown formatting (e.g., # Heading 1, ## Heading 2).
- A "References:" section at the end. List real URLs only (no fake links) used during analysis. If Google Search is enabled, include real URLs from SERP results.
- A "Tags" section at the very end containing about 10 tags. DO NOT use the # symbol. Use regular Vietnamese tags with accents, separated by commas (e.g., Từ Khóa Chính, Từ Khóa Phụ). Use the main keyword and auto-suggested secondary keywords.

---

FINAL RULE:

The article must:
- Be highly informative
- Be conversion-oriented
- Be easy to understand
- Provide real practical value
- Follow modern SEO (EEAT + helpful content)`;
          const prompt = `Please write a comprehensive SEO article from scratch based on the following details:\n\nMain Keyword: ${currentAk.main}\nSecondary Keywords: ${finalSecondary || 'None'}\nBrand Name: ${brandName || 'Not provided'}\nTarget Audience: ${currentFinalAudience || 'General'}\nCountry / Language: ${language || 'Vietnamese'}\nReference URLs:\n${currentReferenceUrls || 'None'}`;
          
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

          // Save to History
          const newHistoryItem: HistoryItem = {
            id: Date.now().toString() + i,
            date: new Date().toISOString(),
            keyword: currentAk.main,
            content: finalContent
          };
          currentHistory = [newHistoryItem, ...currentHistory].slice(0, 50);
          setHistory(currentHistory);
          localStorage.setItem('seo_history', JSON.stringify(currentHistory));
          setCurrentHistoryId(newHistoryItem.id);
          setArticleVersions([{ timestamp: Date.now(), content: finalContent }]);

          // Trigger SEO Scoring
          setIsScoring(true);
          try {
            const score = await scoreSEO(finalContent, currentAk.main, activeModel || targetModel, apiKeys);
            if (score) setSeoScore(score);
          } catch (e) {
            console.error("Scoring failed", e);
          } finally {
            setIsScoring(false);
          }
        }
        setProgressStep(3);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'An error occurred while generating the content.');
      } finally {
        setIsGenerating(false);
        setIsAutoWriting(false);
      }
      return;
    }

    try {
      let targetModel: AIModel;
      if (selectedModelId === 'auto') {
        targetModel = determineBestModel(mode, 'rewrite');
      } else {
        targetModel = AVAILABLE_MODELS.find(m => m.id === selectedModelId) || AVAILABLE_MODELS[0];
      }

      setActiveModel(targetModel);

      const rewriteInstruction = `SEO CONTENT ENGINE 2026 (MASTER PROMPT)
Role: You are a Senior SEO Content Strategist and Expert Copywriter (2026 Standards). Your expertise includes Google SGE (Search Generative Experience), AI Overview optimization, EEAT 2.0, and Semantic SEO.

Core Objective: Analyze the provided Reference Content/URL and generate a high-quality article that mirrors the original style, structure, and tone (95% similarity) while fully optimizing it for modern SEO performance.

📋 MANDATORY WRITING GUIDELINES (2026 STANDARDS)
1. AI Overview & SGE Optimization
The "Direct Answer" Rule: Immediately after the H1 and under each H2 heading, provide a concise, factual "Direct Answer" (40-60 words). These snippets must be clear and authoritative to capture Google’s AI Overview boxes.

2. Information Gain (Unique Value)
The "Pro-Tip" Requirement: Do not just rewrite the source. You MUST integrate 1-2 unique "Expert Insights," "Practical Case Studies," or "Pro-tips" that are NOT present in the reference link. This ensures Google sees the content as "Value Added."

3. Entity-Based & Semantic SEO
Topical Authority: Instead of keyword stuffing, use a rich "Entity Map." Include LSI (Latent Semantic Indexing) keywords and related concepts naturally to prove deep expertise in the subject matter.
Natural Distribution: Distribute the Primary Keyword naturally (1-1.5% density). Priority is given to user intent and readability.

4. EEAT & Experience-Driven Language
The "Practitioner" Voice: Use first-person or experience-based phrases (e.g., "Theo đánh giá của Trung Tâm...", "Dựa trên quan sát của Trung Tâm...", "Một sai lầm phổ biến mà Trung Tâm nhận thấy..."). Avoid generic AI-sounding filler.

5. Modern UX & Formatting
Hierarchy: Use a logical H1 -> H2 -> H3 structure.
Scanability: Use Bold text for key takeaways, Bullet points for lists, and Tables for comparisons to improve the user's "Time on Page."

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
- IF Google Search is enabled, you MUST query Google.com.vn for the top 10 search results for the main keyword. Extract valuable insights, missing details, and modern perspectives from these top results to ENRICH and EXPAND the original content.
- You are ALLOWED to add new sections and expand the scope if they provide significant value to the Target Audience based on top SERP competitors.
- Ensure the final content is comprehensive, detailed, and superior to the top-ranking pages.

TARGET AUDIENCE ADAPTATION (CRITICAL):
- Tone: Authentic (chân thật), friendly (thân thiện), highly engaging, and specifically appealing to adults and working professionals (lứa tuổi trưởng thành và người đi làm).
- Depth: Provide detailed explanations, real-world examples, and actionable advice specifically tailored to the selected Target Audience.
- Speak directly to the audience's pain points, needs, and level of understanding.

NO FABRICATION POLICY (STRICT):
- You MUST NOT fabricate any information.
- Only use verified knowledge, realistic SEO practices, and data inferred from SERP (if search is enabled).
- If information is uncertain or not available, DO NOT guess. Skip or generalize carefully without making false claims.

BRAND NAME, EEAT & PROMOTION:
- Use the provided "Brand Name" to align the tone and positioning of the content.
- Brand Elevation: Subtly but effectively elevate the "Brand Name" as the premier authority, expert, and top-tier solution related to the main keyword.
- Weave the brand name naturally into the narrative, especially in the introduction, practical applications, and CTA, without sounding overly promotional (spammy).
- Use the brand name to support EEAT signals (authority, trust, credibility).

WRITING REQUIREMENTS:
- Follow SEO best practices (2026)
- Strong alignment with search intent
- Clear, logical structure (H1 → H2 → H3 → bullet points when needed)
- For course content, synthesize insights from top competitor websites (if search is enabled) to create a highly professional and comprehensive roadmap broken down into specific chapters (e.g., "Chương 1:", "Chương 2:").
- Natural keyword distribution (no keyword stuffing)
- Distribute the main keyword evenly across headings and body content.
- BOLDING: You MUST bold the main keyword and important secondary keywords (which you should auto-analyze and suggest) naturally throughout the article to improve scannability and SEO.
- Explicitly mention specific AI models by name (e.g., ChatGPT, Claude, Midjourney, Gemini, etc.) when discussing course content, tools, or applications.
- Include:
  - Engaging introduction (hook + intent match)
  - Well-structured body content
  - "Đối Tượng Học Viên Tham Gia Khóa Học [Main Keyword]" section
  - "Lý Do Bạn Nên Tham Gia Khóa Học [Main Keyword] Tại [Brand Name]" section
  - Actionable insights
  - Real value for beginners and practitioners
  - Conversion elements (CTA where appropriate)
  - "## Các Câu Hỏi Thường Gặp Về Khóa Học [Main Keyword]" section for SEO
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
- Meta description (approximately 120 words, placed right below H1, main keyword MUST appear in the first line). Make it highly authentic and engaging by using questions that speak directly to the user's pain points (e.g., "Bạn đang mong muốn...?", "Bạn đang tìm kiếm...?").
- Full article content (well-structured with headings)
- A "References:" section at the end. List real URLs only (no fake links) used during analysis. If Google Search is enabled, include real URLs from SERP results.
- A "Tags" section at the very end containing about 10 tags. DO NOT use the # symbol. Use regular Vietnamese tags with accents, separated by commas (e.g., Từ Khóa Chính, Từ Khóa Phụ). Use the main keyword and auto-suggested secondary keywords.

WRITING STYLE:
- Tone: Professional, friendly, highly engaging, and specifically appealing to adults and working professionals (lứa tuổi trưởng thành và người đi làm).
- PRONOUN USAGE: Do NOT use "Chúng tôi" (We). Always use "Trung Tâm" (The Center) or the provided [Brand Name] when referring to the organization/brand.
- Clear and easy to understand
- Focused on real value
- Suitable for beginners but still authoritative

FINAL RULE:
Your output must be better, clearer, more complete, and more SEO-optimized than the original content in every aspect. Make it highly authentic, friendly, and deeply detailed for the target audience.`;

      const writeInstruction = `SEO CONTENT ENGINE 2026 (MASTER PROMPT)
Role: You are a Senior SEO Content Strategist and Expert Copywriter (2026 Standards). Your expertise includes Google SGE (Search Generative Experience), AI Overview optimization, EEAT 2.0, and Semantic SEO.

Core Objective: Generate a high-quality, comprehensive educational course article fully optimized for modern SEO performance.

📋 MANDATORY WRITING GUIDELINES (2026 STANDARDS)
1. AI Overview & SGE Optimization
The "Direct Answer" Rule: Immediately after the H1 and under each H2 heading, provide a concise, factual "Direct Answer" (40-60 words). These snippets must be clear and authoritative to capture Google’s AI Overview boxes.

2. Information Gain (Unique Value)
The "Pro-Tip" Requirement: You MUST integrate 1-2 unique "Expert Insights," "Practical Case Studies," or "Pro-tips" throughout the article. This ensures Google sees the content as "Value Added."

3. Entity-Based & Semantic SEO
Topical Authority: Instead of keyword stuffing, use a rich "Entity Map." Include LSI (Latent Semantic Indexing) keywords and related concepts naturally to prove deep expertise in the subject matter.
Natural Distribution: Distribute the Primary Keyword naturally (1-1.5% density). Priority is given to user intent and readability.

4. EEAT & Experience-Driven Language
The "Practitioner" Voice: Use first-person or experience-based phrases (e.g., "Theo đánh giá của Trung Tâm...", "Dựa trên quan sát của Trung Tâm...", "Một sai lầm phổ biến mà Trung Tâm nhận thấy..."). Avoid generic AI-sounding filler.

5. Modern UX & Formatting
Hierarchy: Use a logical H1 -> H2 -> H3 structure.
Scanability: Use Bold text for key takeaways, Bullet points for lists, and Tables for comparisons to improve the user's "Time on Page."

SEARCH ENGINE & INTENT RULES:
- Search Engine: Google.com.vn
- Device Type: Mobile
- All SERP analysis MUST reflect Vietnamese mobile search results only.
- Automatically detect the search intent based on the main keyword. If Google Search is enabled, you MUST use your search capabilities to query Google.com.vn for the top 10 articles related to the keyword to validate and refine this intent.
- All outputs must be in the requested language (default: Vietnamese).

IMPORTANT:
- Do NOT focus on keyword research
- Focus on writing style, structure, and content depth
- The article must feel like a high-converting SEO landing page + blog hybrid
- IF Google Search is enabled, you MUST query Google.com.vn for the top 10 search results for the main keyword. Extract valuable insights, cover all necessary subtopics, answer user intent fully, and ensure your article is superior to the top-ranking pages.

BRAND NAME, TARGET AUDIENCE & PROMOTION:
- Use the provided "Brand Name" to align the tone and positioning of the content.
- Brand Elevation: Subtly but effectively elevate the "Brand Name" as the premier authority, expert, and top-tier solution related to the main keyword.
- Weave the brand name naturally into the narrative, especially in the introduction, practical applications, and CTA, without sounding overly promotional (spammy).
- Adapt the depth and tone specifically to the provided "Target Audience". Speak directly to the audience's pain points, needs, and level of understanding.

---

WRITING STRUCTURE (MANDATORY):

1) Introduction
- Start with a trend or problem (technology, AI, market change)
- Explain why the topic is important
- Naturally introduce the solution (course/training)

---

2) Đối Tượng Học Viên Tham Gia Khóa Học [Main Keyword]
- Use H2 heading
- Clearly define who the course is for (e.g., working professionals, adults looking to upskill).

---

3) Lý Do Bạn Nên Tham Gia Khóa Học [Main Keyword] Tại [Brand Name]
- Use H2 heading
- List 3-5 unique selling points (USPs) of the brand/course.
- Focus on practical outcomes and career advancement.

---

4) Course Content / Roadmap (Chương trình học)
- Use H2 heading
- Break down the content into logical chapters or modules (e.g., "Chương 1:", "Chương 2:").
- Explain what the student will learn in each module.

---

5) Các Câu Hỏi Thường Gặp Về Khóa Học [Main Keyword]
- Use H2 heading: "## Các Câu Hỏi Thường Gặp Về Khóa Học [Main Keyword]"
- Answer common questions (PAA) to build trust and improve SEO.

---

6) Conversion Section (CTA)
- Encourage action (enroll, register, contact)
- Reinforce value and urgency
- Highlight experience, credibility, or trust

---

WRITING STYLE:

- Tone: Professional, friendly, highly engaging, and specifically appealing to adults and working professionals (lứa tuổi trưởng thành và người đi làm).
- PRONOUN USAGE: Do NOT use "Chúng tôi" (We). Always use "Trung Tâm" (The Center) or the provided [Brand Name] when referring to the organization/brand.
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

4) Natural Keyword Distribution & Formatting
- Repeat important phrases naturally across:
  - headings
  - opening sentences
  - bullet points
- Distribute the main keyword evenly across headings and body content.
- Avoid keyword stuffing
- BOLDING: You MUST bold the main keyword and important secondary keywords (which you should auto-analyze and suggest) naturally throughout the article to improve scannability and SEO.

5) Topical Authority & AI Models
- Cover the topic comprehensively
- Include multiple angles and practical insights
- MUST explicitly mention specific AI models by name (e.g., ChatGPT, Claude, Midjourney, Gemini, etc.) in the course content/tools sections.

6) Brand Integration
- Position the brand as the logical answer or trusted guide for the user's search intent.
- Highlight the brand's unique value proposition subtly throughout the text.

---

OUTPUT REQUIREMENTS:

- Full SEO article
- Clear heading structure
- Well-formatted sections
- No emojis or icons
- No fluff
- Must feel like a real course landing page optimized for SEO and conversion
- Meta description (approximately 120 words, placed right below H1, main keyword MUST appear in the first line). Make it highly authentic and engaging by using questions that speak directly to the user's pain points (e.g., "Bạn đang mong muốn...?", "Bạn đang tìm kiếm...?").
- DO NOT prefix headings with "H1:", "H2:", "H3:", etc. Just use standard markdown formatting (e.g., # Heading 1, ## Heading 2).
- A "References:" section at the end. List real URLs only (no fake links) used during analysis. If Google Search is enabled, include real URLs from SERP results.
- A "Tags" section at the very end containing about 10 tags. DO NOT use the # symbol. Use regular Vietnamese tags with accents, separated by commas (e.g., Từ Khóa Chính, Từ Khóa Phụ). Use the main keyword and auto-suggested secondary keywords.

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
        ? `Please rewrite the following article based on the provided details:\n\nMain Keyword: ${keyword}\nSecondary Keywords: ${secondaryKeywords || 'None'}\nBrand Name: ${brandName || 'Not provided'}\nTarget Audience: ${finalAudience || 'General'}\nCountry / Language: ${language || 'Vietnamese'}\nReference URLs:\n${referenceUrls || 'None'}\n\nOriginal Article Content:\n${originalContent}`
        : `Please write a comprehensive SEO article from scratch based on the following details:\n\nMain Keyword: ${keyword}\nSecondary Keywords: ${secondaryKeywords || 'None'}\nBrand Name: ${brandName || 'Not provided'}\nTarget Audience: ${finalAudience || 'General'}\nCountry / Language: ${language || 'Vietnamese'}\nReference URLs:\n${referenceUrls || 'None'}`;

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

      // Save to History
      const newHistoryItem: HistoryItem = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        keyword: keyword,
        content: finalContent
      };
      const updatedHistory = [newHistoryItem, ...history].slice(0, 50); // Keep last 50
      setHistory(updatedHistory);
      localStorage.setItem('seo_history', JSON.stringify(updatedHistory));
      setCurrentHistoryId(newHistoryItem.id);
      setArticleVersions([{ timestamp: Date.now(), content: finalContent }]);

      // Trigger SEO Scoring
      setIsScoring(true);
      try {
        const score = await scoreSEO(finalContent, keyword, activeModel || targetModel, apiKeys);
        if (score) setSeoScore(score);
      } catch (e) {
        console.error("Scoring failed", e);
      } finally {
        setIsScoring(false);
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred while generating the content.');
    } finally {
      setIsGenerating(false);
    }
  };

  const chatAbortControllerRef = useRef<AbortController | null>(null);

  const handleChatSendMessage = async (message: string) => {
    if (!activeModel) return;
    
    const newMessages = [...chatMessages, { role: 'user' as const, content: message }];
    setChatMessages([...newMessages, { role: 'assistant', content: '' }]);
    setIsChatTyping(true);

    chatAbortControllerRef.current = new AbortController();

    try {
      let fullResponse = '';
      await chatWithBot(
        newMessages,
        result,
        activeModel,
        apiKeys,
        (chunk) => {
          fullResponse += chunk;
          setChatMessages(prev => {
            const last = prev[prev.length - 1];
            if (last.role === 'assistant') {
              return [...prev.slice(0, -1), { ...last, content: fullResponse }];
            }
            return prev;
          });
        },
        chatAbortControllerRef.current.signal
      );

      // Extract article if present
      const articleMatch = fullResponse.match(/```article\s*([\s\S]*?)\s*```/);
      let chatResponse = fullResponse;
      
      if (articleMatch && articleMatch[1]) {
        setResult(articleMatch[1]);
        setArticleVersions(prev => [...prev, { timestamp: Date.now(), content: articleMatch[1] }]);
        chatResponse = fullResponse.replace(/```article\s*[\s\S]*?\s*```/, '').trim();
        if (!chatResponse) chatResponse = "I've updated the article for you!";
        
        setChatMessages(prev => {
            const last = prev[prev.length - 1];
            return [...prev.slice(0, -1), { ...last, content: chatResponse }];
        });
      }

    } catch (e: any) {
      if (e.message === 'AbortError' || chatAbortControllerRef.current?.signal.aborted) {
        setChatMessages(prev => {
            const last = prev[prev.length - 1];
            return [...prev.slice(0, -1), { ...last, content: last.content + '\n\n[Đã hủy tạo nội dung]' }];
        });
      } else {
        setChatMessages([...newMessages, { role: 'assistant', content: `Error: ${e.message}` }]);
      }
    } finally {
      setIsChatTyping(false);
    }
  };

  const handleCancelChat = () => {
    if (chatAbortControllerRef.current) {
      chatAbortControllerRef.current.abort();
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

            {/* History Button */}
            <button 
              onClick={() => setShowHistory(true)}
              className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors border border-transparent hover:border-white/20"
              title="View History"
            >
              <History size={18} />
            </button>

            {/* Settings Button */}
            <button 
              onClick={() => setShowSettings(true)}
              className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors border border-transparent hover:border-white/20"
              title="API Keys & Settings"
            >
              <Settings size={18} />
            </button>

            {/* User Profile / Login */}
            {currentUser ? (
              <button
                onClick={() => setShowUserProfile(true)}
                className="flex items-center gap-2 p-1 pr-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors border border-white/10"
              >
                <img src={currentUser.photoURL || ''} alt="Profile" className="w-7 h-7 rounded-full" />
                <span className="text-sm font-medium hidden md:block">{currentUser.displayName?.split(' ')[0]}</span>
              </button>
            ) : (
              <button
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
              >
                {isLoggingIn ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
                Sign In
              </button>
            )}
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
              <div className="flex bg-slate-100 p-1 rounded-xl mb-6 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setAppMode('rewrite')}
                  className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all ${appMode === 'rewrite' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Edit size={16} />
                  Rewrite
                </button>
                <button
                  type="button"
                  onClick={() => setAppMode('write')}
                  className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all ${appMode === 'write' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <PenTool size={16} />
                  Write
                </button>
                <button
                  type="button"
                  onClick={() => setAppMode('autoWrite')}
                  className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all ${appMode === 'autoWrite' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Zap size={16} />
                  Auto Write List
                </button>
              </div>

              <h2 className="text-lg font-bold mb-6 flex items-center gap-2 text-[#0F172A]">
                <FileText size={20} className="text-blue-600" />
                {appMode === 'rewrite' ? 'Article Details' : 'Topic Details'}
              </h2>
              
              <form onSubmit={handleGenerate} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {appMode === 'autoWrite' ? (
                    <div className="md:col-span-2 space-y-3">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                        Keyword List <span className="text-red-500">*</span>
                      </label>
                      {autoKeywords.map((ak, index) => (
                        <div key={ak.id} className="flex flex-col sm:flex-row gap-2 items-start bg-slate-50 p-3 rounded-xl border border-slate-200">
                          <div className="flex-1 w-full relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                              type="text"
                              value={ak.main}
                              onChange={(e) => {
                                const newAk = [...autoKeywords];
                                newAk[index].main = e.target.value;
                                setAutoKeywords(newAk);
                              }}
                              placeholder="Main Keyword"
                              className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                              required
                            />
                          </div>
                          <div className="flex-1 w-full relative">
                            <input
                              type="text"
                              value={ak.secondary}
                              onChange={(e) => {
                                const newAk = [...autoKeywords];
                                newAk[index].secondary = e.target.value;
                                setAutoKeywords(newAk);
                              }}
                              placeholder="Secondary Keywords"
                              className="w-full pl-3 pr-20 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                            />
                            <button
                              type="button"
                              onClick={async () => {
                                if (!ak.main) return;
                                const newAk = [...autoKeywords];
                                newAk[index].isAnalyzing = true;
                                setAutoKeywords(newAk);
                                try {
                                  let targetModel = AVAILABLE_MODELS.find(m => m.id === selectedModelId) || AVAILABLE_MODELS[0];
                                  const { analyzeSecondaryKeywords } = await import('./services/aiService');
                                  const res = await analyzeSecondaryKeywords(ak.main, targetModel, apiKeys);
                                  const updatedAk = [...autoKeywords];
                                  updatedAk[index].secondary = res;
                                  updatedAk[index].isAnalyzing = false;
                                  setAutoKeywords(updatedAk);
                                } catch(e) {
                                  const updatedAk = [...autoKeywords];
                                  updatedAk[index].isAnalyzing = false;
                                  setAutoKeywords(updatedAk);
                                }
                              }}
                              disabled={ak.isAnalyzing || !ak.main}
                              className="absolute right-1 top-1/2 -translate-y-1/2 px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs font-bold hover:bg-blue-100 disabled:opacity-50 flex items-center gap-1"
                            >
                              {ak.isAnalyzing ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                              AI
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => setAutoKeywords(autoKeywords.filter(k => k.id !== ak.id))}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setAutoKeywords([...autoKeywords, { id: Date.now().toString(), main: '', secondary: '' }])}
                        className="text-sm font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      >
                        <Plus size={16} /> Add Keyword
                      </button>
                    </div>
                  ) : (
                    <>
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
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Secondary Keywords
                          </label>
                          <button
                            type="button"
                            onClick={handleAnalyzeKeywords}
                            disabled={isAnalyzingKeywords || !keyword}
                            className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 disabled:opacity-50"
                          >
                            {isAnalyzingKeywords ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                            AI Analyze
                          </button>
                        </div>
                        <div className="relative">
                          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            value={secondaryKeywords}
                            onChange={(e) => setSecondaryKeywords(e.target.value)}
                            placeholder="e.g., trail running, marathon"
                            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Brand Name
                    </label>
                    <div className="relative flex gap-2">
                      <div className="relative flex-1">
                        <Briefcase size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          list="saved-brands"
                          value={brandName}
                          onChange={(e) => setBrandName(e.target.value)}
                          placeholder="e.g., TechBlog"
                          className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                        />
                        <datalist id="saved-brands">
                          {savedBrands.map(b => <option key={b} value={b} />)}
                        </datalist>
                      </div>
                      <button type="button" onClick={() => { if(brandName && !savedBrands.includes(brandName)) saveBrands([...savedBrands, brandName]); }} className="px-3 bg-blue-100 text-blue-600 rounded-xl hover:bg-blue-200 text-sm font-bold" title="Save Brand">Save</button>
                      <button type="button" onClick={() => { saveBrands(savedBrands.filter(b => b !== brandName)); setBrandName(''); }} className="px-3 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 text-sm font-bold" title="Delete Brand">Del</button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex justify-between items-center">
                      <span>Target Audience</span>
                      <button
                        type="button"
                        onClick={handleAnalyzeAudience}
                        disabled={isAnalyzingAudience || !keyword}
                        className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded flex items-center gap-1 hover:bg-blue-100 disabled:opacity-50 transition-colors"
                      >
                        {isAnalyzingAudience ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                        Analyze
                      </button>
                    </label>
                    <div className="relative flex gap-2">
                      <div className="relative flex-1">
                        <Users size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          list="saved-audiences"
                          value={audienceSelect}
                          onChange={(e) => setAudienceSelect(e.target.value)}
                          placeholder="e.g., Beginners, Professionals"
                          className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                        />
                        <datalist id="saved-audiences">
                          {savedAudiences.map(a => <option key={a} value={a} />)}
                        </datalist>
                      </div>
                      <button type="button" onClick={() => { if(audienceSelect && !savedAudiences.includes(audienceSelect)) saveAudiences([...savedAudiences, audienceSelect]); }} className="px-3 bg-blue-100 text-blue-600 rounded-xl hover:bg-blue-200 text-sm font-bold" title="Save Audience">Save</button>
                      <button type="button" onClick={() => { saveAudiences(savedAudiences.filter(a => a !== audienceSelect)); setAudienceSelect(''); }} className="px-3 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 text-sm font-bold" title="Delete Audience">Del</button>
                    </div>
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
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Reference URLs (Optional, max 5, one per line)
                    </label>
                    <button
                      type="button"
                      onClick={handleAutoFetchUrls}
                      disabled={isFetchingUrls || (appMode === 'autoWrite' ? !autoKeywords[0]?.main : !keyword)}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 disabled:opacity-50"
                    >
                      {isFetchingUrls ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
                      Auto Fetch Top 10
                    </button>
                  </div>
                  <div className="relative">
                    <Link size={16} className="absolute left-3 top-3 text-slate-400" />
                    <textarea
                      value={referenceUrls}
                      onChange={(e) => setReferenceUrls(e.target.value)}
                      placeholder="e.g., https://example.com/article-to-learn-from&#10;https://example.com/another-article"
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm min-h-[80px]"
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

                <div className="flex items-center justify-between p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                  <div className="flex flex-col">
                    <label htmlFor="enableSearch" className="text-sm font-semibold text-blue-900 cursor-pointer select-none">
                      Enable Top Results Enrichment (Google Search)
                    </label>
                    <span className="text-xs text-blue-700/70 mt-0.5">
                      AI will fetch top SERP results to expand and detail the content.
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-100 px-2 py-1 rounded-md whitespace-nowrap hidden sm:block">
                      Deep Research
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input type="checkbox" id="enableSearch" checked={enableSearch} onChange={(e) => setEnableSearch(e.target.checked)} className="sr-only peer" />
                      <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
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
                      {isAutoWriting 
                        ? `Auto Writing (${autoWriteProgress.current}/${autoWriteProgress.total})...` 
                        : appMode === 'rewrite' ? 'Rewriting & Optimizing...' : 'Generating Article...'}
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} />
                      {appMode === 'autoWrite' ? 'Start Auto Write' : appMode === 'rewrite' ? 'Generate SEO Content' : 'Write Article'}
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Output */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <SEOScoreCard score={seoScore} isScoring={isScoring} />

            <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-slate-200/60 flex-1 min-h-[600px] flex flex-col relative overflow-hidden">
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
                  <div className="flex items-center gap-2">
                    {articleVersions.length > 1 && (
                      <select 
                        className="text-xs px-2 py-1.5 bg-white border border-slate-200 rounded-lg outline-none cursor-pointer"
                        onChange={(e) => {
                          const idx = parseInt(e.target.value);
                          if (!isNaN(idx) && articleVersions[idx]) {
                            setResult(articleVersions[idx].content);
                          }
                        }}
                        defaultValue={articleVersions.length - 1}
                      >
                        {articleVersions.map((v, idx) => (
                          <option key={idx} value={idx}>
                            Version {idx + 1} ({new Date(v.timestamp).toLocaleTimeString()})
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      onClick={copyToClipboard}
                      className="text-xs flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-blue-300 transition-all text-slate-700 font-semibold shadow-sm"
                    >
                      {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} className="text-blue-600" />}
                      {copied ? 'Copied!' : 'Copy Content'}
                    </button>
                  </div>
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
      {/* History Modal */}
      <HistoryModal
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        history={history}
        onSelect={(item) => {
          setKeyword(item.keyword);
          setResult(item.content);
          setCurrentHistoryId(item.id);
          setArticleVersions([{ timestamp: Date.now(), content: item.content }]);
          setShowHistory(false);
          setProgressStep(3);
        }}
        onClear={() => {
          setHistory([]);
          localStorage.removeItem('seo_history');
        }}
      />

      <UserProfileModal
        isOpen={showUserProfile}
        onClose={() => setShowUserProfile(false)}
      />

      {/* AI Chat Bot */}
      <AIChatBot
        isOpen={isChatOpen}
        onToggle={() => setIsChatOpen(!isChatOpen)}
        messages={chatMessages}
        onSendMessage={handleChatSendMessage}
        isTyping={isChatTyping}
        onCancel={handleCancelChat}
      />
    </div>
  );
}

