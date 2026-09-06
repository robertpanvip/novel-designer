/* ============================================================
   砚墨 · 小说设计器 — 大模型配置页（Settings）
   ------------------------------------------------------------
   接入任意 OpenAI 兼容大模型。配置通过 useStore() 的 setLLM
   实时写入 store 并持久化到 localStorage；API Key 仅存本地，
   绝不外发。模型列表 / 连接测试 / 用量统计走 llm.ts 存根层。
   ============================================================ */
import { useEffect, useState } from 'react';
import {
  Cpu, Eye, EyeOff, Plug, Save, RotateCcw, Check, ChevronDown,
  PenLine, Expand, Sparkles, RefreshCw, Lightbulb, ShieldCheck, FileText,
  CheckCircle2, XCircle, Wand2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  Button, IconBtn, Field, Input, Select, Textarea, Tag, Card,
  SectionHead, PageHead, EmptyState, Slider,
} from '../components/ui';
import { useStore } from '../store/AppStore';
import { PROVIDERS, listModels, testConnection, fetchUsage } from '../api/llm';
import type { TestResult } from '../api/llm';
import { IMAGE_PROVIDERS, IMAGE_DEFAULT, testImageConnection, SIZE_POOL } from '../api/image';
import type { ImageTestResult } from '../api/image';
import type { AIActionKey, Provider, UsageData } from '../types';

/* 六种创作能力 + 一键成稿的动作元信息（对应 llm.actions 的键） */
const ACTION_META: { key: AIActionKey; label: string; icon: LucideIcon; hint: string }[] = [
  { key: 'continue', label: '续写', icon: PenLine, hint: '顺着已有文风自然续写 300–500 字' },
  { key: 'expand', label: '扩写', icon: Expand, hint: '丰富细节与层次，扩至原稿 1.5–2 倍' },
  { key: 'polish', label: '润色', icon: Sparkles, hint: '优化节奏、画面感与声韵' },
  { key: 'rewrite', label: '改写', icon: RefreshCw, hint: '以不同视角或语气重写' },
  { key: 'brainstorm', label: '灵感', icon: Lightbulb, hint: '给出差异化剧情走向' },
  { key: 'consistency', label: '一致性', icon: ShieldCheck, hint: '对照设定检查冲突与矛盾' },
  { key: 'draft', label: '成稿', icon: FileText, hint: '依据世界观与情节大纲生成整章初稿（工作台「一键成稿」使用）' },
];

/* 用量统计小方块 */
function UsageStat({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '14px 16px' }}>
      <div className="mono" style={{ fontSize: 19, fontWeight: 600, lineHeight: 1.15, color: 'var(--text)' }}>{value}</div>
      <div className="sub" style={{ fontSize: 12, marginTop: 5 }}>{label}</div>
    </div>
  );
}

export default function Settings() {
  const { project, llm, img, actions } = useStore();
  const currentProvider = PROVIDERS.find((p) => p.id === llm.provider);
  const imgProvider = IMAGE_PROVIDERS.find((p) => p.id === img.provider);

  /* ===== 作品信息表单（独立本地态，显式保存） ===== */
  const [pTitle, setPTitle] = useState(project.title);
  const [pTagline, setPTagline] = useState(project.tagline);
  const [pGenre, setPGenre] = useState(project.genre);
  const [pSynopsis, setPSynopsis] = useState(project.synopsis);
  const [pCover, setPCover] = useState(project.cover);
  const projectDirty =
    pTitle !== project.title ||
    pTagline !== project.tagline ||
    pGenre !== project.genre ||
    pSynopsis !== project.synopsis ||
    pCover !== project.cover;
  const saveProject = () => {
    const title = pTitle.trim();
    if (!title) {
      actions.toast('书名不能为空', 'warning');
      return;
    }
    actions.updateProject({
      title,
      tagline: pTagline.trim(),
      genre: pGenre.trim(),
      synopsis: pSynopsis,
      cover: pCover.trim(),
    });
    actions.toast('作品信息已保存', 'success');
  };
  const resetProjectForm = () => {
    setPTitle(project.title);
    setPTagline(project.tagline);
    setPGenre(project.genre);
    setPSynopsis(project.synopsis);
    setPCover(project.cover);
  };

  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const [imgTesting, setImgTesting] = useState(false);
  const [imgTestResult, setImgTestResult] = useState<ImageTestResult | null>(null);

  const [models, setModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  const [usage, setUsage] = useState<UsageData | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);

  const [openAct, setOpenAct] = useState<AIActionKey | null>(null);

  /* 模型列表：随 provider 变化异步加载 */
  useEffect(() => {
    let alive = true;
    setModelsLoading(true);
    listModels(llm.provider)
      .then((list) => { if (alive) { setModels(list || []); setModelsLoading(false); } })
      .catch(() => { if (alive) { setModels([]); setModelsLoading(false); } });
    return () => { alive = false; };
  }, [llm.provider]);

  /* 用量统计：TODO: 接入真实后端统计 */
  useEffect(() => {
    let alive = true;
    fetchUsage()
      .then((res) => { if (alive) { setUsage(res.data); setUsageLoading(false); } })
      .catch(() => { if (alive) setUsageLoading(false); });
    return () => { alive = false; };
  }, []);

  /* 选择服务商：自动带入 baseUrl 与默认模型 */
  const selectProvider = (p: Provider) => {
    setTestResult(null);
    actions.setLLM({ provider: p.id, baseUrl: p.baseUrl, model: p.defaultModel, connected: false });
  };

  /* 测试连接 */
  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    const res = await testConnection({
      provider: llm.provider,
      baseUrl: llm.baseUrl,
      apiKey: llm.apiKey,
      model: llm.model,
    });
    setTesting(false);
    if (res.ok) {
      actions.setLLM({
        connected: true,
        lastTest: {
          at: new Date().toLocaleString('zh-CN', { hour12: false }),
          latency: res.latency,
          model: res.model,
        },
      });
      setTestResult(res);
      actions.toast('连接成功', 'success');
    } else {
      actions.setLLM({ connected: false });
      setTestResult(res);
      actions.toast(res.message || '连接失败', 'danger');
    }
  };

  /* 保存配置：显式持久化并提示 */
  const saveConfig = () => {
    actions.saveLLM({
      provider: llm.provider,
      baseUrl: llm.baseUrl.trim(),
      apiKey: llm.apiKey,
      model: llm.model.trim(),
      temperature: llm.temperature,
      maxTokens: llm.maxTokens,
      topP: llm.topP,
      systemPrompt: llm.systemPrompt,
      actions: { ...llm.actions },
    });
  };

  /* 恢复默认：清空本地模型配置后刷新，store 回落至内置默认值 */
  const resetDefaults = () => {
    if (window.confirm('确定恢复默认配置？本地保存的模型配置将被清空并刷新页面。')) {
      localStorage.removeItem('yanmo-llm');
      actions.toast('已恢复默认配置', 'success');
      setTimeout(() => window.location.reload(), 600);
    }
  };

  /* AI 配图：测试图片服务 */
  const runImgTest = async () => {
    setImgTesting(true);
    setImgTestResult(null);
    const res = await testImageConnection({
      provider: img.provider,
      baseUrl: img.baseUrl,
      apiKey: img.apiKey,
    });
    setImgTesting(false);
    if (res.ok) {
      actions.setImg({ connected: true, lastTest: { at: new Date().toLocaleString('zh-CN', { hour12: false }), latency: res.latency } });
      setImgTestResult(res);
      actions.toast('配图服务可用', 'success');
    } else {
      actions.setImg({ connected: false });
      setImgTestResult(res);
      actions.toast(res.message || '配图服务测试失败', 'danger');
    }
  };

  /* AI 配图：保存配置 */
  const saveImgConfig = () => {
    actions.saveImg({
      provider: img.provider,
      style: img.style.trim(),
      size: img.size,
      sceneSize: img.sceneSize,
      seed: Number(img.seed) || IMAGE_DEFAULT.seed,
      baseUrl: (img.baseUrl || '').trim(),
      apiKey: img.apiKey || '',
    });
  };

  const modelOptions = models.length ? models : currentProvider?.models || [];

  return (
    <>
      <PageHead
        title="设置"
        sub="管理作品信息、接入大模型与配图服务。作品信息改动后会在工作台、侧栏即时生效。"
        actions={
          <Tag tone={llm.connected ? 't-success' : undefined} style={{ gap: 6 }}>
            <span
              style={{
                width: 7, height: 7, borderRadius: '50%', display: 'inline-block',
                background: llm.connected ? 'var(--success)' : 'var(--text-faint)',
                boxShadow: llm.connected ? '0 0 8px var(--success)' : 'none',
              }}
            />
            {llm.connected ? '已连接' : '未连接'}
          </Tag>
        }
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ---- 0. 作品信息 ---- */}
        <Card className="reveal" style={{ '--d': '0ms', padding: '20px 22px' }}>
          <SectionHead
            title="作品信息"
            sub="书名与基础元数据，会显示在工作台与侧栏标题处"
          />
          <Field label="书名 *" hint="作品的主标题，保存后会立即同步到工作台与侧栏">
            <Input
              value={pTitle}
              onChange={(e) => setPTitle(e.target.value)}
              placeholder="如：雾港潮生"
            />
          </Field>
          <Field label="一句话标签" hint="副标题或宣传语，会显示在工作台">
            <Input
              value={pTagline}
              onChange={(e) => setPTagline(e.target.value)}
              placeholder="如：一座雾港，三十年的秘密"
            />
          </Field>
          <Field label="类型" hint="体裁分类（悬疑 / 都市 / 奇幻…）">
            <Input
              value={pGenre}
              onChange={(e) => setPGenre(e.target.value)}
              placeholder="如：悬疑 · 都市"
            />
          </Field>
          <Field label="简介" hint="故事的整体设定与主线">
            <Textarea
              rows={4}
              value={pSynopsis}
              onChange={(e) => setPSynopsis(e.target.value)}
              placeholder="故事发生在…"
            />
          </Field>
          <Field label="封面 URL" hint="可选；留空则使用默认封面">
            <Input
              value={pCover}
              onChange={(e) => setPCover(e.target.value)}
              placeholder="https://…"
            />
          </Field>
          <div className="row-between" style={{ marginTop: 4 }}>
            <Button variant="ghost" icon={RotateCcw} onClick={resetProjectForm} disabled={!projectDirty}>
              放弃修改
            </Button>
            <Button variant="primary" icon={Save} onClick={saveProject} disabled={!projectDirty}>
              保存作品信息
            </Button>
          </div>
        </Card>

        {/* ---- 1. 服务商选择 ---- */}
        <Card className="reveal" style={{ '--d': '40ms', padding: '20px 22px' }}>
          <SectionHead
            title="选择模型服务商"
            sub="点击卡片即可切换，并自动带入该服务商的 Base URL 与默认模型"
          />
          <div className="grid grid-3" style={{ gap: 12 }}>
            {PROVIDERS.map((p, i) => {
              const sel = p.id === llm.provider;
              return (
                <Card
                  key={p.id}
                  hoverable
                  className="reveal"
                  onClick={() => selectProvider(p)}
                  style={{
                    '--d': `${40 + i * 20}ms`,
                    padding: '14px 16px',
                    cursor: 'pointer',
                    borderColor: sel ? 'var(--primary)' : undefined,
                    boxShadow: sel ? '0 0 0 1px var(--primary), 0 8px 22px rgba(229,83,61,0.14)' : undefined,
                  }}
                >
                  <div className="row-between" style={{ gap: 8 }}>
                    <div className="row" style={{ gap: 8, minWidth: 0 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: p.badge, flex: 'none' }} />
                      <span className="display" style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>{p.name}</span>
                    </div>
                    {sel && <Check size={16} style={{ color: 'var(--primary)', flex: 'none' }} />}
                  </div>
                  <div className="sub" style={{ fontSize: 12, marginTop: 7 }}>{p.desc}</div>
                </Card>
              );
            })}
          </div>
          {!currentProvider && (
            <EmptyState
              icon={Cpu}
              title="尚未选择模型服务商"
              desc="请选择上方任一 Provider，或使用「自定义 · OpenAI 兼容」接入本地 Ollama / vLLM 等接口。"
            />
          )}
        </Card>

        {/* ---- 2. 连接配置 ---- */}
        <Card className="reveal" style={{ '--d': '80ms', padding: '20px 22px' }}>
          <SectionHead title="连接配置" sub="OpenAI 兼容接口的访问参数" />
          <Field label="Base URL" hint="接口根地址，通常以 /v1 结尾">
            <Input
              value={llm.baseUrl}
              onChange={(e) => actions.setLLM({ baseUrl: e.target.value })}
              placeholder="https://api.deepseek.com/v1"
            />
          </Field>
          <Field label="API Key" hint="仅保存在本机 localStorage，不会上传；未填写时测试连接会给出提示">
            <div className="row" style={{ gap: 8 }}>
              <Input
                className="grow"
                type={showKey ? 'text' : 'password'}
                value={llm.apiKey}
                onChange={(e) => actions.setLLM({ apiKey: e.target.value })}
                placeholder="sk-…"
                autoComplete="off"
              />
              <IconBtn icon={showKey ? EyeOff : Eye} label={showKey ? '隐藏密钥' : '显示密钥'} onClick={() => setShowKey((v) => !v)} />
            </div>
          </Field>
          <Field label="模型" hint={currentProvider?.id === 'custom' ? '自定义模型名，将直接用于请求' : '该服务商提供的可用模型'}>
            {currentProvider?.id === 'custom' ? (
              <Input
                value={llm.model}
                onChange={(e) => actions.setLLM({ model: e.target.value })}
                placeholder="如 qwen2.5 / llama3 / deepseek-chat"
              />
            ) : modelsLoading ? (
              <div className="skeleton" style={{ height: 38 }} />
            ) : (
              <Select value={llm.model} onChange={(e) => actions.setLLM({ model: e.target.value })}>
                {modelOptions.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </Select>
            )}
          </Field>
          <div className="row-between" style={{ marginTop: 4 }}>
            <div className="row" style={{ gap: 10 }}>
              <Button variant="outline" icon={Plug} loading={testing} onClick={runTest}>测试连接</Button>
              {llm.lastTest && !testing && (
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                  上次测试：{llm.lastTest.at} · {llm.lastTest.latency}ms
                </span>
              )}
            </div>
            {currentProvider?.needsKey && !llm.apiKey && (
              <span className="faint" style={{ fontSize: 11.5 }}>尚未填写 API Key，测试将提示失败</span>
            )}
          </div>
          {/* 测试结果条 */}
          {testResult && (
            testResult.ok ? (
              <div style={{ marginTop: 14, background: 'var(--success-soft)', border: '1px solid rgba(76,175,125,0.4)', borderRadius: 'var(--r-md)', padding: '12px 14px' }}>
                <div className="row" style={{ color: '#6fd69e', gap: 7 }}>
                  <CheckCircle2 size={16} />
                  <span style={{ fontWeight: 600, fontSize: 13 }}>连接成功 · {testResult.latency}ms</span>
                </div>
                <div className="mono" style={{ fontSize: 11.5, color: 'var(--text-sub)', marginTop: 5 }}>{testResult.model} · {testResult.message}</div>
              </div>
            ) : (
              <div style={{ marginTop: 14, background: 'var(--danger-soft)', border: '1px solid rgba(229,83,61,0.4)', borderRadius: 'var(--r-md)', padding: '12px 14px' }}>
                <div className="row" style={{ color: '#f27a66', gap: 7 }}>
                  <XCircle size={16} />
                  <span style={{ fontWeight: 600, fontSize: 13 }}>连接失败</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 5 }}>{testResult.message}</div>
              </div>
            )
          )}
        </Card>

        {/* ---- 3. 生成参数 ---- */}
        <Card className="reveal" style={{ '--d': '120ms', padding: '20px 22px' }}>
          <SectionHead title="生成参数" sub="控制模型输出的随机性与长度" />
          <Slider
            label="温度 Temperature"
            value={llm.temperature}
            min={0} max={2} step={0.05}
            onChange={(v) => actions.setLLM({ temperature: v })}
            fmt={(v) => v.toFixed(2)}
          />
          <Slider
            label="Top-P"
            value={llm.topP}
            min={0} max={1} step={0.05}
            onChange={(v) => actions.setLLM({ topP: v })}
            fmt={(v) => v.toFixed(2)}
          />
          <Field label="最大 Tokens" hint="单次生成的最大 token 数，超长文本可适当调大">
            <Input
              type="number" min={1} step={256}
              value={llm.maxTokens}
              onChange={(e) => actions.setLLM({ maxTokens: Number(e.target.value) || 0 })}
            />
          </Field>
        </Card>

        {/* ---- 4. 系统提示词 ---- */}
        <Card className="reveal" style={{ '--d': '160ms', padding: '20px 22px' }}>
          <SectionHead title="系统提示词" sub="作为每次 AI 请求的系统级上下文，决定模型的身份与文风" />
          <Field label="System Prompt" hint="建议保留默认，可微调以适应你的创作习惯">
            <Textarea rows={5} value={llm.systemPrompt} onChange={(e) => actions.setLLM({ systemPrompt: e.target.value })} />
          </Field>
        </Card>

        {/* ---- 5. AI 配图配置（场景 / 人物） ---- */}
        <Card className="reveal" style={{ '--d': '200ms', padding: '20px 22px' }}>
          <SectionHead
            title="AI 配图 · 场景与人物"
            sub="人物图以「外貌锚点 + 固定风格 + 每角色 seed」保持形象一致；场景图共享全局风格后缀保证整体统一"
            right={
              <Tag tone={img.connected ? 't-success' : undefined} style={{ gap: 6 }}>
                <span
                  style={{
                    width: 7, height: 7, borderRadius: '50%', display: 'inline-block',
                    background: img.connected ? 'var(--success)' : 'var(--text-faint)',
                    boxShadow: img.connected ? '0 0 8px var(--success)' : 'none',
                  }}
                />
                {img.connected ? '配图可用' : '未测试'}
              </Tag>
            }
          />

          {/* 配图服务商 */}
          <Field label="图片生成服务商" hint="内置原型文生图端点无需 Key；自定义可接入任意兼容接口">
            <div className="grid grid-3" style={{ gap: 10 }}>
              {IMAGE_PROVIDERS.map((p) => {
                const sel = p.id === img.provider;
                return (
                  <Card
                    key={p.id}
                    hoverable
                    onClick={() => {
                      setImgTestResult(null);
                      actions.setImg({ provider: p.id, baseUrl: p.defaultBase, connected: false });
                    }}
                    style={{
                      padding: '12px 14px', cursor: 'pointer',
                      borderColor: sel ? 'var(--primary)' : undefined,
                      boxShadow: sel ? '0 0 0 1px var(--primary)' : undefined,
                    }}
                  >
                    <div className="row-between" style={{ gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{p.name}</span>
                      {sel && <Check size={15} style={{ color: 'var(--primary)', flex: 'none' }} />}
                    </div>
                    <div className="sub" style={{ fontSize: 11.5, marginTop: 5 }}>{p.desc}</div>
                  </Card>
                );
              })}
            </div>
          </Field>

          {(imgProvider?.needsKey || img.baseUrl) && (
            <Field label="Base URL" hint="图片服务接口根地址（自定义服务商时填写）">
              <Input
                value={img.baseUrl}
                onChange={(e) => actions.setImg({ baseUrl: e.target.value })}
                placeholder="https://…"
              />
            </Field>
          )}
          {imgProvider?.needsKey && (
            <Field label="API Key" hint="仅保存在本机 localStorage，用于配图服务鉴权">
              <Input
                className="grow"
                type="password"
                value={img.apiKey}
                onChange={(e) => actions.setImg({ apiKey: e.target.value })}
                placeholder="sk-…"
                autoComplete="off"
              />
            </Field>
          )}

          <Field label="全局风格" hint="所有场景与人物图共享的视觉风格后缀，是画面「连贯性」的核心，建议保留默认并微调">
            <Textarea rows={2} value={img.style} onChange={(e) => actions.setImg({ style: e.target.value })} />
          </Field>

          <div className="grid grid-2" style={{ gap: 14 }}>
            <Field label="人物图尺寸">
              <Select value={img.size} onChange={(e) => actions.setImg({ size: e.target.value })}>
                {SIZE_POOL.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="场景图尺寸">
              <Select value={img.sceneSize} onChange={(e) => actions.setImg({ sceneSize: e.target.value })}>
                {SIZE_POOL.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
          </div>

          <Field label="全局 Seed" hint="种子基准值，与角色/场景 ID 派生，保证重新生成时画面稳定连贯">
            <Input
              type="number" min={0} step={1}
              value={img.seed}
              onChange={(e) => actions.setImg({ seed: Number(e.target.value) || IMAGE_DEFAULT.seed })}
            />
          </Field>

          <div className="row-between" style={{ marginTop: 4 }}>
            <div className="row" style={{ gap: 10 }}>
              <Button variant="outline" icon={Wand2} loading={imgTesting} onClick={runImgTest}>测试配图服务</Button>
              {img.lastTest && !imgTesting && (
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                  上次测试：{img.lastTest.at} · {img.lastTest.latency}ms
                </span>
              )}
            </div>
            <Button variant="outline" size="sm" icon={Save} onClick={saveImgConfig}>保存配图配置</Button>
          </div>

          {/* 配图测试结果 */}
          {imgTestResult && (
            imgTestResult.ok ? (
              <div style={{ marginTop: 14, background: 'var(--success-soft)', border: '1px solid rgba(76,175,125,0.4)', borderRadius: 'var(--r-md)', padding: '12px 14px' }}>
                <div className="row" style={{ color: '#6fd69e', gap: 7 }}>
                  <CheckCircle2 size={16} />
                  <span style={{ fontWeight: 600, fontSize: 13 }}>配图服务可用 · {imgTestResult.latency}ms</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 5 }}>{imgTestResult.message}</div>
              </div>
            ) : (
              <div style={{ marginTop: 14, background: 'var(--danger-soft)', border: '1px solid rgba(229,83,61,0.4)', borderRadius: 'var(--r-md)', padding: '12px 14px' }}>
                <div className="row" style={{ color: '#f27a66', gap: 7 }}>
                  <XCircle size={16} />
                  <span style={{ fontWeight: 600, fontSize: 13 }}>配图服务不可用</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 5 }}>{imgTestResult.message}</div>
              </div>
            )
          )}
        </Card>

        {/* ---- 6. 创作能力 Prompt 模板 ---- */}
        <Card className="reveal" style={{ '--d': '240ms', padding: '20px 22px' }}>
          <SectionHead title="创作能力 Prompt 模板" sub="六种 AI 创作能力的提示词模板，点击展开可编辑，保存时一并写入配置" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ACTION_META.map((m) => {
              const open = openAct === m.key;
              return (
                <div key={m.key} style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', background: 'var(--bg-raised)', overflow: 'hidden' }}>
                  <button
                    type="button"
                    onClick={() => setOpenAct(open ? null : m.key)}
                    className="row-between"
                    style={{
                      width: '100%', border: 'none', background: 'transparent', cursor: 'pointer',
                      padding: '12px 14px', color: 'var(--text)', fontFamily: 'inherit', textAlign: 'left',
                    }}
                  >
                    <span className="row" style={{ gap: 10, minWidth: 0 }}>
                      <m.icon size={16} style={{ color: 'var(--primary)', flex: 'none' }} />
                      <span style={{ fontSize: 13.5, fontWeight: 600 }}>{m.label}</span>
                      <span className="faint" style={{ fontSize: 11.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.hint}</span>
                    </span>
                    <ChevronDown
                      size={16}
                      style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 160ms var(--ease-out)', color: 'var(--text-faint)', flex: 'none' }}
                    />
                  </button>
                  {open && (
                    <div style={{ padding: '4px 14px 14px', borderTop: '1px solid var(--border)' }}>
                      <Field label={`${m.label} Prompt`}>
                        <Textarea
                          rows={3}
                          value={llm.actions[m.key] || ''}
                          onChange={(e) => actions.setLLM({ actions: { ...llm.actions, [m.key]: e.target.value } })}
                        />
                      </Field>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* ---- 6. 用量统计 ---- */}
        <Card className="reveal" style={{ '--d': '240ms', padding: '20px 22px' }}>
          <SectionHead
            title="用量统计"
            sub="本周期模型调用与 Token 消耗概览"
            right={<Tag tone="t-warning">演示存根</Tag>}
          />
          {usageLoading ? (
            <div className="grid grid-4" style={{ gap: 12 }}>
              {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 68 }} />)}
            </div>
          ) : usage ? (
            <div className="grid grid-4" style={{ gap: 12 }}>
              <UsageStat value={usage.monthCalls.toLocaleString('zh-CN')} label="本月调用（次）" />
              <UsageStat value={usage.monthTokens.toLocaleString('zh-CN')} label="本月 Tokens" />
              <UsageStat value={usage.dayCalls.toLocaleString('zh-CN')} label="今日调用（次）" />
              <UsageStat value={`${Math.round(usage.cached * 100)}%`} label="缓存命中率" />
            </div>
          ) : null}
          <div className="faint" style={{ fontSize: 11.5, marginTop: 14 }}>
            数据为演示存根，TODO: 接入后端真实统计。
          </div>
        </Card>

        {/* ---- 底部操作 ---- */}
        <div className="row-between reveal" style={{ '--d': '280ms' }}>
          <div className="row" style={{ gap: 10 }}>
            <Button variant="ghost" icon={RotateCcw} onClick={resetDefaults}>恢复默认</Button>
            <span className="faint" style={{ fontSize: 11.5 }}>恢复默认会清空本地配置并刷新页面</span>
          </div>
          <Button variant="primary" icon={Save} onClick={saveConfig}>保存配置</Button>
        </div>

      </div>
    </>
  );
}