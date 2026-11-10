#!/usr/bin/env python3
"""把 data/prompts.js 里的提示词改写成 Claude Code 自定义命令。

注意：命令正文是**从提示词改写来的**，不是运行时从 prompts.js 读取的。
终端场景需要改的东西（占位符、参数兜底、禁止执行 git commit）没法机械
替换，只能人写。所以改 prompts.js 不会自动更新命令——两者需要一起改。
`--check` 会告诉你源条目还在不在、本地文件有没有被手改过。

用法：
    python tools/make-commands.py            # 写入 ~/.claude/commands 和 claude-commands/
    python tools/make-commands.py --dry-run  # 只看会写什么
    python tools/make-commands.py --check    # 校验源条目与本地文件
"""

from __future__ import annotations

import argparse
import pathlib
import re
import sys

# 每条命令：(命令名, 原提示词 id, 一句话描述, 参数提示, 正文)
# 正文里的 $ARGUMENTS 是 Claude Code 的占位替换。
COMMANDS = [
    (
        "fix", "c02",
        "诊断代码里的 bug 并给出修复方案",
        "[粘贴代码和报错；不填则用当前对话里的代码]",
        """请分析以下代码中的 bug，并给出修复方案。按以下步骤回答：
1) 指出 bug 的具体位置和原因；
2) 解释为什么会导致当前症状；
3) 提供修复后的代码；
4) 说明修复的原理。

$ARGUMENTS

如果上面没有提供内容，就针对当前对话里最近的代码或报错来处理；两者都没有，先问我症状和预期行为。""",
    ),
    (
        "review", "c03",
        "从正确性/性能/安全/可读性/可维护性五个维度审查代码",
        "[粘贴代码或文件路径]",
        """请对以下代码进行代码审查（Code Review）。从以下维度评估：
1) 正确性（逻辑是否正确）；
2) 性能（是否有优化空间）；
3) 安全性（是否有安全隐患）；
4) 可读性（命名、注释、结构）；
5) 可维护性（是否符合 SOLID 原则）。

对每个问题给出严重程度（🔴严重 / 🟡建议 / 🟢优化）和具体的改进代码。语言按代码自行判断。

没有问题的维度不要逐条展开，一句话带过或直接省略——终端里滚屏很贵。

$ARGUMENTS

如果上面没有提供内容，就审查当前对话里最近出现的代码；没有的话先问我要审哪一段。""",
    ),
    (
        "refactor", "c04",
        "重构代码：提取重复、优化命名、简化逻辑",
        "[粘贴代码]",
        """请对以下代码进行重构，提高其可读性和可维护性。要求：
1) 提取重复代码为独立函数/类；
2) 优化命名使其更语义化；
3) 简化复杂逻辑；
4) 遵循该语言社区的最佳实践。

请提供重构后的完整代码，并在注释中说明每个主要改动的理由。语言按代码自行判断。

$ARGUMENTS

如果上面没有提供内容，就重构当前对话里最近出现的代码；没有的话先问我要改哪段。""",
    ),
    (
        "test", "c08",
        "为函数编写单元测试，覆盖正常/边界/异常/空值",
        "[粘贴函数代码]",
        """请为以下函数编写全面的单元测试。测试框架按项目现有依赖选择（Python 用 pytest，JS/TS 用 Vitest 或 Jest，Java 用 JUnit），先看一眼仓库里已有的测试文件再决定。

覆盖以下场景：
1) 正常输入（Happy Path）；
2) 边界值；
3) 异常/错误输入；
4) 空值/null 处理。

每个测试用例包含清晰的描述（given-when-then 格式）。

$ARGUMENTS

如果上面没有提供内容，就为当前对话里最近的函数写测试；没有的话先问我要测哪个函数。""",
    ),
    (
        "commit-msg", "u16",
        "根据变更生成符合 Conventional Commits 的提交信息",
        "[可选：补充说明；不填则用 git diff]",
        """请根据以下代码变更生成规范的 Git Commit Message。

先运行 `git diff --cached` 看暂存区；暂存区为空就用 `git diff`。变更内容以实际 diff 为准，不要凭空编。

要求：
1) 遵循 Conventional Commits 规范（feat / fix / docs / refactor / test / chore）；
2) 标题 ≤ 50 字符；
3) 正文每行 ≤ 72 字符；
4) 说明变更的原因和影响，不只是描述做了什么。

只输出提交信息本身，用 ``` 包起来，方便我直接复制。不要执行 git commit。

$ARGUMENTS""",
    ),
    (
        "explain", "u13",
        "把报错翻译成人话，并按可能性排序给排查步骤",
        "[粘贴报错或堆栈]",
        """请帮我解读以下错误信息，并提供排查和修复方案。

$ARGUMENTS

要求：
1) 解释错误的直接原因（翻译成「人话」）；
2) 可能的根本原因，按可能性排序；
3) 逐步排查方案，从最简单到最深入；
4) 每种原因对应的修复代码。

如果上面没有提供内容，就用当前对话里最近的报错；没有的话先问我要报错文本和运行环境（语言/框架/版本/系统）。""",
    ),
    (
        "sql", "c05",
        "分析 SQL 性能问题并给出索引与改写方案",
        "[粘贴 SQL，注明数据库类型]",
        """请分析以下 SQL 查询的性能问题并给出优化方案。要求：
1) 分析执行计划和瓶颈；
2) 建议添加的索引（写出具体 CREATE INDEX 语句）；
3) 重写优化后的 SQL；
4) 估算优化前后的性能差异。

数据库类型按 SQL 方言自行判断（MySQL / PostgreSQL / SQL Server），不确定就说明你按哪个假设分析。

$ARGUMENTS

如果上面没有提供内容，就用当前对话里最近的 SQL；没有的话先问我要查询语句和表结构。""",
    ),
    (
        "regex", "c07",
        "写正则并逐段解释，附正常与边缘测试用例",
        "[描述要匹配什么，可附样例文本]",
        """请帮我编写一个正则表达式。

需求见下：

$ARGUMENTS

要求：
1) 提供完整的正则表达式和使用时需要的 flags；
2) 逐段解释正则各部分的作用；
3) 给 3-5 个测试用例，包含正常情况和边缘情况。

语言/工具按当前对话的上下文判断（JavaScript / Python / ripgrep 等），不确定就先问我。""",
    ),
    (
        "sh", "c15",
        "写一个带错误处理、参数解析和彩色输出的 Bash 脚本",
        "[描述脚本要做什么]",
        """请编写一个 Bash 脚本，实现下面的需求：

$ARGUMENTS

要求：
1) 错误处理：`set -euo pipefail`，并处理预期内的失败；
2) 支持命令行参数（getopts，或写清用法）；
3) 彩色输出（绿成功 / 红错误 / 黄警告），且在输出被重定向时不要污染管道；
4) 提供 `--help`；
5) 兼容 macOS 和 Linux（注意 BSD 与 GNU 工具的参数差异，比如 sed -i）。

注意：算术自增不要用 `((var++))`——在 `set -e` 下它返回 1 会直接终止脚本，用 `var=$((var + 1))`。""",
    ),
    (
        "ci", "c24",
        "生成 GitHub Actions 工作流：lint+test、构建、部署",
        "[描述项目类型和部署目标]",
        """请帮我编写 GitHub Actions 工作流配置（.yml）。

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
- 先看一眼仓库里已有的工作流和 package.json / pyproject.toml，按实际技术栈写，不要套模板。""",
    ),
]


# 这三条和 ~/.claude/commands 里原有的命令重复，而且原版更详细，
# 所以不再生成（保留在这里是为了记下「考虑过、为什么不用」）：
#   commit-msg      -> 已有 commit.md（21 行，含 BREAKING CHANGE 处理）
#   fix             -> 已有 debug.md（47 行，含复现与影响面分析）
#   test            -> 已有 generate-tests.md（覆盖 5 种语言/框架）
SKIP = {"commit-msg", "fix", "test"}

# 统一追加到每条命令末尾的输出约定。
# 这几条来自实际跑一遍后暴露的问题：
#   - 用了表格，而用户明确不要表格；
#   - 「修复代码」里又犯了它自己刚指出的错误（判空之后照样在 DOM 元素上调 .map）；
#   - 开头先铺垫一大段，终端里滚三屏才看到结论。
COMMON_TAIL = """

输出约定：
- 先给一句结论，再展开细节。
- 给出的代码必须自洽、能直接跑。如果你在正文里指出某个写法是错的，就不要在修复代码里再用它。
- 不确定的信息（文件内容、变量名、版本）标出来，不要编。"""


def render(name: str, desc: str, hint: str, body: str) -> str:
    return (
        "---\n"
        f"description: {desc}\n"
        f"argument-hint: {hint}\n"
        "---\n\n"
        f"{body}{COMMON_TAIL}\n"
    )


def check(args, dest: pathlib.Path, backup: pathlib.Path) -> int:
    """校验两件事：源条目还在不在、本地文件有没有被手改过。"""
    problems = 0

    # 1. src_id 是否还存在于 data/prompts.js
    src_file = pathlib.Path(__file__).resolve().parent.parent / "data" / "prompts.js"
    ids = set()
    if src_file.exists():
        text = src_file.read_text(encoding="utf-8")
        ids = set(re.findall(r"\bid:\s*'([^']+)'", text))
    else:
        print(f"  FAIL 找不到 {src_file}")
        problems += 1

    for name, src_id, *_ in COMMANDS:
        if name in SKIP:
            continue
        if ids and src_id not in ids:
            print(f"  FAIL /{name} 的来源 {src_id} 已不在 data/prompts.js 里（被删或改名？）")
            problems += 1

    # 2. 本地文件是否与脚本渲染结果一致
    # CI 里没有 ~/.claude，安装目录不存在时跳过，只校验仓库备份
    dirs = [("安装目录", dest)] if dest.exists() else []
    dirs.append(("仓库备份", backup))

    for name, _src, desc, hint, body in COMMANDS:
        if name in SKIP:
            continue
        expected = render(name, desc, hint, body)
        for label, d in dirs:
            p = d / f"{name}.md"
            if not p.exists():
                print(f"  FAIL {label} 缺 {name}.md")
                problems += 1
            elif p.read_text(encoding="utf-8") != expected:
                print(f"  FAIL {label} 的 {name}.md 与脚本不一致（被手改过？重跑生成即可覆盖）")
                problems += 1

    total = len([c for c in COMMANDS if c[0] not in SKIP])
    if problems == 0:
        print(f"全部通过：{total} 条命令，源条目齐全，本地文件与脚本一致")
    else:
        print(f"失败 {problems} 项")
    return 0 if problems == 0 else 1


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="只打印，不写文件")
    ap.add_argument("--check", action="store_true", help="校验源条目与本地文件，不写文件")
    ap.add_argument("--dest", default=str(pathlib.Path.home() / ".claude" / "commands"),
                    help="命令安装目录，默认 ~/.claude/commands")
    args = ap.parse_args()

    here = pathlib.Path(__file__).resolve().parent
    backup = here.parent / "claude-commands"
    dest = pathlib.Path(args.dest)

    if args.check:
        return check(args, dest, backup)

    if not args.dry_run:
        dest.mkdir(parents=True, exist_ok=True)
        backup.mkdir(parents=True, exist_ok=True)

    written = 0
    for name, src_id, desc, hint, body in COMMANDS:
        if name in SKIP:
            continue
        text = render(name, desc, hint, body)
        if args.dry_run:
            print(f"===== /{name}  (来自 {src_id}) =====")
            print(text)
            continue
        # newline="\n" 是必须的：Windows 上默认会写成 CRLF
        (dest / f"{name}.md").write_text(text, encoding="utf-8", newline="\n")
        (backup / f"{name}.md").write_text(text, encoding="utf-8", newline="\n")
        written += 1

    if not args.dry_run:
        print(f"已写入 {written} 个命令")
        print(f"  安装位置：{dest}")
        print(f"  备份位置：{backup}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
