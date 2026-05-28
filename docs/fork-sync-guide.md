# Fork 同步指南

本仓库当前建议的 remote 结构如下：

- `origin` -> `https://github.com/leecardo/cc-switch.git`
- `upstream` -> `https://github.com/farion1231/cc-switch`

已经在本地配置完成。

## 1. 查看 remote

```bash
git remote -v
```

预期结果：

```bash
origin   https://github.com/leecardo/cc-switch.git (fetch)
origin   https://github.com/leecardo/cc-switch.git (push)
upstream https://github.com/farion1231/cc-switch (fetch)
upstream https://github.com/farion1231/cc-switch (push)
```

## 2. 同步上游到本地 main

```bash
git checkout main
git fetch upstream
git merge --ff-only upstream/main
```

这一步会把上游最新代码快进到本地 `main`。

如果 `--ff-only` 失败，说明你的 `main` 已经混入了自己的提交，不再是纯净主线。
这时不要硬 merge，先把自己的开发改动移到功能分支。

## 3. 把同步后的 main 推回自己的 fork

```bash
git push origin main
```

这样 GitHub 上的 fork 主分支也会跟上游对齐。

## 4. 更新功能分支

假设开发分支叫 `feat/omp-support-v1`。

```bash
git checkout feat/omp-support-v1
git rebase main
```

如果出现冲突：

```bash
# 手动解决冲突后
git add <文件>
git rebase --continue
```

如果想放弃这次 rebase：

```bash
git rebase --abort
```

rebase 完成后，把分支推回 fork：

```bash
git push --force-with-lease origin feat/omp-support-v1
```

## 5. 推荐日常流程

每次准备继续开发前，建议按这个顺序来：

```bash
git checkout main
git fetch upstream
git merge --ff-only upstream/main
git push origin main
git checkout feat/omp-support-v1
git rebase main
```

## 6. 如果想用 GitHub 网页上的 Sync fork

也能用，但只适合非常干净的场景。

适用条件：

- fork 的 `main` 没有自己的开发提交
- 只想同步上游 `main`

如果你的 `main` 里已经混了 OMP 开发提交，网页上的 Sync fork 往往会让历史更乱。
这种情况更推荐命令行方式。

## 7. 关键原则

- 不要在 `main` 上长期开发功能
- `main` 尽量只做上游同步
- 功能开发放在独立分支
- 功能分支更新时优先 `rebase main`
- 只在自己的功能分支上使用 `--force-with-lease`
