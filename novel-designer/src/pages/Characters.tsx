/* ============================================================
   砚墨 · 小说设计器 — 角色库页面
   结构：关系网（SVG 径向图）→ 标签筛选 → 角色卡片网格
   交互：新增 / 编辑共用 Modal、删除需 confirm、全部走 actions
   写操作均通过 AppStore actions（TODO: 接入真实后端时替换 actions 内部实现）
   ============================================================ */
import React, { useMemo, useState } from 'react';
import { Users, Plus, Pencil, Trash2, Network, ImagePlus, RefreshCw } from 'lucide-react';
import { useStore } from '../store/AppStore';
import { characterImageUrl, generateCharacterImage } from '../api/image';
import {
  PageHead,
  Button,
  IconBtn,
  Card,
  Avatar,
  Tag,
  Field,
  Input,
  Textarea,
  Modal,
  EmptyState,
  SectionHead,
} from '../components/ui';
import type { Character } from '../types';

/* 预设角色色板（与角色档案色一致，禁止新增主题色） */
const PALETTE = ['#E5533D', '#4C6AA0', '#D8A25E', '#B58EC2', '#8FA3BF', '#4CAF7D', '#E0A93E', '#7C8698'] as const;
/* 标签语气轮换 */
const TAG_TONES = ['t-primary', 't-gold', 't-success', 't-warning'] as const;

interface FormState {
  id: string | null;
  name: string;
  title: string;
  identity: string;
  personality: string;
  appearance: string;
  tags: string;
  goals: string;
  arc: string;
  note: string;
  color: string;
}

const EMPTY_FORM: FormState = {
  id: null,
  name: '',
  title: '',
  identity: '',
  personality: '',
  appearance: '',
  tags: '',
  goals: '',
  arc: '',
  note: '',
  color: PALETTE[0],
};

/* ---------------- 关系网：SVG 径向图 ----------------
   节点按角色数量均分圆周，连线来自 relations 数组（两端均在角色库中）。
   TODO: 接入真实后端 —— 角色/关系数据来自后端时仅需替换数据来源。 */
interface PositionMap {
  [name: string]: { x: number; y: number };
}

interface Edge {
  from: Character;
  label: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function RelationGraph({ characters }: { characters: Character[] }) {
  const W = 860;
  const H = 430;
  const cx = W / 2;
  const cy = H / 2 - 4;
  const R = 138;

  /* 静态径向坐标 */
  const pos = useMemo<PositionMap>(() => {
    const m: PositionMap = {};
    const n = characters.length;
    characters.forEach((c, i) => {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      m[c.name] = { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
    });
    return m;
  }, [characters]);

  /* 由 relations 生成连线（去重：A→B 与 B→A 只画一条） */
  const edges = useMemo<Edge[]>(() => {
    const seen = new Set<string>();
    const list: Edge[] = [];
    characters.forEach((c) => {
      (c.relations || []).forEach((r) => {
        if (!pos[r.name]) return; // 关系对象不在本作角色库中则忽略
        const key = [c.name, r.name].sort().join('|');
        if (seen.has(key)) return;
        seen.add(key);
        list.push({
          from: c,
          label: r.type,
          x1: pos[c.name].x,
          y1: pos[c.name].y,
          x2: pos[r.name].x,
          y2: pos[r.name].y,
        });
      });
    });
    return list;
  }, [characters, pos]);

  /* 无角色 → 空态；仅一位 → 提示 */
  if (characters.length === 0) {
    return <EmptyState icon={Network} title="关系网还无人可连" desc="先新增一位角色，关系网会在这里自动织成。" />;
  }
  if (characters.length < 2) {
    return (
      <div className="empty" style={{ padding: 34 }}>
        <h4>关系网需要至少两位角色</h4>
        <p>再新增一位角色，即可按档案中的 relations 自动生成连线。</p>
      </div>
    );
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
      <defs>
        {/* 每位角色一枚径向渐变，模拟渐变圆形 Avatar */}
        {characters.map((c) => (
          <radialGradient key={c.id} id={`av-${c.id}`} cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor={c.color} stopOpacity="0.95" />
            <stop offset="100%" stopColor={c.color} stopOpacity="0.5" />
          </radialGradient>
        ))}
      </defs>

      {/* 背景同心环（气氛装饰） */}
      {[90, 150, 208].map((r) => (
        <circle
          key={r}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="#262c3a"
          strokeWidth="1"
          strokeDasharray="2 7"
          opacity="0.55"
        />
      ))}

      {/* 关系连线 + 关系类型标注 */}
      {edges.map((e, i) => {
        const mx = (e.x1 + e.x2) / 2;
        const my = (e.y1 + e.y2) / 2;
        const lw = e.label.length * 7.5 + 14;
        return (
          <g key={i}>
            <line
              x1={e.x1}
              y1={e.y1}
              x2={e.x2}
              y2={e.y2}
              stroke={e.from.color}
              strokeOpacity="0.42"
              strokeWidth="1.4"
            />
            <rect
              x={mx - lw / 2}
              y={my - 9.5}
              width={lw}
              height={19}
              rx={9.5}
              fill="#161a23"
              stroke="#343c4e"
              strokeWidth="0.8"
            />
            <text
              x={mx}
              y={my + 3.5}
              textAnchor="middle"
              style={{ fill: '#d8a25e', fontSize: 9.5, fontFamily: 'var(--font-mono)' }}
            >
              {e.label}
            </text>
          </g>
        );
      })}

      {/* 角色节点：渐变圆 + 首字 + 姓名 */}
      {characters.map((c) => (
        <g key={c.id} style={{ filter: `drop-shadow(0 0 7px ${c.color}55)` }}>
          <circle cx={pos[c.name].x} cy={pos[c.name].y} r={30} fill={`url(#av-${c.id})`} stroke={c.color} strokeWidth="1.6" />
          <circle
            cx={pos[c.name].x}
            cy={pos[c.name].y}
            r={30}
            fill="none"
            stroke="rgba(255,255,255,0.14)"
            strokeWidth="1"
          />
          <text
            x={pos[c.name].x}
            y={pos[c.name].y + 7}
            textAnchor="middle"
            style={{ fill: '#ffffff', fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-display)' }}
          >
            {c.name.slice(0, 1)}
          </text>
          <text
            x={pos[c.name].x}
            y={pos[c.name].y + 49}
            textAnchor="middle"
            style={{ fill: '#9aa3b2', fontSize: 12.5, fontFamily: 'var(--font-body)' }}
          >
            {c.name}
          </text>
        </g>
      ))}
    </svg>
  );
}

/* ---------------- 角色卡片 ---------------- */
function CharacterCard({ c, delay, onEdit, onDelete }: { c: Character; delay: number; onEdit: (c: Character) => void; onDelete: (c: Character) => void }) {
  const { img, actions } = useStore();
  const [variant, setVariant] = useState(0);
  const [loading, setLoading] = useState(false);
  const [imgErr, setImgErr] = useState(false);

  /* 画像 URL：由「外貌锚点 + 统一风格 + seed」确定性生成，保证同一角色形象一致 */
  const url = characterImageUrl({ config: img, character: c, variant });

  /* 重新生成画像：变体仅改变姿态/构图，身份描述恒定（TODO: 接入真实后端，用参考图+seed 做 IMG2IMG） */
  const regen = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    setImgErr(false);
    try {
      await generateCharacterImage({ config: img, character: c, variant: variant + 1 });
      setVariant((v) => v + 1);
      actions.setImg({ useCount: (img.useCount || 0) + 1 });
      actions.toast(`已为「${c.name}」重新生成画像，形象保持一致`, 'success');
    } catch {
      actions.toast('画像生成失败，请检查「AI 配图」配置', 'danger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="reveal" style={{ '--d': `${delay}ms`, overflow: 'hidden', padding: 0, display: 'flex', flexDirection: 'column' }}>
      {/* AI 画像 */}
      <div className={`portrait-frame ${loading ? 'loading' : ''}`}>
        {imgErr ? (
          <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>
            <Avatar name={c.name} color={c.color} size="lg" />
          </div>
        ) : (
          <img src={url} alt={`${c.name} 画像`} loading="lazy" onError={() => setImgErr(true)} />
        )}
        <button
          className="img-chip"
          style={{ position: 'absolute', right: 12, top: 12 }}
          onClick={regen}
          disabled={loading}
          title="基于外貌锚点重新生成，保持形象一致"
        >
          {loading ? <RefreshCw className="spin" /> : <ImagePlus className="i" />}
          <span>{loading ? '生成中' : 'AI 画像'}</span>
        </button>
      </div>

      <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
        {/* 头部：Avatar + 姓名 + 身份 */}
        <div className="row" style={{ gap: 12, alignItems: 'center' }}>
          <Avatar name={c.name} color={c.color} size="lg" />
          <div style={{ minWidth: 0 }}>
            <div className="display" style={{ fontSize: 18, fontWeight: 700 }}>{c.name}</div>
            <div
              className="sub"
              style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {c.title}
            </div>
          </div>
        </div>

        {/* 标签 */}
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          {(c.tags || []).map((t, i) => (
            <Tag key={t} tone={TAG_TONES[i % TAG_TONES.length]}>{t}</Tag>
          ))}
        </div>

        {/* 性格（truncate 3 行） */}
        <p
          style={{
            color: 'var(--text-sub)',
            fontSize: 13,
            lineHeight: 1.7,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {c.personality}
        </p>

        {/* 目标（前两条，带圆点） */}
        {(c.goals || []).slice(0, 2).map((g) => (
          <div key={g} className="row" style={{ gap: 8, color: 'var(--text-sub)', fontSize: 13, alignItems: 'flex-start' }}>
            <span style={{ color: 'var(--primary)', fontSize: 10, marginTop: 4 }}>●</span>
            <span style={{ flex: 1 }}>{g}</span>
          </div>
        ))}

        {/* 关系 Tag 组（name·type） */}
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          {(c.relations || []).map((r) => (
            <Tag key={r.name} tone="t-gold">{r.name}·{r.type}</Tag>
          ))}
          {(!c.relations || c.relations.length === 0) && (
            <span className="faint" style={{ fontSize: 12 }}>暂无档案关系</span>
          )}
        </div>

        {/* 底部：弧光 + 操作 */}
        <div className="row-between" style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <span
            className="mono"
            style={{ fontSize: 11.5, color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            title={c.arc}
          >
            {c.arc || '弧光未设定'}
          </span>
          <div className="row" style={{ gap: 2 }}>
            <IconBtn icon={Pencil} label={`编辑 ${c.name}`} onClick={() => onEdit(c)} />
            <IconBtn icon={Trash2} danger label={`删除 ${c.name}`} onClick={() => onDelete(c)} />
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ---------------- 页面 ---------------- */
export default function Characters() {
  const { characters, actions } = useStore();
  const { toast } = actions;
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [filter, setFilter] = useState<string | null>(null); // 当前标签筛选

  /* 全部标签（用于筛选 chips） */
  const allTags = useMemo<string[]>(() => {
    const s = new Set<string>();
    characters.forEach((c) => (c.tags || []).forEach((t) => s.add(t)));
    return [...s];
  }, [characters]);

  const filtered = useMemo(
    () => (filter ? characters.filter((c) => (c.tags || []).includes(filter)) : characters),
    [characters, filter],
  );

  /* 打开新增 / 编辑 Modal */
  const openAdd = () => {
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };
  const openEdit = (c: Character) => {
    setForm({
      id: c.id,
      name: c.name,
      title: c.title || '',
      identity: c.identity || '',
      personality: c.personality || '',
      appearance: c.appearance || '',
      tags: (c.tags || []).join(', '),
      goals: (c.goals || []).join('\n'),
      arc: c.arc || '',
      note: c.note || '',
      color: c.color || PALETTE[0],
    });
    setModalOpen(true);
  };

  const setField = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  /* 提交新增 / 编辑 */
  const submit = () => {
    if (!form.name.trim()) {
      toast('角色名不能为空', 'warning');
      return;
    }
    // TODO: 接入真实后端 —— 当前写入本地 actions（内存态），后端就绪后替换为 API 调用
    const payload = {
      name: form.name.trim(),
      title: form.title.trim(),
      identity: form.identity.trim(),
      personality: form.personality.trim(),
      appearance: form.appearance.trim(),
      tags: form.tags.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
      goals: form.goals.split('\n').map((s) => s.trim()).filter(Boolean),
      arc: form.arc.trim(),
      note: form.note.trim(),
      color: form.color,
      relations: [] as Character['relations'],
    };
    if (form.id) {
      actions.updateCharacter(form.id, payload);
      toast(`已更新「${payload.name}」`, 'success');
    } else {
      actions.addCharacter(payload);
      toast(`已新增角色「${payload.name}」`, 'success');
    }
    setModalOpen(false);
  };

  /* 删除（先 confirm） */
  const remove = (c: Character) => {
    if (!window.confirm(`确定删除角色「${c.name}」？此操作不可撤销。`)) return;
    actions.removeCharacter(c.id);
    toast(`已删除「${c.name}」`);
    // 若被删角色是当前筛选标签的唯一持有者，则清除筛选
    if (filter && !characters.some((x) => x.id !== c.id && (x.tags || []).includes(filter))) {
      setFilter(null);
    }
  };

  return (
    <div>
      <PageHead
        title="角色库"
        sub={`共 ${characters.length} 位角色。人物是故事的骨，织成临港这张网。`}
        actions={
          <Button icon={Plus} onClick={openAdd}>新增角色</Button>
        }
      />

      {/* 关系网 */}
      <Card className="reveal" style={{ '--d': '40ms', padding: '22px 24px', marginBottom: 24 }}>
        <SectionHead title="关系网" sub="节点按角色径向排布，连线即档案中的 relations 关系。" />
        <RelationGraph characters={characters} />
      </Card>

      {/* 标签筛选 chips */}
      {characters.length > 0 && (
        <div className="row reveal" style={{ '--d': '90ms', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          <span className="faint" style={{ fontSize: 12.5 }}>筛选：</span>
          <button
            onClick={() => setFilter(null)}
            className={`btn btn-sm ${filter === null ? 'btn-primary' : 'btn-ghost'}`}
          >
            全部
          </button>
          {allTags.map((t) => (
            <button
              key={t}
              onClick={() => setFilter(filter === t ? null : t)}
              className={`btn btn-sm ${filter === t ? 'btn-primary' : 'btn-outline'}`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {/* 角色卡片网格 */}
      {characters.length === 0 ? (
        <EmptyState
          icon={Users}
          title="角色库还是空的"
          desc="人物是故事的骨。新增第一位角色，开始为你的人物画像。"
          action={<Button icon={Plus} onClick={openAdd}>新增角色</Button>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={`没有「${filter}」标签的角色`}
          desc="试试切换其他标签，或新增一位带此标签的角色。"
        />
      ) : (
        <div className="grid grid-3">
          {filtered.map((c, i) => (
            <CharacterCard key={c.id} c={c} delay={120 + i * 60} onEdit={openEdit} onDelete={remove} />
          ))}
        </div>
      )}

      {/* 新增 / 编辑共用 Modal */}
      <Modal
        open={modalOpen}
        title={form.id ? `编辑角色 · ${form.name}` : '新增角色'}
        onClose={() => setModalOpen(false)}
        width={640}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>取消</Button>
            <Button icon={form.id ? Pencil : Plus} onClick={submit}>
              {form.id ? '保存修改' : '创建角色'}
            </Button>
          </>
        }
      >
        <div className="row" style={{ gap: 18, alignItems: 'flex-start' }}>
          {/* 左列：基础信息 */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <Field label="姓名" hint="必填 · 角色在书中的名字">
              <Input value={form.name} onChange={setField('name')} placeholder="如：陆昭" />
            </Field>
            <Field label="头衔" hint="职业 / 身份标识，展示在姓名下方">
              <Input value={form.title} onChange={setField('title')} placeholder="如：潮汐电台 · 夜间主播" />
            </Field>
            <Field label="身份" hint="一句话背景简介">
              <Input value={form.identity} onChange={setField('identity')} placeholder="前调查记者，因一桩旧案辞职…" />
            </Field>
            <Field label="标签" hint="用逗号分隔，如：主角, 记者">
              <Input value={form.tags} onChange={setField('tags')} placeholder="主角, 关键, 知情人" />
            </Field>
            <Field label="弧光" hint="角色的成长轨迹">
              <Input value={form.arc} onChange={setField('arc')} placeholder="从「旁观者」到「亲历者」" />
            </Field>
            <Field label="颜色" hint="关系网与头像使用">
              <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                {PALETTE.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, color: p }))}
                    aria-label={`选择颜色 ${p}`}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: p,
                      cursor: 'pointer',
                      border: form.color === p ? '2px solid #fff' : '2px solid transparent',
                      boxShadow: form.color === p ? `0 0 10px ${p}` : 'none',
                      opacity: form.color === p ? 1 : 0.7,
                    }}
                  />
                ))}
              </div>
            </Field>
          </div>

          {/* 右列：长文本 */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <Field label="外貌" hint="外貌描写是 AI 画像保持形象一致性的锚点">
              <Textarea value={form.appearance} onChange={setField('appearance')} rows={2} placeholder="如：瘦高、深色风衣、左耳戴旧耳机…" />
            </Field>
            <Field label="性格">
              <Textarea value={form.personality} onChange={setField('personality')} rows={3} placeholder="克制、敏锐、共情…" />
            </Field>
            <Field label="目标" hint="每行一个">
              <Textarea value={form.goals} onChange={setField('goals')} rows={4} placeholder={'查明沉尸身份\n重写当年的报道'} />
            </Field>
            <Field label="备注">
              <Textarea value={form.note} onChange={setField('note')} rows={2} placeholder="留白给未来的自己…" />
            </Field>
          </div>
        </div>
      </Modal>
    </div>
  );
}