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

export const generateContent = async (
  model: AIModel,
  systemInstruction: string,
  prompt: string,
  keys: APIKeys,
  onChunk: (text: string) => void,
  enableSearch: boolean
): Promise<string> => {
  const startTime = Date.now();
  let fullText = '';

  try {
    if (model.provider === 'Gemini') {
      const apiKey = keys.gemini || process.env.GEMINI_API_KEY;
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
        const text = chunk.text || '';
        fullText += text;
        onChunk(text);
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
        max_tokens: 6000,
        stream: true,
      });

      for await (const chunk of stream) {
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
  enableSearch: boolean
): Promise<string> => {
  try {
    // Pre-check API keys to avoid unnecessary fallbacks
    if (initialModel.provider === 'OpenAI' && !keys.openai) {
      throw new Error('Vui lòng nhập OpenAI API Key trong phần Cài đặt (Settings) góc phải trên cùng để sử dụng model này.');
    }
    if (initialModel.provider === 'OpenRouter' && !keys.openrouter) {
      throw new Error('Vui lòng nhập OpenRouter API Key trong phần Cài đặt (Settings) góc phải trên cùng để sử dụng model này.');
    }

    return await generateContent(initialModel, systemInstruction, prompt, keys, onChunk, enableSearch);
  } catch (error: any) {
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
      return await generateContent(fallbackModel, systemInstruction, prompt, keys, onChunk, enableSearch);
    } catch (fallbackError: any) {
      const fbErrorMessage = fallbackError.message || String(fallbackError);
      if (fbErrorMessage.includes('429') || fbErrorMessage.includes('Quota exceeded') || fbErrorMessage.includes('RESOURCE_EXHAUSTED')) {
        throw new Error(`Lỗi giới hạn (Rate Limit): Hệ thống đã hết lượt sử dụng miễn phí tạm thời. Vui lòng thử lại sau ít phút hoặc nhập API Key riêng của bạn trong phần Cài đặt (Settings).`);
      }
      throw new Error(`Lỗi Fallback Model: ${fbErrorMessage}`);
    }
  }
};
