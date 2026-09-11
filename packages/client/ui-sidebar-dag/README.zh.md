---
description: "dsh Web 客户端右侧 Sidebar 的回合地图 tab 类型：把会话的每个已开始的回合画成链上节点，选中一个就把对话移到那个回合。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-sidebar-dag

[English](README.md) | 中文

## 概述

右侧 Sidebar 的回合地图：把会话的每个已开始的回合画成链上的一个节点，点中一个节点就把对话移到那个回合。它是从引导页进入的页类型，不认领任何地址，因此不替别的查看器打开资源：`ui-sidebar-right` 里没有任何东西认识本包。它的标签、引导页入口，以及词典里为「没有回合的会话」和「没有轮次投影的部署」准备的两行文字，都来自 `sidebarDag` 命名空间。

## 目录

- [注册了什么](#what-it-registers)
- [模型体验](#model-experience)
- [已知限制与暂缓事项](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="what-it-registers"></a>
## 注册了什么

- **类型**：`ctx.sidebarRightTabs.register(...)`，kind 为 `dag`，id 为 `@deepseek-ai/dsh-client-ui-sidebar-dag`，档位 `builtin`，没有 patterns，另有一个打开该类型的引导页入口（order 20，标题与描述取自 `sidebarDag` 命名空间，图标是共享的分支图标）。这个 id 就是该类型的正文与标签页标题在 `sidebar.right.pane.tab` 与 `sidebar.right.pane.tab.title` 两个 slot 里注册时所用的键。
- **词典**：经 `ctx.locale.register(...)` 注册 `sidebarDag` 命名空间，一次调用带上全部内置语言；缺少任何一门都会在注册时被拒绝，因此读者不会遇到半翻译的 tab。

`src/client/` 下三个源文件：`definition.tsx`（类型是什么）、`locales.ts`（它说什么）、`index.ts`（接线）。`src/index.ts` 是 Host 半边，不向 Host 树贡献任何东西。

<a id="model-experience"></a>
## 模型体验

无，因为本包在浏览器里绘制会话的回合，不注册任何面向模型的内容。

#### KV Cache 影响

无；地图不组装模型请求。

## 已知限制与暂缓事项

<a id="known-limitations-and-deferred-work"></a>
- **只能按 kind 打开。**类型不声明任何资源 pattern，因此没有任何地址会认领回合地图，也无法深链到一张地图；读者只能从引导页进入它。
- **没有轮次投影的宿主与空会话读起来不一样。**词典故意把 `empty` 与 `noProjection` 分成两行：没有任何已开始回合的会话，与不提供轮次投影的部署，两者不能读起来相同。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文——点击展开</summary>

无。

</details>

**运行时不变量：** 不发布 companion：本包自己没有任何运行时状态。类型与两本词典都是注册表贡献，由各自的注册表持有并随插件的 fiber 一并释放；这里也没有对它们的第二个观测源。
