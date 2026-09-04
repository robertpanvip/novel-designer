# Design Contract · 砚墨 · 小说设计器 (Novel Designer)

## 技术栈 & 交付
- React 18 + Vite 5 + react-router-dom 6 (HashRouter) + lucide-react
- build 类型：`npm run build` → dist 静态产物（base './'，可整目录托管/离线打开）
- 样式：自定义 CSS（CSS 变量 token），不使用 Tailwind
- 字体：Google Fonts CDN 引入 `Noto Serif SC`（展示）+ `Noto Sans SC`（正文）+ `JetBrains Mono`（数字/AI 技术信息）

## Style Tier & Aesthetic Direction
- style: tech-dark
- aesthetic: 「深夜书房 · 墨色创作台」——墨色深夜书房气质：深墨底 + 暖纸白文字 + 单一朱砂印红强调色 + 鎏金点缀；细 1px 描边、克制的发光、噪点质感。书卷气与科技感并存。
- tone keywords: 克制 / 专注 / 高信息密度 / 书卷气
- 记忆点（differentiator）：朱砂印红 accent + 中文衬线展示字体 + JetBrains Mono 点缀 AI/数字 + 印章式品牌「砚墨」

## Design Tokens
- color.bg: #0C0E13        color.bg-raised: #11141B
- color.surface: #161A23    color.surface-2: #1C212D
- color.border: #262C3A     color.border-strong: #343C4E
- color.text: #EAE7E0       color.text-sub: #9AA3B2   color.text-faint: #5D6575
- color.primary: #E5533D    color.primary-hover: #F0654E   color.primary-soft: rgba(229,83,61,.12)
- color.gold: #D8A25E       color.gold-soft: rgba(216,162,94,.14)
- color.success: #4CAF7D    color.warning: #E0A93E   color.danger: #E5533D
- font.display: 'Noto Serif SC', serif    font.body: 'Noto Sans SC', sans-serif    font.mono: 'JetBrains Mono', monospace
- font.scale: 12 / 13 / 14 / 15 / 16 / 18 / 20 / 24 / 28 / 32
- radius: sm 6 / md 10 / lg 14 / pill 999
- shadow.sm: 0 1px 2px rgba(0,0,0,.35)   shadow.md: 0 10px 28px rgba(0,0,0,.4)   shadow.lg: 0 18px 52px rgba(0,0,0,.5)
- spacing.unit: 4px (4/8/12/16/20/24/32/40/48)
- layout: 侧边栏 236px 固定；内容 margin-left 236px；页面内容 max-width 1280、padding 28px 40px
- icon.lib: lucide-react，尺寸 16/18/20，stroke-width 1.6
- motion: 页面加载错峰 reveal（opacity+translateY，animation-delay var(--d)）；hover/active 过渡 150–220ms ease-out
- bg-texture: 多层径向渐变（深墨底 + 朱砂/鎏金微光）+ 极细噪点 overlay（SVG data-uri）
- 反 AI slop：禁止紫色渐变、禁止 Inter/Roboto 默认字体、≤3 主色族、系统性间距

## Component Spec（全局组件统一实现，页面只调用）
- Button：variant = primary(朱砂底/白字) | gold | outline | ghost | danger | subtle；size = sm/md；radius 8；按下 translateY(1px)；disabled opacity .5
- Input / Select / Textarea：bg-raised、border 1px、radius 8、focus 朱砂 glow、placeholder text-faint、label 12px text-sub
- Card：surface、1px border、radius 14、hover border-strong + translateY(-1px)
- Tag：pill、12px、soft 底（用 color 透传）
- Modal：overlay rgba(5,6,9,.72)+blur、panel surface radius 16、标题 display 字体
- Sidebar：fixed 236px、深墨半透明 blur、分组小标题 mono 10px uppercase、激活项朱砂左条 + primary-soft
- EmptyState：虚线框、灰圈图标、标题+提示+操作按钮
- StatCard / SectionHead / Avatar(首字+渐变环) / ProgressRing / Slider / Toaster 均在共享层提供

## App Shell + Canonical Nav（强制，禁止页面重写）
- Shell 结构：`<div class="app"><aside class="app-nav">…</aside><main class="app-main"><header class="topbar">…</header><div class="page-content"><Outlet/></div></main></div>`
- nav 固定项顺序：工作台 /dashboard LayoutDashboard · 创作台 /writer PenLine · 角色库 /characters Users · 世界观 /world Globe2 · 情节大纲 /plot GitBranch · 大模型配置 /settings Settings
- 激活规则：react-router `<NavLink>` isActive（仅 Layout 一处实现）
- Topbar：项目名《雾港潮生》选择器、搜索框、AI 模型状态 chip（绿点 + provider/model，连接 settings）、用户头像「墨」

## Page List（6 页）
1. Dashboard 工作台 | 项目总览+今日灵感 AI+统计+最近章节 | StatCard/ProgressRing/灵感卡/章节列表 | → writer/characters/plot
2. Writer 创作台 | 章节列表+编辑器+AI 侧栏（续写/扩写/润色/改写/灵感/一致性） | Editor/AIPanel/Toast | → settings
3. Characters 角色库 | 角色卡网格+关系图+新增/编辑 Modal | CharacterCard/Modal/RelationGraph | →
4. World 世界观 | 分类条目+时间线+势力+规则 | SectionCard/Timeline | →
5. Plot 情节大纲 | 幕/章节大纲卡片流+结构图 | PlotNode/StructureView | →
6. Settings 大模型配置 | Provider 选择+连接测试+参数+能力模板+用量 | ConfigForm/Slider/Test | →

## Mock Schema（见 src/mock/data.js，页面只读 store/mock）
- project: { id,title,genre,tagline,synopsis,cover,wordCount,chapterCount,charCount,worldCount,streak,createdAt,updatedAt }
- chapters: [{ id,no,title,status: draft|revising|done,wordCount,updatedAt,summary,content }]
- characters: [{ id,name,title,color,tags[],identity,personality,goals[],conflicts,arc,note,relations:[{name,type}] }]
- world: { sections:[{id,type,title,desc,items:[{id,title,desc}]}], timeline:[{id,era,title,desc,year}] }
- plot: { acts:[{id,name,phase,color,nodes:[{id,type,title,summary,conflict,pov,status,chapterNo}]}] }
- llm: { provider,baseUrl,apiKey,model,temperature,maxTokens,topP,systemPrompt,actions:{continue,expand,polish,rewrite,brainstorm,consistency},useCount,connected,lastTest }

## API 存根（src/api/llm.js，签名=未来真实 API）
- PROVIDERS 预设（OpenAI / DeepSeek / 月之暗面 Moonshot / 通义千问 Qwen / 自定义 OpenAI 兼容）
- testConnection(config) → delay 900 → { ok, latency, model }
- listModels(provider) → 静态模型列表
- runAI({ config, action, context, onDelta }) → 按 action 返回分场景 canned 回复；支持逐 token 流式 onDelta 模拟（async）
- 所有存根标注 `// TODO: replace with fetch('/api/…')`

## 状态（src/store/AppStore.jsx）
- 单 Context + useState：project/chapters/characters/world/plot/llm + actions + toast
- actions: updateChapter/insertChapter/removeChapter · addCharacter/updateCharacter/removeCharacter · addWorldItem/removeWorldItem · addPlotNode/updatePlotNode · setLLM(partial)/saveLLM · toast(msg,type)
- llm 配置与章节草稿变更持久化到 localStorage（key: yanmo-llm / yanmo-chapters）
