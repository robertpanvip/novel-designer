/* ============================================================
   砚墨 · 小说设计器 — 图片生成 API 存根层
   ------------------------------------------------------------
   场景与人物配图的一致性机制：
   1) 人物一致性 = 「外貌锚点」(character.appearance) + 固定风格后缀
      + 每角色固定 seed。变体仅改变姿态/构图，不改变身份描述。
   2) 场景一致性 = 全局统一风格后缀(config.style) + 主题/描述。
   接入真实模型（IMG2IMG 参考图 + seed）时仅需替换各函数内部实现，
   页面调用方无需改动。全部存根标注：// TODO: replace with fetch('/api/…')
   ============================================================ */

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const IMG_EP = 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image';

/** 预置图片生成 Provider（可配置） */
export const IMAGE_PROVIDERS = [
  {
    id: 'trae',
    name: '砚墨 · 文生图',
    desc: '原型内置文生图端点，无需 Key',
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

export const IMAGE_DEFAULT = {
  provider: 'trae',
  style:
    'dark cinematic noir ink illustration, deep ink-blue and charcoal palette, single vermilion accent, misty coastal atmosphere, dramatic chiaroscuro lighting, painterly, high detail',
  size: 'portrait_4_3',
  sceneSize: 'landscape_16_9',
  seed: 7,
  baseUrl: '',
  apiKey: '',
  connected: false,
  lastTest: null,
  useCount: 0,
};

const SIZE_POOL = ['square_hd', 'square', 'portrait_4_3', 'portrait_16_9', 'landscape_4_3', 'landscape_16_9'];

/* ---------------- 纯函数：由配置+主体直接构造图片 URL（同步，供渲染） ---------------- */

function encodePrompt(prompt) {
  return encodeURIComponent(prompt);
}

export function buildImageUrl({ prompt, size }) {
  return `${IMG_EP}?prompt=${encodePrompt(prompt)}&image_size=${size || 'square_hd'}`;
}

/** 人物画像提示词：身份锚点恒定，仅变体微调姿态/构图 */
export function buildCharacterPrompt(character, style, variant = 0) {
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
export function buildScenePrompt(scene, style, variant = 0) {
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

/** 人物画像 URL（同步，用于卡片初始渲染） */
export function characterImageUrl({ config, character, variant = 0 }) {
  const cfg = { ...IMAGE_DEFAULT, ...(config || {}) };
  return buildImageUrl({
    prompt: buildCharacterPrompt(character, cfg.style, variant),
    size: cfg.size,
  });
}

/** 场景配图 URL（同步） */
export function sceneImageUrl({ config, scene, variant = 0 }) {
  const cfg = { ...IMAGE_DEFAULT, ...(config || {}) };
  return buildImageUrl({
    prompt: buildScenePrompt(scene, cfg.style, variant),
    size: cfg.sceneSize,
  });
}

/* ---------------- 异步存根（模拟生成耗时，供「重新生成」按钮） ---------------- */

/**
 * 生成/重新生成角色画像
 * POST /api/image/character  body: { config, character, variant }
 * 真实接入：以 character.appearance 为参考图 + seed 做 IMG2IMG，保证形象连贯。
 */
export async function generateCharacterImage({ config, character, variant = 0 }) {
  // TODO: replace with fetch('/api/image/character', { method:'POST', ... })
  await delay(1200);
  const cfg = { ...IMAGE_DEFAULT, ...(config || {}) };
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

/**
 * 生成/重新生成场景配图
 * POST /api/image/scene  body: { config, scene, variant }
 */
export async function generateSceneImage({ config, scene, variant = 0 }) {
  // TODO: replace with fetch('/api/image/scene', { method:'POST', ... })
  await delay(1200);
  const cfg = { ...IMAGE_DEFAULT, ...(config || {}) };
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

/**
 * 测试图片生成连接
 * POST /api/image/test  body: { provider, baseUrl, apiKey, size }
 */
export async function testImageConnection({ provider, baseUrl, apiKey }) {
  // TODO: replace with fetch('/api/image/test', { method:'POST', ... })
  await delay(800);
  if (provider !== 'trae' && !apiKey) {
    return { ok: false, message: '该 Provider 需要填写 API Key' };
  }
  return {
    ok: true,
    latency: 260 + Math.floor(Math.random() * 240),
    message: '配图服务可用',
  };
}

export { SIZE_POOL };
