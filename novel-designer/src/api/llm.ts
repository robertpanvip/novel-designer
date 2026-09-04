/* ============================================================
   砚墨 · 小说设计器 — LLM API 存根层
   ------------------------------------------------------------
   签名 = 未来真实后端 API 的形状。接入真实模型时仅需替换
   各函数内部实现，页面调用方无需改动。
   全部存根标注：// TODO: replace with fetch('/api/…')
   ============================================================ */
import type { Provider, AIActionKey, RunAIContext, ApiResponse, ChatReply, UsageData } from '../types';

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** 预置 Provider（可配置大模型的来源之一） */
export const PROVIDERS: Provider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    desc: 'GPT 系列官方接口',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    defaultModel: 'gpt-4o-mini',
    needsKey: true,
    badge: '#10A37F',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    desc: '开源模型 · 中文创作性价比之选',
    baseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    defaultModel: 'deepseek-chat',
    needsKey: true,
    badge: '#4D6BFE',
  },
  {
    id: 'moonshot',
    name: '月之暗面 Moonshot',
    desc: 'Kimi 系列 · 长上下文友好',
    baseUrl: 'https://api.moonshot.cn/v1',
    models: ['moonshot-v1-32k', 'moonshot-v1-128k', 'moonshot-v1-8k'],
    defaultModel: 'moonshot-v1-32k',
    needsKey: true,
    badge: '#2B3A55',
  },
  {
    id: 'qwen',
    name: '通义千问 Qwen',
    desc: '阿里云 · 中文理解与生成',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen-plus', 'qwen-max', 'qwen-turbo', 'qwen-long'],
    defaultModel: 'qwen-plus',
    needsKey: true,
    badge: '#615CED',
  },
  {
    id: 'custom',
    name: '自定义 · OpenAI 兼容',
    desc: '任意 OpenAI 兼容接口（本地 Ollama / vLLM / 其他网关）',
    baseUrl: '',
    models: [],
    defaultModel: '',
    needsKey: false,
    badge: '#D8A25E',
  },
];

/**
 * 查询某 Provider 的可用模型列表
 * GET /api/llm/models?provider=xxx
 */
export async function listModels(providerId: string): Promise<ApiResponse<string[]>> {
  // TODO: replace with fetch(`/api/llm/models?provider=${providerId}`)
  await delay(300);
  const p = PROVIDERS.find((x) => x.id === providerId);
  if (!p) return { code: 0, data: [] };
  if (providerId === 'custom') {
    return { code: 0, data: ['自定义（将直接使用下方 Base URL 与模型名）'] };
  }
  return { code: 0, data: p.models };
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

/**
 * 测试模型连接
 * POST /api/llm/test   body: { provider, baseUrl, apiKey, model }
 * → { ok, latency, model, message }
 */
export async function testConnection({ provider, baseUrl, apiKey, model }: TestConnectionInput): Promise<TestResult> {
  // TODO: replace with fetch('/api/llm/test', { method: 'POST', body: JSON.stringify(...) })
  await delay(900);
  const p = PROVIDERS.find((x) => x.id === provider);
  if (provider !== 'custom' && !apiKey) {
    return { ok: false, message: '未填写 API Key' };
  }
  if (!baseUrl) {
    return { ok: false, message: 'Base URL 不能为空' };
  }
  const ok = Math.random() > 0.15;
  return ok
    ? { ok: true, latency: 340 + Math.floor(Math.random() * 380), model: model || p?.defaultModel || 'custom', message: '连接成功' }
    : { ok: false, latency: 0, message: '连接失败：请检查 Base URL / API Key / 模型名' };
}

/** 模拟逐 token 流式输出 */
async function streamText(text: string, onDelta: (delta: string) => void): Promise<void> {
  const tokens = text.split(/(?<=[。！？\n])/);
  for (const t of tokens) {
    await delay(14 + Math.floor(Math.random() * 26));
    onDelta(t);
  }
}

/* ---------------- 分场景 canned 回复（按 action 返回不同能力） ---------------- */

const canned: Record<AIActionKey, (ctx: RunAIContext) => string> = {
  continue: (ctx) =>
    `海雾从防波堤的缝隙里一寸寸漫上来，把远处的探照灯光剪成一柄柄钝刃。${ctx.char || '陆昭'}没有立刻回答。他想起那位听友挂断电话前留下的半句话，像一粒盐，在舌尖上慢慢化开。\n\n「三十年了，」${ctx.char || '陆昭'}终于开口，声音压得很低，几乎要被浪声吞掉，「有些船出港的时候，就注定回不来了。」\n\n岸边的警戒线被风掀起一角，有人踩着泥沙走过来。${ctx.char || '陆昭'}抬眼，看见雾里站着一个不该出现在这里的人。\n\n「你果然还是查到这里了。」来人说。\n\n潮水在身后合拢，把最后一寸沙滩吞没。这个夜晚，临港的秘密第一次有了裂口。`,

  expand: () =>
    `海风从北面海岬的方向灌下来，带着盐粒和铁锈的气息，像一双无形的手，把防波堤上所有人的衣角都往同一个方向拽。探照灯的白色光柱在雾里缓缓转动，偶尔扫过人群的脸，每一张脸上都映着同一种被深夜放大过的惊惶。\n\n池遥蹲在沙坑边已经很久了。白手套的指尖捻起一块浸透海水的布料残片，又在灯光下翻来覆去地看，仿佛想从那层被盐分腐蚀得千疮百孔的纤维里，读出它主人的身份、来历，以及它沉在海底这三十年里，究竟见过什么。\n\n远处的警笛声由远及近，又被浪声拦腰截断。岸上的喧嚣像一锅没烧开的水，咕嘟咕嘟地冒着头。而陆昭站在人群边缘，比任何人都安静——他太清楚，这种寂静往往意味着，真正的风暴还远没有靠岸。`,

  polish: () =>
    `【润色稿】\n潮水退得比往常更远，仿佛海床是一床被风翻过面的旧褥子，底下压着的往事终于藏不住了。陆昭立在防波堤上，风把他的大衣下摆灌成一面旗。远处，探照灯的白光在雾里搅动，人群的喧嚣被浪声剪得断断续续。\n\n池遥蹲在沙坑边，白手套的指尖捻起一块浸透海水的布料残片，在灯下看了很久，久到周围的喧哗都安静下来。\n\n「三十年了，」他开口，「盐分把能腐蚀的都腐蚀了，可它还是认得回家的路。」\n\n陆昭没有接话。昨夜电台里那位听友的话，又一次在耳边响起——「雾散的时候，别回头。」`,

  rewrite: () =>
    `【版本 A · 克制】\n潮退了。陆昭站在防波堤上，看着探照灯把雾切开一条白色的口子。他说不上自己为什么在发抖——也许是冷，也许是别的什么。池遥蹲在沙坑边，一句话都没有。\n\n「能确定吗？」陆昭问。\n\n「确定。」池遥捻着那块布片，「它认得回家的路。」\n\n陆昭没有再问。有些答案，他宁可晚一点听到。\n\n【版本 B · 张力】\n潮水退尽的那一刻，整个临港都屏住了呼吸。陆昭攥紧大衣领口，指节发白——他比任何人都清楚，这具从海底浮上来的尸体，就是一枚被拔掉了引信的旧炸弹。池遥抬起头，目光穿过雾与光，落在陆昭脸上。\n\n「三十年了，」他的声音在浪声里显得格外清楚，「它还是认得回家的路。」\n\n远处，第一声警笛划破长夜。潮水开始回涨。倒计时，从这一刻开始。`,

  brainstorm: () =>
    `基于当前设定（《雾港潮生》· 悬疑心理群像 · 临港小城），为你提供 3 个差异化走向：\n\n【方向一 · 双生替身】\n沉尸并非顾青，而是与顾青互换身份者。三十年前七月十四夜，有人借顾青之死金蝉脱壳，真正的顾青在雾中以另一重身份活到今天——而这个人，观众早已在书中见过，只是一直被"逝者"身份挡住视线。\n冲突点：当"死者"本人现身，陆昭的报道与良知被彻底撕开。\n\n【方向二 · 灯塔的证词】\n韩伯并非目击者，而是参与者。两下灯语不只是求救信号，更是当年私运的接头暗号。韩伯的"灯塔记忆"是把双刃剑——他是唯一能指认沈氏罪证的人，也是唯一会为保护沈樱而销毁证据的人。\n冲突点：守灯人最后的选择，决定整座城的雾是散是聚。\n\n【方向三 · 电台即接头】\n「潮汐电台」从来不是巧合：节目开场白本身就是旧部属确认身份的暗号。陆昭每期念出的"各位夜航人"，都在向某个仍在监听旧电台的人传递信号。当他意识到这一点时，后台已不知何时多了一台从未插电的录音机。\n冲突点：真相不是被查出来的，是被"招"出来的。`,

  consistency: () =>
    `【一致性检查结果】\n对照世界观设定、人物设定与时间线，逐条核查如下：\n\n1. ⚠ 时间线：第 3 章沈聿舟怀表"表盖上刻着半枚徽记"，与第 4 章韩伯证词"旧情人认门的暗号"存在意象重叠——建议统一为同一徽记源（沈氏船务旧旗），并在后文回收。\n2. ✓ 人物：陆昭"左耳轻度失聪"设定在本章无冲突，可考虑在听电台来电时增加"用右耳侧听"的细节以强化记忆点。\n3. ⚠ 地理：第 2 章提到"接线板发烫"，但第 1 章设定电台位于旧船舱式直播间——建议补充一句舱内通风/老式设备的描述，避免技术细节跳脱氛围。\n4. ✓ 情绪曲线：陆昭从"旁观记录者"到"下场亲历者"的弧光推进合理，节奏无断裂。\n\n以上仅 2 处建议性调整，无需硬改。若需要，我可直接输出修订版段落。`,
};

export interface RunAIParams {
  action: AIActionKey;
  context?: RunAIContext;
  onDelta?: (delta: string) => void;
}

/**
 * 执行 AI 动作（续写/扩写/润色/改写/灵感/一致性）
 * POST /api/llm/chat   body: { config, action, context }
 * 支持 onDelta 逐 token 流式回调（模拟 SSE stream）
 */
export async function runAI({ action, context = {}, onDelta }: RunAIParams): Promise<ApiResponse<ChatReply>> {
  // TODO: replace with fetch('/api/llm/chat', { method: 'POST', body: JSON.stringify({ action, context }) })
  await delay(360);
  const reply = (canned[action] || canned.continue)(context);
  if (typeof onDelta === 'function') {
    await streamText(reply, onDelta);
  }
  return { code: 0, data: { reply } };
}

/** 统计信息存根：本周期模型用量（将来由后端累计） */
export async function fetchUsage(): Promise<ApiResponse<UsageData>> {
  // TODO: replace with fetch('/api/llm/usage')
  await delay(500);
  return {
    code: 0,
    data: {
      monthCalls: 1286,
      monthTokens: 1_420_000,
      dayCalls: 47,
      dayTokens: 52_000,
      cached: 0.62,
    },
  };
}
