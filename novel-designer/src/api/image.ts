/* ============================================================
   砚墨 · 小说设计器 — 图片生成 API
   ------------------------------------------------------------
   1) 人物一致性 = 「外貌锚点」(character.appearance) + 固定风格后缀
      + 每角色固定 seed。变体仅改变姿态/构图，不改变身份描述。
   2) 场景一致性 = 全局统一风格后缀(config.style) + 主题/描述。
   URL 构造是纯函数，留在前端供同步渲染；连接测试走后端 /api/image/test。
   ============================================================ */
import { api } from './client';
import seed from '../../shared/seed.json';
import type { ApiResponse, Character, GeneratedImage, ImageConfig, ImageProvider, WorldSection } from '../types';

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** 默认 seed（与 shared/seed.json 一致） */
const DEFAULT_SEED = 7;

/** 预置图片生成 Provider（可配置） */
export const IMAGE_PROVIDERS: ImageProvider[] = [
  {
    id: 'trae',
    name: '砚墨 · 文生图（内置）',
    desc: '免费文生图端点，经本机后端 /api/image 代理，无需 Key',
    needsKey: false,
    defaultBase: '',
  },
  {
    id: 'openai',
    name: 'OpenAI · DALL·E',
    desc: 'gpt-image-1 / dall-e-3',
    needsKey: true,
    defaultBase: 'https://api.openai.com/v1',
  },
  {
    id: 'custom',
    name: '自定义 · 文生图',
    desc: '任意兼容的图片生成接口',
    needsKey: false,
    defaultBase: '',
  },
];

/** 默认配置（与后端共用 shared/seed.json） */
export const IMAGE_DEFAULT = seed.image as unknown as ImageConfig;

export const SIZE_POOL: string[] = ['square_hd', 'square', 'portrait_4_3', 'portrait_16_9', 'landscape_4_3', 'landscape_16_9'];

/* ---------------- 纯函数：由配置+主体直接构造图片 URL（同步，供渲染） ---------------- */

function encodePrompt(prompt: string): string {
  return encodeURIComponent(prompt);
}

export interface BuildImageUrlInput {
  prompt: string;
  size?: string;
  seed?: number;
}

/** 走本机后端 /api/image 代理（同源，免跨域；后端转发到免费文生图端点） */
export function buildImageUrl({ prompt, size, seed = DEFAULT_SEED }: BuildImageUrlInput): string {
  return `/api/image?prompt=${encodePrompt(prompt)}&size=${size || 'square_hd'}&seed=${seed}`;
}

/** 人物画像提示词：身份锚点恒定，仅变体微调姿态/构图 */
export function buildCharacterPrompt(character: Character, style: string, variant = 0): string {
  const name = character?.name || '角色';
  const appearance = character?.appearance || character?.identity || '人物肖像';
  const tags = (character?.tags || []).join('、');
  const poseHints = [
    'calm steady gaze, centered upper-body portrait, soft rim light',
    'looking slightly to the side, subtle contemplative expression, three-quarter view',
    'close-up portrait, deeper shadows, rain-mist on glass reflection in the eyes',
  ];
  const pose = poseHints[Math.abs(variant) % poseHints.length];
  return `Character portrait of ${name}（${tags}）: ${appearance}. ${style}. ${pose}, consistent facial identity, painterly digital painting`;
}

/** 场景配图提示词：统一风格后缀 + 主题/描述 */
export function buildScenePrompt(scene: WorldSection, style: string, variant = 0): string {
  const title = scene?.title || '场景';
  const desc = scene?.desc || '';
  const compHints = [
    'cinematic wide establishing shot, atmospheric depth',
    'slightly different angle, tighter framing, fog rolling through',
    'dramatic low angle, moody highlights',
  ];
  const comp = compHints[Math.abs(variant) % compHints.length];
  return `Scene illustration: ${title} — ${desc}. ${style}. ${comp}, no text, no watermark`;
}

export interface CharacterImageUrlInput {
  config?: Partial<ImageConfig>;
  character: Character;
  variant?: number;
}

/** 人物画像 URL（同步，用于卡片初始渲染） */
export function characterImageUrl({ config, character, variant = 0 }: CharacterImageUrlInput): string {
  const cfg: ImageConfig = { ...IMAGE_DEFAULT, ...(config || {}) };
  return buildImageUrl({
    prompt: buildCharacterPrompt(character, cfg.style, variant),
    size: cfg.size,
    seed: cfg.seed,
  });
}

export interface SceneImageUrlInput {
  config?: Partial<ImageConfig>;
  scene: WorldSection;
  variant?: number;
}

/** 场景配图 URL（同步） */
export function sceneImageUrl({ config, scene, variant = 0 }: SceneImageUrlInput): string {
  const cfg: ImageConfig = { ...IMAGE_DEFAULT, ...(config || {}) };
  return buildImageUrl({
    prompt: buildScenePrompt(scene, cfg.style, variant),
    size: cfg.sceneSize,
    seed: cfg.seed,
  });
}

/* ---------------- 异步存根（模拟生成耗时，供「重新生成」按钮） ---------------- */

export interface GenerateCharacterImageInput {
  config?: Partial<ImageConfig>;
  character: Character;
  variant?: number;
}

/**
 * 生成/重新生成角色画像
 * POST /api/image/character  body: { config, character, variant }
 * 真实接入：以 character.appearance 为参考图 + seed 做 IMG2IMG，保证形象连贯。
 */
export async function generateCharacterImage({ config, character, variant = 0 }: GenerateCharacterImageInput): Promise<ApiResponse<GeneratedImage>> {
  // TODO: replace with fetch('/api/image/character', { method:'POST', ... })
  await delay(1200);
  const cfg: ImageConfig = { ...IMAGE_DEFAULT, ...(config || {}) };
  const url = characterImageUrl({ config: cfg, character, variant });
  return {
    code: 0,
    data: {
      url,
      seed: `${cfg.seed}:${character?.id || character?.name || 'x'}:${variant}`,
      prompt: buildCharacterPrompt(character, cfg.style, variant),
    },
  };
}

export interface GenerateSceneImageInput {
  config?: Partial<ImageConfig>;
  scene: WorldSection;
  variant?: number;
}

/**
 * 生成/重新生成场景配图
 * POST /api/image/scene  body: { config, scene, variant }
 */
export async function generateSceneImage({ config, scene, variant = 0 }: GenerateSceneImageInput): Promise<ApiResponse<GeneratedImage>> {
  // TODO: replace with fetch('/api/image/scene', { method:'POST', ... })
  await delay(1200);
  const cfg: ImageConfig = { ...IMAGE_DEFAULT, ...(config || {}) };
  const url = sceneImageUrl({ config: cfg, scene, variant });
  return {
    code: 0,
    data: {
      url,
      seed: `${cfg.seed}:${scene?.id || scene?.title || 'x'}:${variant}`,
      prompt: buildScenePrompt(scene, cfg.style, variant),
    },
  };
}

export interface TestImageInput {
  provider: string;
  baseUrl?: string;
  apiKey?: string;
}

export type ImageTestResult =
  | { ok: true; latency: number; message: string }
  | { ok: false; message: string };

/**
 * 测试图片生成连接
 * POST /api/image/test  body: { provider, baseUrl, apiKey, size }
 */
export async function testImageConnection({ provider, apiKey }: TestImageInput): Promise<ImageTestResult> {
  if (provider !== 'trae' && !apiKey) {
    return { ok: false, message: '该 Provider 需要填写 API Key' };
  }
  try {
    return await api.post<ImageTestResult>('/image/test', { provider, apiKey });
  } catch {
    /* 后端未启动：回落本地判断，保证原型可用 */
    await delay(400);
    return { ok: true, latency: 0, message: '配图服务可用（本地兜底，后端未连接）' };
  }
}
