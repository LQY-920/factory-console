# Factory Console 修复验收 — 2026-09-05

## 结论与范围

已由原始静态/功能混合基线迭代为可运行的本地单用户 MVP。原 Review 的 P1 阻断已修复；不是无人值守生产部署平台，也不宣称没有任何未知缺陷。

依据：用户原始实现提示词全文、中英视觉稿、PRODUCT.md、DESIGN.md、AGENTS.md。按安全 → CRUD/项目隔离 → 状态机 → 日报/i18n/手机 → 独立 GitHub 实连推进。所有源码修复在 factory-console；salon-wall、factory-skills、全局 Skills 未修改。

## 可复现验证

| 项目 | 实测结果 |
| --- | --- |
| lint / typecheck / test / build | 全部通过；53 个测试、13 个测试文件 |
| 历史 Review 探针 | R01–R12 加确认控制项通过；R13/R14 及慢请求保存已纳入默认测试 |
| 真实 GitHub 数据 | 独立私有仓库 Issue #1–5、已合入 integration 子 PR #6–8、总 PR #9、候选用例、Tag/Release 可读取 |
| 待办状态 | todo/review/rework/testing 各 1；review/promote/rework/testing/release/deploy 6 类，#9 Ready 后增加 merge |
| Factory doctor | 独立仓库，退出 0，21 通过/0 失败 |
| Factory review collect | 退出 0，APPROVED=2、CHANGES_REQUESTED=3、PENDING=1、UNSUBMITTED=4,5、BATCH_PR=9；核对返工 Issue 已回填 doing |
| Factory batch start | 退出 0，MODE=batch、BATCH=acceptance、ISSUES=5 4 3 2 1；未执行 main 合并/生产发版/部署 |
| salon-wall | 只读加载真实 Git/GitHub/Factory，分支 integration/mvp-prd；不使用其写操作或测试通知 |
| 无凭证 CRUD | 浏览器创建 UI acceptance scratch，再编辑名称为 UI acceptance edited，返回总览完成新状态加载 |
| 项目隔离 | A 慢响应不能覆盖 B，保存同项目会刷新；浏览器切换测试项目和 salon-wall |
| 日报 | 中英文真实预览保存，英文不嵌入旧中文 NEXT；本地日历昨日/DST、每日日报重启后去重、失败先保存均测试 |
| 通知 | 真实本地 HTTP 接收器验证 JSON Markdown/Bearer、503 与禁止重定向；未向用户第三方终端发送 |
| 持久化 | 文件 SQLite 关闭/重开后保留项目、语言、计划、日报、审计；删除项目清理日报和命令日志 |
| 界面 | 1440×960 / 390×844，共享中英布局；手机整页 scrollWidth=390，无整页横向溢出，流水线/表格独立滚动 |
| 键盘 | 确认弹窗初始焦点、Shift+Tab 圈定、Escape 关闭和焦点恢复；手机菜单离屏 inert |

独立仓库：https://github.com/LQY-920/factory-console-acceptance （private）。合成数据专用于验收；不代表真实生产工作量。`npm test` 和 CI 完全离线，不写 GitHub。手工验收脚本需明确 opt-in。

## 本轮 UI audit

视觉反模式结论：符合用户控制台稿的信息层级、海军蓝表面和语义色；无营销 hero、大面积渐变、玻璃模糊或伪造数据。真实 7 类待办比参考稿 4 类更长，允许纵向滚动，不通过隐藏数据强行塞进首屏。

- High / Accessibility：主按钮对比度初测 3.84，低于正文目标；已降低主色亮度。数字角标前景/背景同色已修复。
- Medium / Accessibility：离屏手机菜单仍可聚焦、项目选择器缺少显著焦点、初始 HTML lang 与持久化英文不一致；均已修复。
- Medium / Responsive：旧手机分支图例裁切；已改独立单列换行。动作按钮/语言切换在手机放大至至少 44px 高。
- Low / Product boundary：本地控制台不面向 SEO/公共爬虫；不以 SEO 或 llms.txt 分数作为 MVP 门槛。robots.txt 明确禁止抓取。
- 正向：颜色 token、reduced-motion、共享 React 组件/i18n、真实未知态、确认说明与人工作业明细保留。

audit 技能用于诊断；其引用的 frontend-design 技能当前不可用，故视觉原则依据项目 PRODUCT/DESIGN 和用户稿。修复按用户授权执行，没有修改全局技能。

## 已确认故障及处理

实连曾遇 GitHub 连接抖动、Factory 状态 10 秒超时和 collect 60 秒超时。collect 超时前已部分回填远程状态，不能当作回滚；核对后手工重试成功。修改动作现有 180 秒上限，doctor 60 秒，HTTP/运行记录保留 124/真实退出码。写动作不自动重试。详情在 PITFALLS.md。

## 明确的 MVP 边界

- Factory next 会隐式 collect --apply，因此替换为只读证据推导，标记 SOURCE=console-readonly，不假称调用了 next。
- MySQL/SSH 只保存配置与 ENV 引用并检查存在性；不宣称 MySQL 登录、SSH 连接或真实部署已验证。
- DPAPI/Credential Manager、多用户登录、后台 Windows 服务、离线历史补报、通知投递队列不在本 MVP。
- Webhook 是通用 JSON 适配器；手机真实送达须配置用户服务后另验收。当前不读取用户私密 URL，不替用户发送。
- 不自动生成 Issue、编码、晋级、合入 main、打 Tag、SSH 或知识库回写；提供明确人工入口和部署参考命令。
- 原始 CLI 日志、GitHub 标题/评论、已保存历史报告保持源语言；界面文案和新预览按 locale 渲染。操作系统原生时间选择器使用浏览器/系统语言。
- 只信任用户自己配置的 Factory 脚本；脚本不是沙箱。服务只允许 loopback，不能直接暴露公网。

## 启动及下一步

项目根目录执行 `npm ci`（首次）、`npm run build`、`npm start`；访问 http://127.0.0.1:8787 。开发模式 `npm run dev`，访问 http://127.0.0.1:5173 。

建议下一步用 1–2 个真实 Issue 跑小批次，人工复核批准、候选测试和最终合入；准备真实 Webhook 后单独验证手机通知。不要跳过确认直接扩大自动化权限。
