# CHANGELOG

## Unreleased

### Added

- 合入 G1 需求追踪、G2 客户验收、G3 AI 效果评估、G8 多模块代码编排及虚构华锐样例。
- 新增需求、架构、UAT、评估、任务图等模板与零依赖 Node 脚本。

### Fixed

- 客户验收调整为 VERIFY 后、正式 RELEASE 前；UAT 候选包不再等同正式发布。
- 多模块派发、MODULE-OWNERS、CI 和 BuildSpec 指针统一为仓库真实文件与阶段。
- AI 外壳继续确定性 TDD，模型效果使用评估集，不再以一类测试替代另一类。

### Boundaries

- 产品探索不强制完整 H2；签约项目才要求开发前锁定需求与验收基线。
- 当前为候选实现，真实客户项目与正式发布仍需独立验收。
