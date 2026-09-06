/* ============================================================
   砚墨 · 小说设计器 — LLM API
   ------------------------------------------------------------
   全部走真实后端 /api/llm/*（后端代理 OpenAI 兼容接口并落 SQLite）。
   后端未启动时抛错，由调用方/页面决定是否降级。
   ============================================================ */
import { api, streamPost } from './client';
import providers from '../../shared/providers.json';
import type {
  AIActionKey,
  ApiResponse,
  ChatReply,
  LLMConfig,
  Provider,
  RunAIContext,
  UsageData,
} from '../types';

/** 预置 Provider（与后端共用 shared/providers.json） */
export const PROVIDERS = providers as unknown as Provider[];

/**
 * 查询某 Provider 的可用模型列表
 * GET /api/llm/models?provider=xxx
 */
export async function listModels(providerId: string): Promise<string[]> {
  return api.get<string[]>(`/llm/models?provider=${encodeURIComponent(providerId)}`);
}

export interface TestConnectionInput {
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export type TestResult =
  | { ok: true; latency: number; model: string; message: string }
  | { ok: false; latency?: number; model?: string; message: string };

/** 测试模型连接（由后端发起，避免浏览器 CORS 与密钥暴露） */
export async function testConnection(input: TestConnectionInput): Promise<TestResult> {
  return api.post<TestResult>('/llm/test', input);
}

export interface RunAIParams {
  action: AIActionKey;
  context?: RunAIContext;
  onDelta?: (delta: string) => void;
  /** 结束元信息：source=canned 表示后端未配置模型、返回的是内置占位文案 */
  onMeta?: (meta: { source?: string; error?: string | null }) => void;
  signal?: AbortSignal;
}

/**
 * 执行 AI 动作（续写/扩写/润色/改写/灵感/一致性/成稿）
 * POST /api/llm/chat —— SSE 流式，逐段 onDelta 回调
 */
export async function runAI({ action, context = {}, onDelta, onMeta, signal }: RunAIParams): Promise<ApiResponse<ChatReply>> {
  let reply = '';
  await streamPost(
    '/llm/chat',
    { action, context },
    {
      signal,
      onDelta: (d) => {
        reply += d;
        onDelta?.(d);
      },
      onDone: (meta) => onMeta?.(meta ?? {}),
    },
  );
  return { code: 0, data: { reply } };
}

/** 用量统计（后端按 usage_events 真实聚合） */
export async function fetchUsage(): Promise<ApiResponse<UsageData>> {
  const data = await api.get<UsageData>('/llm/usage');
  return { code: 0, data };
}

/* ---------------- 配置持久化 ---------------- */

export async function fetchLLMConfig(): Promise<LLMConfig> {
  return api.get<LLMConfig>('/settings/llm');
}

export async function saveLLMConfig(patch: Partial<LLMConfig>): Promise<LLMConfig> {
  return api.put<LLMConfig>('/settings/llm', patch);
}
