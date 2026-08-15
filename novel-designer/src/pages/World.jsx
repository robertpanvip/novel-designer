/* ============================================================
   砚墨 · 小说设计器 — 世界观页面
   结构：统计行 → 分类区块（grid-2）→ 城史时间线
   交互：新增条目 Modal（选分类 + 标题 + 描述）、删除需 confirm
   写操作均通过 AppStore actions（TODO: 接入真实后端时替换 actions 内部实现）
   ============================================================ */
import React, { useMemo, useState } from 'react';
import { Globe2, Plus, Trash2, MapPin, History, Building2, ScrollText } from 'lucide-react';
import { useStore } from '../store/AppStore';
import {
  PageHead,
  Button,
  IconBtn,
  Card,
  Tag,
  Field,
  Input,
  Textarea,
  Select,
  Modal,
  EmptyState,
  SectionHead,
  StatCard,
} from '../components/ui';

/* 分类 → 图标映射（未命中时回退地球图标） */
const SECTION_ICONS = { 地理: MapPin, 历史: History, 势力: Building2, 规则: ScrollText };

/* ---------------- 页面 ---------------- */
export default function World() {
  const { world, actions } = useStore();
  const { toast } = actions;
  const [modalOpen, setModalOpen] = useState(false);
  const [sectionId, setSectionId] = useState(world.sections[0]?.id || '');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');

  /* 打开新增条目 Modal（可选预选分类） */
  const openAdd = (sid) => {
    setSectionId(sid || world.sections[0]?.id || '');
    setTitle('');
    setDesc('');
    setModalOpen(true);
  };

  /* 提交新增条目 */
  const submit = () => {
    if (!sectionId) {
      toast('请选择所属分类', 'warning');
      return;
    }
    if (!title.trim()) {
      toast('标题不能为空', 'warning');
      return;
    }
    if (!desc.trim()) {
      toast('描述不能为空', 'warning');
      return;
    }
    // TODO: 接入真实后端 —— 当前写入本地 actions（内存态），后端就绪后替换为 API 调用
    actions.addWorldItem(sectionId, { title: title.trim(), desc: desc.trim() });
    const sec = world.sections.find((s) => s.id === sectionId);
    toast(`已在「${sec?.title || '分类'}」新增条目`, 'success');
    setModalOpen(false);
  };

  /* 删除条目（先 confirm） */
  const remove = (sid, item) => {
    if (!window.confirm(`确定删除设定「${item.title}」？此操作不可撤销。`)) return;
    actions.removeWorldItem(sid, item.id);
    toast(`已删除「${item.title}」`);
  };

  /* 分类统计 */
  const stats = useMemo(
    () =>
      world.sections.map((s) => ({
        type: s.type,
        count: s.items.length,
        icon: SECTION_ICONS[s.type] || Globe2,
      })),
    [world.sections],
  );

  /* 世界观为空（无分类）兜底 */
  if (world.sections.length === 0) {
    return (
      <div>
        <PageHead
          title="世界观"
          sub="故事发生的这片天地，还是一片空白。"
          actions={<Button icon={Plus} onClick={() => openAdd()}>新增条目</Button>}
        />
        <EmptyState
          icon={Globe2}
          title="世界观还没有条目"
          desc="先搭建地理、历史、势力与规则，让故事有枝可依。"
          action={<Button icon={Plus} onClick={() => openAdd()}>新增条目</Button>}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHead
        title="世界观"
        sub="临港的每一处地名都像被海雾腌过——地理、旧案、势力与暗语，共同托起这个故事。"
        actions={
          <Button icon={Plus} onClick={() => openAdd()}>新增条目</Button>
        }
      />

      {/* 统计行 */}
      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        {stats.map((s, i) => (
          <StatCard key={s.type} icon={s.icon} value={s.count} label={`${s.type}条目`} delay={40 + i * 50} />
        ))}
      </div>

      {/* 分类区块 */}
      <div className="grid grid-2">
        {world.sections.map((s, i) => (
          <Card key={s.id} className="reveal" style={{ ['--d']: `${120 + i * 60}ms`, padding: '20px 22px' }}>
            <SectionHead
              title={`${s.type} · ${s.title}`}
              sub={s.desc}
              right={
                <Button variant="outline" size="sm" icon={Plus} onClick={() => openAdd(s.id)}>
                  添加
                </Button>
              }
            />
            {s.items.length === 0 ? (
              /* 轻量空态：该分类暂无条目 */
              <div className="empty" style={{ padding: '26px 16px' }}>
                <p>该分类下还没有条目，点击右上角「添加」补上第一笔设定。</p>
              </div>
            ) : (
              <div>
                {s.items.map((it, j) => (
                  <div key={it.id}>
                    <div className="row-between" style={{ padding: '10px 2px', gap: 10, alignItems: 'flex-start' }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="display" style={{ fontSize: 14.5, fontWeight: 700 }}>{it.title}</div>
                        <div className="sub" style={{ fontSize: 12.5, color: 'var(--text-sub)', marginTop: 3, lineHeight: 1.6 }}>
                          {it.desc}
                        </div>
                      </div>
                      <IconBtn icon={Trash2} danger label={`删除 ${it.title}`} onClick={() => remove(s.id, it)} />
                    </div>
                    {/* 条目间浅色分隔 */}
                    {j < s.items.length - 1 && (
                      <div style={{ height: 1, background: 'var(--border)', opacity: 0.7 }} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* 城史时间线 */}
      {world.timeline.length > 0 && (
        <Card className="reveal" style={{ ['--d']: '220ms', padding: '22px 24px', marginTop: 24 }}>
          <SectionHead title="城史时间线" sub="纵向时间轴，末项以朱砂高亮为「现在」。" />
          <div style={{ padding: '4px 4px 0' }}>
            {world.timeline.map((t, i) => {
              const isLast = i === world.timeline.length - 1;
              return (
                <div key={t.id} style={{ display: 'flex', gap: 18, alignItems: 'stretch' }}>
                  {/* 左侧 era（mono 金字） */}
                  <div
                    className="mono"
                    style={{
                      width: 56,
                      flex: 'none',
                      textAlign: 'right',
                      paddingTop: 6,
                      fontSize: 13,
                      color: 'var(--gold)',
                    }}
                  >
                    {t.era}
                  </div>

                  {/* 连接线 + 圆点（颜色取该条目 color，末项朱砂发光） */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 18, flex: 'none' }}>
                    <div
                      style={{
                        width: 13,
                        height: 13,
                        borderRadius: '50%',
                        marginTop: 7,
                        background: isLast ? 'var(--primary)' : t.color,
                        boxShadow: isLast
                          ? '0 0 0 4px var(--primary-soft), 0 0 14px var(--primary-glow)'
                          : `0 0 0 3px ${t.color}33`,
                      }}
                    />
                    {!isLast && (
                      <div style={{ width: 2, flex: 1, minHeight: 36, background: 'var(--border)' }} />
                    )}
                  </div>

                  {/* 右侧 title + desc */}
                  <div style={{ flex: 1, paddingBottom: 26, minWidth: 0 }}>
                    <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                      <span className="display" style={{ fontSize: 15, fontWeight: 700 }}>{t.title}</span>
                      {isLast && <Tag tone="t-primary">现在</Tag>}
                    </div>
                    <div className="sub" style={{ fontSize: 12.5, color: 'var(--text-sub)', marginTop: 4, lineHeight: 1.6 }}>
                      {t.desc}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* 新增条目 Modal */}
      <Modal
        open={modalOpen}
        title="新增世界观条目"
        onClose={() => setModalOpen(false)}
        width={520}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>取消</Button>
            <Button icon={Plus} onClick={submit}>创建条目</Button>
          </>
        }
      >
        <Field label="所属分类">
          <Select value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
            {world.sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.type} · {s.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="标题" hint="必填 · 这条设定的名字">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="如：雾谷湿地" />
        </Field>
        <Field label="描述" hint="必填 · 一句话交代它在故事里的作用">
          <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={4} placeholder="城外湿地，废弃的引水渠与旧船坞，走私与逃亡的灰色地带…" />
        </Field>
      </Modal>
    </div>
  );
}
