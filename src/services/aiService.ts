import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { loggingService } from './loggingService';

export type AIProvider = 'Gemini' | 'OpenAI' | 'OpenRouter';

export interface AIModel {
  id: string;
  name: string;
  provider: AIProvider;
  isFast: boolean;
  isQuality: boolean;
}

export const AVAILABLE_MODELS: AIModel[] = [
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro (Free Built-in)', provider: 'Gemini', isFast: false, isQuality: true },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3.0 Flash (Free Built-in)', provider: 'Gemini', isFast: true, isQuality: false },
  { id: 'google/gemini-2.5-flash:free', name: 'Gemini 2.5 Flash (Free)', provider: 'OpenRouter', isFast: true, isQuality: false },
  { id: 'google/gemini-2.5-flash-lite-preview-09-2025', name: 'Gemini 2.5 Flash Lite (OpenRouter)', provider: 'OpenRouter', isFast: true, isQuality: false },
  { id: 'meta-llama/llama-3.1-8b-instruct:free', name: 'Llama 3.1 8B (Free)', provider: 'OpenRouter', isFast: true, isQuality: false },
  { id: 'qwen/qwen-2.5-72b-instruct:free', name: 'Qwen 2.5 72B (Free)', provider: 'OpenRouter', isFast: false, isQuality: true },
  { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B (Free)', provider: 'OpenRouter', isFast: true, isQuality: false },
  { id: 'microsoft/phi-3-mini-128k-instruct:free', name: 'Phi-3 Mini (Free)', provider: 'OpenRouter', isFast: true, isQuality: false },
  { id: 'gpt-4o', name: 'GPT-4o (Paid)', provider: 'OpenAI', isFast: false, isQuality: true },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet (Paid)', provider: 'OpenRouter', isFast: false, isQuality: true },
];

export interface APIKeys {
  gemini: string;
  openai: string;
  openrouter: string;
}

export const getStoredKeys = (): APIKeys => {
  return {
    gemini: localStorage.getItem('gemini_api_key') || '',
    openai: localStorage.getItem('openai_api_key') || '',
    openrouter: localStorage.getItem('openrouter_api_key') || '',
  };
};

export const saveStoredKeys = (keys: APIKeys) => {
  localStorage.setItem('gemini_api_key', keys.gemini);
  localStorage.setItem('openai_api_key', keys.openai);
  localStorage.setItem('openrouter_api_key', keys.openrouter);
};

export const determineBestModel = (mode: 'Fast' | 'Quality' | 'Auto', taskType: 'rewrite' | 'audit'): AIModel => {
  if (mode === 'Auto') {
    const bestModelId = loggingService.getBestModelForTask(taskType, mode);
    const model = AVAILABLE_MODELS.find(m => m.id === bestModelId);
    if (model) return model;
  }

  if (mode === 'Fast') {
    return AVAILABLE_MODELS.find(m => m.isFast) || AVAILABLE_MODELS[1]; // fallback to flash
  }

  // Quality mode
  return AVAILABLE_MODELS.find(m => m.isQuality) || AVAILABLE_MODELS[0]; // fallback to pro
};

import { auth, db } from '../firebase';
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';

export const generateContent = async (
  model: AIModel,
  systemInstruction: string,
  prompt: string,
  keys: APIKeys,
  onChunk: (text: string) => void,
  enableSearch: boolean,
  signal?: AbortSignal
): Promise<string> => {
  const startTime = Date.now();
  let fullText = '';
  let tokensUsed = 0;

  try {
    if (model.provider === 'Gemini') {
      let apiKey = keys.gemini || process.env.GEMINI_API_KEY;
      
      const user = auth.currentUser;
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (data.geminiApiKey) {
            apiKey = data.geminiApiKey;
          }
          if (data.tokensUsed >= data.quotaLimit) {
            throw new Error('User has exceeded quota. Please upgrade your account or use your own API key.');
          }
        }
      }

      if (!apiKey) throw new Error('Gemini API key is missing.');
      
      const ai = new GoogleGenAI({ apiKey });
      const config: any = {
        systemInstruction,
        temperature: 0.7,
      };

      if (enableSearch) {
        config.tools = [{ googleSearch: {} }];
      }

      const responseStream = await ai.models.generateContentStream({
        model: model.id,
        contents: prompt,
        config,
      });

      for await (const chunk of responseStream) {
        if (signal?.aborted) {
          throw new Error('AbortError');
        }
        const text = chunk.text || '';
        fullText += text;
        onChunk(text);
        if (chunk.usageMetadata) {
          tokensUsed = chunk.usageMetadata.totalTokenCount || 0;
        }
      }
      
      if (tokensUsed === 0) {
        // Estimate if not provided
        tokensUsed = Math.ceil((prompt.length + systemInstruction.length + fullText.length) / 4);
      }

      if (user) {
        try {
          await updateDoc(doc(db, 'users', user.uid), {
            tokensUsed: increment(tokensUsed)
          });
        } catch (e) {
          console.error("Failed to update token usage", e);
        }
      }
    } else if (model.provider === 'OpenAI') {
      if (!keys.openai) throw new Error('OpenAI API key is missing.');
      const openai = new OpenAI({ apiKey: keys.openai, dangerouslyAllowBrowser: true });
      
      const stream = await openai.chat.completions.create({
        model: model.id,
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        stream: true,
      });

      for await (const chunk of stream) {
        if (signal?.aborted) {
          throw new Error('AbortError');
        }
        const text = chunk.choices[0]?.delta?.content || '';
        fullText += text;
        onChunk(text);
      }
    } else if (model.provider === 'OpenRouter') {
      if (!keys.openrouter) throw new Error('OpenRouter API key is missing.');
      const openai = new OpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: keys.openrouter,
        dangerouslyAllowBrowser: true,
        defaultHeaders: {
          'HTTP-Referer': window.location.origin,
          'X-Title': 'SEO Content Rewriter Pro',
        }
      });
      
      const stream = await openai.chat.completions.create({
        model: model.id,
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 10000,
        stream: true,
      });

      for await (const chunk of stream) {
        if (signal?.aborted) {
          throw new Error('AbortError');
        }
        const text = chunk.choices[0]?.delta?.content || '';
        fullText += text;
        onChunk(text);
      }
    }

    loggingService.addLog({
      modelUsed: model.id,
      taskType: 'rewrite',
      responseTimeMs: Date.now() - startTime,
      success: true,
    });

    return fullText;
  } catch (error: any) {
    if (error.message === 'AbortError' || signal?.aborted) {
      throw error;
    }
    loggingService.addLog({
      modelUsed: model.id,
      taskType: 'rewrite',
      responseTimeMs: Date.now() - startTime,
      success: false,
      error: error.message,
    });
    throw error;
  }
};

export const generateWithFallback = async (
  initialModel: AIModel,
  systemInstruction: string,
  prompt: string,
  keys: APIKeys,
  onChunk: (text: string) => void,
  onFallback: (newModel: AIModel) => void,
  enableSearch: boolean,
  signal?: AbortSignal
): Promise<string> => {
  try {
    // Pre-check API keys to avoid unnecessary fallbacks
    if (initialModel.provider === 'OpenAI' && !keys.openai) {
      throw new Error('Vui lòng nhập OpenAI API Key trong phần Cài đặt (Settings) góc phải trên cùng để sử dụng model này.');
    }
    if (initialModel.provider === 'OpenRouter' && !keys.openrouter) {
      throw new Error('Vui lòng nhập OpenRouter API Key trong phần Cài đặt (Settings) góc phải trên cùng để sử dụng model này.');
    }

    return await generateContent(initialModel, systemInstruction, prompt, keys, onChunk, enableSearch, signal);
  } catch (error: any) {
    if (error.message === 'AbortError' || signal?.aborted) {
      throw error;
    }
    console.warn(`Model ${initialModel.name} failed. Attempting fallback...`, error);
    
    const errorMessage = error.message || String(error);

    // If it's a missing key error, do not fallback. Force the user to enter the key.
    if (errorMessage.includes('Vui lòng nhập') || errorMessage.includes('API key is missing')) {
      throw new Error(errorMessage.includes('Vui lòng nhập') ? errorMessage : `Vui lòng nhập API Key cho ${initialModel.provider} trong phần Cài đặt (Settings).`);
    }

    // If the user is using their OWN API key (OpenRouter or OpenAI), we should tell them exactly what failed
    // instead of falling back to the free built-in Gemini (which might be rate limited).
    if (initialModel.provider === 'OpenRouter' || initialModel.provider === 'OpenAI') {
        throw new Error(`Lỗi từ ${initialModel.provider} (${initialModel.name}): ${errorMessage}. Vui lòng kiểm tra lại API Key hoặc số dư tài khoản của bạn.`);
    }

    // If the initial model hits a rate limit, don't silently fallback to another rate-limited model if it's the same provider
    if (errorMessage.includes('429') || errorMessage.includes('Quota exceeded') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
       // If they are using the default built-in key, tell them to use their own
       throw new Error(`Lỗi giới hạn (Rate Limit) trên ${initialModel.name}: Hệ thống đã hết lượt sử dụng miễn phí tạm thời. Vui lòng thử lại sau ít phút hoặc nhập API Key riêng của bạn trong phần Cài đặt (Settings).`);
    }

    // Find a fallback model (prefer Gemini Flash as it's faster and has higher limits)
    let fallbackModel = AVAILABLE_MODELS.find(m => m.id === 'gemini-3-flash-preview');
    if (!fallbackModel || fallbackModel.id === initialModel.id) {
      fallbackModel = AVAILABLE_MODELS.find(m => m.id !== initialModel.id && m.isQuality) || AVAILABLE_MODELS[0];
    }
    
    onFallback(fallbackModel);
    
    try {
      return await generateContent(fallbackModel, systemInstruction, prompt, keys, onChunk, enableSearch, signal);
    } catch (fallbackError: any) {
      if (fallbackError.message === 'AbortError' || signal?.aborted) {
        throw fallbackError;
      }
      const fbErrorMessage = fallbackError.message || String(fallbackError);
      if (fbErrorMessage.includes('429') || fbErrorMessage.includes('Quota exceeded') || fbErrorMessage.includes('RESOURCE_EXHAUSTED')) {
        throw new Error(`Lỗi giới hạn (Rate Limit): Hệ thống đã hết lượt sử dụng miễn phí tạm thời. Vui lòng thử lại sau ít phút hoặc nhập API Key riêng của bạn trong phần Cài đặt (Settings).`);
      }
      throw new Error(`Lỗi Fallback Model: ${fbErrorMessage}`);
    }
  }
};

export async function scoreSEO(content: string, keyword: string, model: AIModel, apiKeys: APIKeys): Promise<any> {
  const systemInstruction = `You are an expert SEO auditor. Analyze the provided article against the keyword "${keyword}".
Return ONLY a valid JSON object with the following structure, no markdown formatting, no backticks:
{
  "overall": <number 0-100>,
  "readability": <number 0-100>,
  "keywordOptimization": <number 0-100>,
  "eeat": <number 0-100>,
  "feedback": ["<string actionable feedback 1>", "<string actionable feedback 2>", "<string actionable feedback 3>"]
}`;
  const prompt = `Keyword: ${keyword}\n\nArticle Content:\n${content}`;
  
  let result = '';
  await generateWithFallback(
    model,
    systemInstruction,
    prompt,
    apiKeys,
    (chunk) => { result += chunk; },
    () => {},
    false
  );
  
  try {
    const cleaned = result.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("Failed to parse SEO score JSON", result);
    return null;
  }
}

export async function chatWithBot(
  messages: {role: string, content: string}[], 
  currentArticle: string, 
  model: AIModel, 
  apiKeys: APIKeys, 
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const systemInstruction = `You are a helpful SEO Assistant. The user is currently working on an SEO article.
Here is the CURRENT ARTICLE:
---
${currentArticle}
---

Your task:
1. Answer the user's questions about SEO or the article.
2. If the user asks you to modify, rewrite, or update the article, you MUST provide the ENTIRE updated article enclosed in \`\`\`article ... \`\`\` tags.
3. Be friendly, concise, and professional.`;

  const conversation = messages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n');
  const prompt = `${conversation}\n\nAssistant:`;

  let fullResponse = '';
  await generateWithFallback(
    model,
    systemInstruction,
    prompt,
    apiKeys,
    (chunk) => {
      fullResponse += chunk;
      onChunk(chunk);
    },
    () => {},
    false,
    signal
  );
  
  return fullResponse;
}

export async function analyzeSecondaryKeywords(keyword: string, model: AIModel, apiKeys: APIKeys): Promise<string> {
  const systemInstruction = `You are an expert SEO strategist. The user will provide a main keyword.
Your task is to generate a comma-separated list of 10-15 highly relevant LSI keywords, semantic keywords, and long-tail variations.
DO NOT output any other text, bullet points, or explanations. ONLY the comma-separated list.`;
  
  const prompt = `Main Keyword: ${keyword}`;
  
  let result = '';
  await generateWithFallback(
    model,
    systemInstruction,
    prompt,
    apiKeys,
    (chunk) => { result += chunk; },
    () => {},
    false
  );
  
  return result.trim();
}

export async function analyzeTargetAudience(keyword: string, model: AIModel, apiKeys: APIKeys): Promise<string> {
  const systemInstruction = `Bạn là một chuyên gia nghiên cứu thị trường và SEO. Người dùng sẽ cung cấp một từ khóa chính.
Nhiệm vụ của bạn là đề xuất một danh sách các nhóm đối tượng mục tiêu (Target Audience) phù hợp nhất cho bài viết SEO về từ khóa đó.
Yêu cầu:
- Luôn luôn phải có nhóm "Người mới bắt đầu" (Beginner) trong danh sách.
- Trả về danh sách dưới dạng các mục cách nhau bằng dấu phẩy.
- Chỉ trả về danh sách, không giải thích gì thêm.
Ví dụ: Người mới bắt đầu, Chuyên gia marketing, Chủ doanh nghiệp nhỏ`;

  const prompt = `Từ khóa chính: ${keyword}`;

  let result = '';
  await generateWithFallback(
    model,
    systemInstruction,
    prompt,
    apiKeys,
    (chunk) => { result += chunk; },
    () => {},
    false
  );

  return result.trim();
}

export async function fetchTopUrls(keyword: string, model: AIModel, apiKeys: APIKeys): Promise<string> {
  const systemInstruction = `You are an SEO researcher. Use Google Search to find the top ranking articles for the given keyword in Vietnam. Return ONLY a plain text list of the URLs found, one per line. Do not include any other text, markdown, or explanations.`;
  const prompt = `Keyword: ${keyword}`;
  let result = '';
  await generateWithFallback(
    model,
    systemInstruction,
    prompt,
    apiKeys,
    (chunk) => { result += chunk; },
    () => {},
    true // Force enable search
  );
  return result.trim();
}
