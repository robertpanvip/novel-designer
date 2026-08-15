/* ============================================================
   砚墨 · 小说设计器 — 大模型配置页（Settings）
   ------------------------------------------------------------
   接入任意 OpenAI 兼容大模型。配置通过 useStore() 的 setLLM
   实时写入 store 并持久化到 localStorage；API Key 仅存本地，
   绝不外发。模型列表 / 连接测试 / 用量统计走 llm.js 存根层。
   ============================================================ */
import React, { useEffect, useState } from 'react';
import {
  Cpu, Eye, EyeOff, Plug, Save, RotateCcw, Check, ChevronDown,
  PenLine, Expand, Sparkles, RefreshCw, Lightbulb, ShieldCheck,
  CheckCircle2, XCircle,
} from 'lucide-react';
import {
  Button, IconBtn, Field, Input, Select, Textarea, Tag, Card,
  SectionHead, PageHead, EmptyState, Slider,
} from '../components/ui';
import { useStore } from '../store/AppStore';
import { PROVIDERS, listModels, testConnection, fetchUsage } from '../api/llm';

/* 六种创作能力的动作元信息（对应 llm.actions 的键） */
const ACTION_META = [
  { key: 'continue', label: '续写', icon: PenLine, hint: '顺着已有文风自然续写 300–500 字' },
  { key: 'expand', label: '扩写', icon: Expand, hint: '丰富细节与层次，扩至原稿 1.5–2 倍' },
  { key: 'polish', label: '润色', icon: Sparkles, hint: '优化节奏、画面感与声韵' },
  { key: 'rewrite', label: '改写', icon: RefreshCw, hint: '以不同视角或语气重写' },
  { key: 'brainstorm', label: '灵感', icon: Lightbulb, hint: '给出差异化剧情走向' },
  { key: 'consistency', label: '一致性', icon: ShieldCheck, hint: '对照设定检查冲突与矛盾' },
];

/* 用量统计小方块 */
function UsageStat({ value, label }) {
  return (
    <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '14px 16px' }}>
      <div className="mono" style={{ fontSize: 19, fontWeight: 600, lineHeight: 1.15, color: 'var(--text)' }}>{value}</div>
      <div className="sub" style={{ fontSize: 12, marginTop: 5 }}>{label}</div>
    </div>
  );
}

export default function Settings() {
  const { llm, actions } = useStore();
  const currentProvider = PROVIDERS.find((p) => p.id === llm.provider);

  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const [models, setModels] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  const [usage, setUsage] = useState(null);
  const [usageLoading, setUsageLoading] = useState(true);

  const [openAct, setOpenAct] = useState(null);

  /* 模型列表：随 provider 变化异步加载 */
  useEffect(() => {
    let alive = true;
    setModelsLoading(true);
    listModels(llm.provider)
      .then((res) => { if (alive) { setModels(res.data || []); setModelsLoading(false); } })
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
  const selectProvider = (p) => {
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

  const modelOptions = models.length ? models : currentProvider?.models || [];

  return (
    <>
      <PageHead
        title="大模型配置"
        sub="可接入任意 OpenAI 兼容大模型；API 密钥仅保存在本机浏览器 localStorage，不会上传到任何服务器。"
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

        {/* ---- 5. 创作能力 Prompt 模板 ---- */}
        <Card className="reveal" style={{ '--d': '200ms', padding: '20px 22px' }}>
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
