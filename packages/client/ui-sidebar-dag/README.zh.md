---
description: "dsh Web 客户端右侧 Sidebar 的轮次地图 tab 类型：把会话的每个已开始的轮次画成链上节点，选中一个就把对话移到那个轮次。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-sidebar-dag

[English](README.md) | 中文

## 概述

右侧 Sidebar 的轮次地图：把会话的每个已开始的轮次画成链上的一个节点，点中一个节点就把对话移到那个轮次。它是从引导页进入的页类型，不认领任何地址，因此不替别的查看器打开资源：`ui-sidebar-right` 里没有任何东西认识本包。它的标签、引导页入口，以及词典里为「没有轮次的会话」和「没有轮次投影的部署」准备的两行文字，都来自 `sidebarDag` 命名空间。

## 目录

- [注册了什么](#what-it-registers)
- [链](#the-chain)
- [模型体验](#model-experience)
- [已知限制与暂缓事项](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="what-it-registers"></a>
## 注册了什么

- **类型**：`ctx.sidebarRightTabs.register(...)`，kind 为 `dag`，id 为 `@deepseek-ai/dsh-client-ui-sidebar-dag`，档位 `builtin`，没有 patterns，另有一个打开该类型的引导页入口（order 20，标题与描述取自 `sidebarDag` 命名空间，图标是共享的分支图标）。
- **正文**：以该 id 为键的 `sidebar.right.pane.tab` slot：带轮次计数的标题行，跟随暂停时它旁边就是回到当前节点的控件，其下是链。
- **标签页标题**：以该 id 为键的 `sidebar.right.pane.tab.title` slot：类型标签前的一枚 16px 共享分支图标。
- **词典**：经 `ctx.locale.register(...)` 注册 `sidebarDag` 命名空间，一次调用带上全部内置语言；缺少任何一门都会在注册时被拒绝，因此读者不会遇到半翻译的 tab。

`src/client/` 下七个源文件：`definition.tsx`（类型是什么）、`DagBody.tsx`（它画什么）、`DagTitle.tsx`（标签页标题）、`face.ts`（它如何触达对话与阅读位置）、`map.ts`（节点列表与可见性问题）、`locales.ts`（它说什么）、`index.ts`（接线）。`src/index.ts` 是 Host 半边，不向 Host 树贡献任何东西。

<a id="the-chain"></a>
## 链

节点就是会话自己的轮次：`useProjection('turnOutline')` 按大纲顺序读成 `{ turn, prompt, response }`，本包不做事件投影，也没有第二个模型。提示词不带文字的轮次在链上保留原位，没有文字但有编号。大纲缺席与会话为空读起来是两行不同的文字——部署那一行与会话那一行——两者都不画链。

每一行都是真实的按钮，带节点标记、轮次号与提示词预览。当前节点——已挂载 Chat 视图报告为阅读线的那个轮次，读自可选的 `chatView` 服务按会话提供的定位——带 `aria-current` 并展开自己的回复预览，于是链保持可扫读、只有一行变高；其余行保持单行。跳转正在落位的轮次带落地态。点中一行会经 tab 的会话作用域用 `conversation.requestView({ kind: 'turn', view: 'chat', turn })` 请对话移动到该轮次，把转录带过去；当另一个视图处于活动状态时，它还会把对话切回 Chat。

读者留在当前节点上时地图跟随它：每次前进都把当前行滚入视野；一旦读者把该行滚出地图自己的滚动框，链就不再在读者脚下移动，并出现回到当前节点的控件。该控件把读者带回那一行并恢复跟随，且只在当前节点滚出视野时绘制；没有当前轮次时既没有可停止的跟随，也没有可提供的控件。行是键盘可达界面——一个 tab 停靠点、方向键遍历、Home/End、可见的焦点环——reduced motion 则去掉平滑滚动与落地脉冲。

读者读到的是 `sidebarDag` 词典提供的文字：类型标签与它的标签页标题、引导页入口的标题与描述、轮次计数、两行空状态、回到当前节点的控件，以及给没有提示词的轮次标注用的一行。

<a id="model-experience"></a>
## 模型体验

无，因为本包在浏览器里绘制会话的轮次，不注册任何面向模型的内容。

#### KV Cache 影响

无；地图不组装模型请求。

## 已知限制与暂缓事项

<a id="known-limitations-and-deferred-work"></a>
- **只能按 kind 打开。**类型不声明任何资源 pattern，因此没有任何地址会认领轮次地图，也无法深链到一张地图；读者只能从引导页进入它。
- **没有轮次投影的宿主与空会话读起来不一样。**词典故意把 `empty` 与 `noProjection` 分成两行：没有任何已开始轮次的会话，与不提供轮次投影的部署，两者不能读起来相同。
- **不做虚拟化。**每个节点都留在 DOM 里，行成本由链上的 `content-visibility: auto` 吸收。轮次数由会话决定，而不是由产品决定；触发虚拟列表所需的实测值——滚动或提交成本开始不可接受时的行数——没有记录。
- **失败的轮次读起来和别的轮次一样。**轮次错误、重试、压缩都不在轮次大纲里，所以失败过的轮次带着与正常答完的轮次相同的标记、编号与预览。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文——点击展开</summary>

无。

</details>

**运行时不变量：** 不发布 companion：本包不拥有任何共享的运行时状态。类型与两本词典都是注册表贡献，由各自的注册表持有并随插件的 fiber 一并释放；链剩下的状态——roving tab 停靠点与跟随是否暂停——活在读它的正文组件内部，没有第二个观测源可与之比对。
