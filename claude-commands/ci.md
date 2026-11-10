---
description: 生成 GitHub Actions 工作流：lint+test、构建、部署
argument-hint: [描述项目类型和部署目标]
---

请帮我编写 GitHub Actions 工作流配置（.yml）。

需求见下：

$ARGUMENTS

目标：
1) push 时自动跑 lint + test；
2) 合并到主分支后构建镜像（如果项目需要）；
3) 部署到目标平台（如果已确定，没确定就先只做 1 和 2）。

要求：
- 包含缓存策略（依赖目录 / Docker layer）；
- 环境变量走 secrets，不要写死；
- 注意：Windows runner 默认 shell 不认 heredoc，需要 heredoc 的 step 要显式 `shell: bash`；
- 先看一眼仓库里已有的工作流和 package.json / pyproject.toml，按实际技术栈写，不要套模板。

输出约定：
- 先给一句结论，再展开细节。
- 给出的代码必须自洽、能直接跑。如果你在正文里指出某个写法是错的，就不要在修复代码里再用它。
- 不确定的信息（文件内容、变量名、版本）标出来，不要编。
