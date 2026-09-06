/* ============================================================
   砚墨 · 后端 — 大模型代理
   ------------------------------------------------------------
   转发任意 OpenAI 兼容接口（/chat/completions，SSE 流式）。
   未配置 Key 或调用失败时，降级用内置文案模拟流式输出，
   保证前端体验不塌。用量写入 usage_events。
   ============================================================ */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getSetting, recordUsage } from './repo.ts';
import {
  str,
  type AIAction,
  type ConnInput,
  type LLMConfig,
  type Provider,
  type RunResult,
  type SeedShape,
  type TestResult,
} from './types.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const SEED = JSON.parse(readFileSync(join(HERE, '..', 'shared', 'seed.json'), 'utf8')) as SeedShape;

/* Provider 目录（与前端共用 shared/providers.json） */
export const PROVIDERS: Provider[] = JSON.parse(
  readFileSync(join(HERE, '..', 'shared', 'providers.json'), 'utf8'),
) as Provider[];

/* ---------------- 内置文案（无 Key / 调用失败时兜底） ---------------- */

const canned: Record<AIAction, (ctx: Record<string, unknown>) => string> = {
  continue: (ctx) =>
    `海雾从防波堤的缝隙里一寸寸漫上来，把远处的探照灯光剪成一柄柄钝刃。${str(ctx.char) || '陆昭'}没有立刻回答。他想起那位听友挂断电话前留下的半句话，像一粒盐，在舌尖上慢慢化开。\n\n「三十年了，」${str(ctx.char) || '陆昭'}终于开口，声音压得很低，几乎要被浪声吞掉，「有些船出港的时候，就注定回不来了。」\n\n岸边的警戒线被风掀起一角，有人踩着泥沙走过来。${str(ctx.char) || '陆昭'}抬眼，看见雾里站着一个不该出现在这里的人。\n\n「你果然还是查到这里了。」来人说。\n\n潮水在身后合拢，把最后一寸沙滩吞没。这个夜晚，临港的秘密第一次有了裂口。`,
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
  draft: () =>
    `潮声比人先到。${'陆昭'}踩着湿漉漉的石阶走上防波堤时，雾正从海面往岸上漫，像一封迟迟不肯拆开的旧信。\n\n他今晚不是来看海的。口袋里那张被海水泡皱的登船牌硌着掌心——三十年前的名字已经晕开，只剩姓氏还倔强地立着。探照灯在雾里扫过一圈又一圈，光柱每次掠过堤岸，人群里就响起一阵压低的骚动，仿佛沉船的回声正借着人的喉咙往上冒。\n\n「你真的要查下去？」身后有人问。声音很轻，轻得像是替他担心，又像是替谁试探。\n\n陆昭没有回头。他把登船牌翻过来又翻过去，最后收进口袋，只说了一句：「潮水都替我记了三十年，我没理由比潮水先忘。」\n\n远处，两声船笛穿过雾幕，一长一短，像求救，也像认门。他加快了脚步——今夜的雾再深，也深不过三十年前那一场。`,
};

/* ---------------- 配置 ---------------- */

export function getLLMConfig(): LLMConfig {
  return getSetting('llm', SEED.llm) as LLMConfig;
}

export function configReady(cfg: LLMConfig): boolean {
  return Boolean(cfg && cfg.baseUrl && cfg.apiKey && cfg.model);
}

/* ---------------- Prompt ---------------- */

const ACTION_LABEL: Record<AIAction, string> = {
  continue: '续写', expand: '扩写', polish: '润色',
  rewrite: '改写', brainstorm: '灵感', consistency: '一致性检查', draft: '一键成稿',
};

/* 各动作的兜底提示词（用户配置里没有对应模板时使用） */
const DEFAULT_PROMPTS: Partial<Record<AIAction, string>> = {
  draft: `【一键成稿】你是这部小说的作者。请依据下方给出的「世界观设定」「前情提要」与「情节大纲」，为「本章要写的节拍」创作一章正文初稿（1200–2000 字）。
要求：
- 开篇必须无缝衔接「上一章结尾原文」的场景、时间与情绪，像同一支笔不间断地写下去；禁止重复交代前文已知信息，禁止凭空跳时间、跳场景。
- 人物言行必须与「前情提要」中已建立的状态一致，沿用已出现的人物称呼与说话方式。
- 延续已有正文的文风、叙事视角与节奏（若有）。
- 严格在世界观设定范围内写作，落实本拍的核心冲突。
- 结尾必须为「下一章节拍」埋下明确的钩子，让读者想立刻读下一章。
- 直接输出正文，不要标题、不要任何解释说明。`,
};

function buildUserPrompt(cfg: LLMConfig, action: AIAction, ctx: Record<string, unknown>): string {
  const tpl = cfg?.actions?.[action] || DEFAULT_PROMPTS[action] || `【${ACTION_LABEL[action] || action}】请完成以下创作任务。`;
  const parts = [tpl];
  const ctxLines: string[] = [];
  if (ctx.title) ctxLines.push(`章节标题：${str(ctx.title)}`);
  if (ctx.char) ctxLines.push(`主要视角人物：${str(ctx.char)}`);
  if (ctx.genre) ctxLines.push(`作品类型：${str(ctx.genre)}`);
  if (ctx.world) ctxLines.push(`\n世界观设定：\n${String(ctx.world).slice(0, 3000)}`);
  if (ctx.recap) ctxLines.push(`\n前情提要（按章节顺序，人物与事件以此为准）：\n${String(ctx.recap).slice(0, 2000)}`);
  if (ctx.plot) ctxLines.push(`\n情节大纲：\n${String(ctx.plot).slice(0, 2200)}`);
  if (ctx.prevEnding) ctxLines.push(`\n上一章结尾原文（新章开头必须无缝衔接此场景）：\n…${String(ctx.prevEnding).slice(-1400)}`);
  if (ctx.nextBeat) ctxLines.push(`\n下一章节拍（本章结尾为其埋钩子）：${str(ctx.nextBeat)}`);
  if (ctx.beat) ctxLines.push(`\n本章要写的节拍：${str(ctx.beat)}`);
  if (ctx.content) ctxLines.push(`\n已有正文（本章之前，供衔接文风）：\n${String(ctx.content).slice(-3000)}`);
  if (ctxLines.length) parts.push(`\n---\n${ctxLines.join('\n')}`);
  /* 成稿动作的衔接铁律——无论用户自定义模板写了什么都追加，保证章节连贯 */
  if (action === 'draft') {
    parts.push(
      `\n---\n衔接铁律（必须遵守）：\n1. 若给出「上一章结尾原文」，本章第一段必须从该场景、该时间点、该情绪直接续写，不允许重开场景或复述前情。\n2. 若给出「前情提要」，人物关系、称谓、已发生事件必须完全一致，不得出现与提要矛盾的描写。\n3. 若给出「下一章节拍」，最后一段必须向它收束并留钩子。`,
    );
  }
  return parts.join('\n');
}

/* ---------------- 流式转发 ---------------- */

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const estimateTokens = (s: string): number => Math.max(1, Math.ceil(String(s).length / 1.5));

interface ChatChunk {
  choices?: { delta?: { content?: string } }[];
}

async function streamCanned(text: string, onDelta: (delta: string) => void): Promise<string> {
  const chunks = text.split(/(?<=[。！？\n])/);
  for (const c of chunks) {
    await sleep(14 + Math.floor(Math.random() * 26));
    onDelta(c);
  }
  return text;
}

async function streamUpstream(
  cfg: LLMConfig,
  action: AIAction,
  ctx: Record<string, unknown>,
  onDelta: (delta: string) => void,
): Promise<string> {
  const url = `${cfg.baseUrl?.replace(/\/+$/, '')}/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      stream: true,
      temperature: cfg.temperature ?? 0.8,
      max_tokens: cfg.maxTokens ?? 2048,
      top_p: cfg.topP ?? 0.95,
      messages: [
        { role: 'system', content: cfg.systemPrompt || '' },
        { role: 'user', content: buildUserPrompt(cfg, action, ctx) },
      ],
    }),
    signal: AbortSignal.timeout(180_000),
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => '');
    throw new Error(`上游返回 ${res.status}：${detail.slice(0, 200)}`);
  }

  const decoder = new TextDecoder();
  let buf = '';
  let full = '';
  for await (const chunk of res.body) {
    buf += decoder.decode(chunk, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith('data:')) continue;
      const payload = t.slice(5).trim();
      if (payload === '[DONE]') continue;
      try {
        const json = JSON.parse(payload) as ChatChunk;
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) {
          full += delta;
          onDelta(delta);
        }
      } catch {
        /* 忽略无法解析的心跳行 */
      }
    }
  }
  return full;
}

/**
 * 执行创作动作，逐段回调 onDelta。
 */
export async function runAI(
  action: AIAction,
  ctx: Record<string, unknown>,
  onDelta: (delta: string) => void = () => {},
): Promise<RunResult> {
  const cfg = getLLMConfig();
  let reply = '';
  let source: RunResult['source'] = 'canned';
  let error: string | undefined;

  if (configReady(cfg)) {
    try {
      reply = await streamUpstream(cfg, action, ctx, onDelta);
      source = 'upstream';
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      reply = '';
    }
  }

  if (!reply) {
    const text = (canned[action] ?? canned.continue)(ctx);
    reply = await streamCanned(text, onDelta);
    source = 'canned';
  }

  recordUsage(action, estimateTokens(reply), source === 'canned' ? 1 : 0);
  return { reply, source, error };
}

/* ---------------- 实体提取（非流式，供「同步角色/势力」用） ---------------- */

export interface ExtractedEntities {
  characters: { name: string; identity: string }[];
  factions: { name: string; desc: string }[];
  /** 失败原因（成功时不存在） */
  error?: string;
}

const EXTRACT_PROMPT = `你是小说设定助理。从下面的正文中提取「人物」与「势力/组织」。
要求：
- 只提取有明确名字的实体；称谓、代词、无名路人不要。
- 人物 identity 用一句话概括身份（没有依据就留空字符串）。
- 势力 desc 用一句话概括性质（没有依据就留空字符串）。
- 不要把同一个名字重复列出。最多各 20 条。
- 只输出 JSON，不要任何解释、不要代码块围栏，格式：
{"characters":[{"name":"名字","identity":"一句话身份"}],"factions":[{"name":"势力名","desc":"一句话性质"}]}

正文：
`;

/** 用已配置的大模型从正文提取人物/势力；带失败原因 */
export async function extractEntities(text: string): Promise<ExtractedEntities> {
  const cfg = getLLMConfig();
  if (!configReady(cfg)) {
    return { characters: [], factions: [], error: '未配置大模型：请到「设置」填写 Base URL、API Key 与模型名' };
  }
  try {
    const res = await fetch(`${cfg.baseUrl?.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        stream: false,
        temperature: 0.2,
        max_tokens: 2048,
        messages: [{ role: 'user', content: EXTRACT_PROMPT + text.slice(-12000) }],
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return { characters: [], factions: [], error: `大模型返回 ${res.status}：${detail.slice(0, 200)}` };
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content ?? '';
    const m = content.match(/\{[\s\S]*\}/);
    if (!m) {
      return { characters: [], factions: [], error: '大模型输出中没有 JSON，无法解析（可重试一次）' };
    }
    const parsed = JSON.parse(m[0]) as {
      characters?: { name?: unknown; identity?: unknown }[];
      factions?: { name?: unknown; desc?: unknown }[];
    };
    const pickName = (v: unknown): string => (typeof v === 'string' ? v.trim().slice(0, 30) : '');
    const characters = (Array.isArray(parsed.characters) ? parsed.characters : [])
      .map((x) => ({ name: pickName(x?.name), identity: typeof x?.identity === 'string' ? x.identity.trim() : '' }))
      .filter((x) => x.name);
    const factions = (Array.isArray(parsed.factions) ? parsed.factions : [])
      .map((x) => ({ name: pickName(x?.name), desc: typeof x?.desc === 'string' ? x.desc.trim() : '' }))
      .filter((x) => x.name);
    if (!characters.length && !factions.length) {
      return { characters: [], factions: [], error: '这段文本里没有识别出明确的人物或势力' };
    }
    return { characters, factions };
  } catch (e) {
    return { characters: [], factions: [], error: `调用大模型失败：${e instanceof Error ? e.message : String(e)}` };
  }
}

/* ---------------- 世界观提炼（非流式，供「从文本提炼世界观」用） ---------------- */

export interface ExtractedWorldSection {
  type: string;
  title: string;
  desc: string;
  items: { title: string; desc: string }[];
}

const WORLD_EXTRACT_PROMPT = `你是小说世界观设定助理。用户会给你一份很长的原始文本（可能是历史资料、草稿、笔记、旧稿或任意素材），请把其中能用到的世界观信息提炼成结构化设定。

要求：
- 把信息组织为若干「分区」，每个分区有 type（分类，如：地理、历史、势力、规则、种族、科技、宗教、经济等，可自拟但保持简短）、title（分区标题）、desc（分区一句话概述）、items（该分区下的具体设定条目）。
- 每个条目：title 是设定的名字（地名/组织名/事件名/规则名等），desc 是 1~3 句话的具体描述。
- 只提炼文本中有依据的内容，不要凭空编造；宁可少而准。
- 条目名不要重复；每个分区条目最多 15 条，分区最多 10 个。
- 只输出 JSON，不要任何解释、不要代码块围栏，格式：
{"sections":[{"type":"地理","title":"分区标题","desc":"一句话概述","items":[{"title":"条目名","desc":"具体描述"}]}]}

原始文本：
`;

export interface ExtractedWorldResult {
  sections: ExtractedWorldSection[];
  /** 失败原因（成功时不存在） */
  error?: string;
}

/** 用已配置的大模型从长文本提炼世界观；带失败原因 */
export async function extractWorld(text: string): Promise<ExtractedWorldResult> {
  const cfg = getLLMConfig();
  if (!configReady(cfg)) {
    return { sections: [], error: '未配置大模型：请到「设置」填写 Base URL、API Key 与模型名' };
  }
  try {
    const res = await fetch(`${cfg.baseUrl?.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        stream: false,
        temperature: 0.3,
        max_tokens: 4096,
        messages: [{ role: 'user', content: WORLD_EXTRACT_PROMPT + text.slice(0, 20000) }],
      }),
      signal: AbortSignal.timeout(180_000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return { sections: [], error: `大模型返回 ${res.status}：${detail.slice(0, 200)}` };
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content ?? '';
    const m = content.match(/\{[\s\S]*\}/);
    if (!m) {
      return { sections: [], error: '大模型输出中没有 JSON，无法解析（可重试一次）' };
    }
    const parsed = JSON.parse(m[0]) as {
      sections?: {
        type?: unknown;
        title?: unknown;
        desc?: unknown;
        items?: { title?: unknown; desc?: unknown }[];
      }[];
    };
    const sections = (Array.isArray(parsed.sections) ? parsed.sections : [])
      .map((s) => {
        const type = typeof s?.type === 'string' ? s.type.trim().slice(0, 20) : '';
        const items = (Array.isArray(s?.items) ? s.items : [])
          .map((it) => ({
            title: typeof it?.title === 'string' ? it.title.trim().slice(0, 60) : '',
            desc: typeof it?.desc === 'string' ? it.desc.trim().slice(0, 500) : '',
          }))
          .filter((it) => it.title);
        return {
          type,
          title: typeof s?.title === 'string' ? s.title.trim().slice(0, 40) : '',
          desc: typeof s?.desc === 'string' ? s.desc.trim().slice(0, 200) : '',
          items,
        };
      })
      .filter((s) => s.type && s.items.length > 0);
    if (!sections.length) {
      return { sections: [], error: '大模型没有提炼出有效的世界观条目，可换段更详细的文本重试' };
    }
    return { sections };
  } catch (e) {
    return { sections: [], error: `调用大模型失败：${e instanceof Error ? e.message : String(e)}` };
  }
}

/* ---------------- 情节节拍提炼 ---------------- */

const PLOT_EXTRACT_PROMPT = `你是小说情节大纲助理。用户会给你一份原始素材（可能是草稿、笔记、旧稿、梗概或任意文本），请把其中的剧情提炼为按顺序排列的「节拍」（beat），每个节拍是剧情推进的最小单元。

用户已有的三幕结构如下（幕名 / 阶段 phase）：
{ACTS}

要求：
- 每个节拍必须归入上述某个 phase，写入 actPhase 字段（只能从给出的 phase 里选，不要自创）。
- type 从这些里选一个：引子 / 承 / 转 / 高潮 / 合。
- chapterNo 是数字，按剧情先后顺序编排章节号（从 1 开始递增，可跳号留白）。
- title 是本拍的简短标题（10 字以内）；summary 是 1~3 句概括本拍发生什么；conflict 是本拍的核心张力/冲突（可为空字符串）。
- pov 是本拍的叙述视角人物名；只有文本中有明确依据才填，否则留空字符串。
- 只提炼文本中有依据的剧情，不要凭空编造；宁可少而准。节拍最多 30 个。
- 只输出 JSON，不要任何解释、不要代码块围栏，格式：
{"beats":[{"actPhase":"起","type":"引子","chapterNo":1,"title":"节拍标题","summary":"发生了什么","conflict":"核心冲突","pov":"视角人物"}]}

原始文本：
`;

export interface ExtractedPlotBeat {
  actPhase: string;
  type: string;
  chapterNo: number;
  title: string;
  summary: string;
  conflict: string;
  pov: string;
}

export interface ExtractedPlotResult {
  beats: ExtractedPlotBeat[];
  /** 失败原因（成功时不存在） */
  error?: string;
}

/** 用已配置的大模型从文本提炼情节节拍；acts 为用户现有幕结构（用于归幕） */
export async function extractPlot(
  text: string,
  acts: { name: string; phase: string }[],
): Promise<ExtractedPlotResult> {
  const cfg = getLLMConfig();
  if (!configReady(cfg)) {
    return { beats: [], error: '未配置大模型：请到「设置」填写 Base URL、API Key 与模型名' };
  }
  const actsDesc = acts.length
    ? acts.map((a, i) => `${i + 1}. 幕「${a.name}」 phase=${a.phase}`).join('\n')
    : '（用户还没有建幕，actPhase 统一填「起」）';
  try {
    const res = await fetch(`${cfg.baseUrl?.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        stream: false,
        temperature: 0.4,
        max_tokens: 4096,
        messages: [{ role: 'user', content: PLOT_EXTRACT_PROMPT.replace('{ACTS}', actsDesc) + text.slice(0, 20000) }],
      }),
      signal: AbortSignal.timeout(180_000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return { beats: [], error: `大模型返回 ${res.status}：${detail.slice(0, 200)}` };
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content ?? '';
    const m = content.match(/\{[\s\S]*\}/);
    if (!m) {
      return { beats: [], error: '大模型输出中没有 JSON，无法解析（可重试一次）' };
    }
    const parsed = JSON.parse(m[0]) as {
      beats?: {
        actPhase?: unknown;
        type?: unknown;
        chapterNo?: unknown;
        title?: unknown;
        summary?: unknown;
        conflict?: unknown;
        pov?: unknown;
      }[];
    };
    const validPhases = new Set(acts.map((a) => a.phase));
    const validTypes = new Set(['引子', '承', '转', '高潮', '合']);
    const fallbackPhase = acts[0]?.phase ?? '起';
    const beats = (Array.isArray(parsed.beats) ? parsed.beats : [])
      .map((b, i) => {
        const actPhase =
          typeof b?.actPhase === 'string' && validPhases.has(b.actPhase.trim()) ? b.actPhase.trim() : fallbackPhase;
        const type = typeof b?.type === 'string' && validTypes.has(b.type.trim()) ? b.type.trim() : '承';
        const chapterNo = typeof b?.chapterNo === 'number' && Number.isFinite(b.chapterNo) ? Math.round(b.chapterNo) : i + 1;
        return {
          actPhase,
          type,
          chapterNo,
          title: typeof b?.title === 'string' ? b.title.trim().slice(0, 60) : '',
          summary: typeof b?.summary === 'string' ? b.summary.trim().slice(0, 500) : '',
          conflict: typeof b?.conflict === 'string' ? b.conflict.trim().slice(0, 200) : '',
          pov: typeof b?.pov === 'string' ? b.pov.trim().slice(0, 30) : '',
        };
      })
      .filter((b) => b.title);
    if (!beats.length) {
      return { beats: [], error: '大模型没有提炼出有效的节拍，可换段更详细的剧情文本重试' };
    }
    return { beats };
  } catch (e) {
    return { beats: [], error: `调用大模型失败：${e instanceof Error ? e.message : String(e)}` };
  }
}

/* ---------------- 连接测试 / 模型列表 ---------------- */

export async function testConnection(input: ConnInput): Promise<TestResult> {
  const started = Date.now();
  const provider = input.provider ?? '';
  const p = PROVIDERS.find((x) => x.id === provider);
  if (provider !== 'custom' && !input.apiKey) {
    return { ok: false, latency: 0, message: '未填写 API Key' };
  }
  if (!input.baseUrl) {
    return { ok: false, latency: 0, message: 'Base URL 不能为空' };
  }
  try {
    const res = await fetch(`${input.baseUrl.replace(/\/+$/, '')}/models`, {
      headers: { Authorization: `Bearer ${input.apiKey}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      return { ok: false, latency: Date.now() - started, message: `连接失败：上游返回 ${res.status}` };
    }
    return {
      ok: true,
      latency: Date.now() - started,
      model: input.model || p?.defaultModel || 'custom',
      message: '连接成功',
    };
  } catch (e) {
    return {
      ok: false,
      latency: Date.now() - started,
      message: `连接失败：${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

/** 有 Key 就拉真实模型列表，否则回落到内置目录 */
export async function listModels(providerId: string, override?: LLMConfig): Promise<string[]> {
  const p = PROVIDERS.find((x) => x.id === providerId);
  if (providerId === 'custom') return ['自定义（将直接使用下方 Base URL 与模型名）'];
  if (!p) return [];

  const cfg = override ?? getLLMConfig();
  if (cfg?.baseUrl && cfg?.apiKey) {
    try {
      const res = await fetch(`${cfg.baseUrl.replace(/\/+$/, '')}/models`, {
        headers: { Authorization: `Bearer ${cfg.apiKey}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) {
        const json = (await res.json()) as { data?: { id?: string }[] };
        const ids = (json.data ?? []).map((m) => m.id ?? '').filter(Boolean);
        if (ids.length) return [...ids].sort();
      }
    } catch {
      /* 拉取失败就回落内置列表 */
    }
  }
  return p.models;
}
