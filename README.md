# Project - shouqianAPP

## Goal

为 shouqianAPP 项目接入 Codex 标准项目流程，统一管理资料、开发过程、交付物、执行记录和复盘沉淀。

## Status

- Started: 2026-06-24
- Current state: existing app, workflow initialized
- Owner: user + Codex
- Tech stack: Vite + React + TypeScript
- Final deliverables:

## Important Paths

- App source: `src`
- Product/reference docs: `docx_2`
- Inputs: `inputs`
- Work: `work`
- Outputs: `outputs`
- Logs: `logs`

## Scope

In scope:

- shouqianAPP 代码开发与维护
- 售前资料、案例、产品文档整理
- 推荐逻辑、报告导出、工程图与课堂方案相关功能迭代
- 开发过程记录、交付总结、复盘沉淀

Out of scope:

- 与 shouqianAPP 无关的独立项目
- 可复用全局规则，应该沉淀到 `C:\Users\73921\Documents\Codex\00_Global_Workspace`

## Project Workflow

1. 把原始资料、用户提供文件、外部参考放入 `inputs`。
2. 把临时脚本、草稿、实验性内容放入 `work`。
3. 把最终交付物、构建产物说明、可发送版本放入 `outputs`。
4. 把执行过程、关键决策、排错记录、复盘放入 `logs`。
5. 对代码改动，优先遵循现有 Vite/React/TypeScript 项目结构。
6. 每次完成重要任务后，更新 `logs\execution_log.md` 或 `outputs\summary.md`。

## Useful Commands

```text
npm install
npm run dev
npm run build
```

## Decisions

- 2026-06-24: Added Codex project workflow to existing `shouqianAPP` folder without moving or overwriting app files.
- 2026-06-24: Kept existing source structure and added process folders beside it.

## Verification

- Standard folders added: `inputs`, `work`, `outputs`, `logs`.
- Starter process documents added.

## Lessons

- Existing app projects should keep their code layout intact; add workflow folders around the project instead of restructuring source files.
