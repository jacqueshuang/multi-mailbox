# Multi-Mailbox Management System - TODO

## 核心功能

- [x] 数据库架构设计（邮箱账户表、邮件表、附件表）
- [x] 邮箱账户管理 - 添加 IMAP 邮箱
- [x] 邮箱账户管理 - 编辑邮箱配置
- [x] 邮箱账户管理 - 删除邮箱账户
- [x] 邮箱账户管理 - 添加 Google 邮箱（OAuth2）
- [x] IMAP 邮箱连接和邮件同步
- [x] Google OAuth2 认证集成
- [x] 邮件列表展示和筛选
- [x] 邮件详情查看
- [x] 邮件轮询服务（后台自动检测新邮件）
- [x] WebSocket 实时通知（新邮件推送）
- [x] 重要邮件/异常通知给应用所有者
- [x] 附件云存储（S3）
- [x] 附件下载功能

## API 接口

- [x] RESTful API - 邮箱列表查询
- [x] RESTful API - 邮件列表查询
- [x] RESTful API - 邮件详情查询
- [x] RESTful API - 附件下载
- [x] API 密钥管理

## 前端界面

- [x] 优雅完美的设计风格主题
- [x] Dashboard 布局和导航
- [x] 邮箱账户管理页面
- [x] 邮件收件箱页面
- [x] 邮件详情页面
- [x] 已加星标邮件页面
- [x] API 密钥管理页面
- [x] 实时通知 Toast 组件
- [x] 响应式设计适配

## 测试

- [x] 邮箱账户 CRUD 测试
- [x] IMAP 连接测试
- [x] 邮件同步测试
- [x] API 接口测试

## 待完成

- [x] Google OAuth2 集成（需要配置 Google Cloud Console）

## Google OAuth2 集成

- [x] 创建 Google OAuth2 服务端点
- [x] 实现 OAuth2 授权流程（获取授权码）
- [x] 实现 OAuth2 回调处理（交换 access token）
- [x] 使用 Gmail API 获取用户邮箱信息
- [x] 自动创建 Gmail 邮箱账户
- [x] 存储 OAuth2 refresh token 用于持续访问
- [x] 前端添加"使用 Google 登录"按钮
- [x] 处理 OAuth2 授权成功/失败状态

## 标签和文件夹管理

- [x] 创建标签数据库表
- [x] 创建邮件-标签关联表
- [x] 实现标签 CRUD API
- [x] 实现为邮件添加/移除标签功能
- [x] 实现按标签筛选邮件功能
- [x] 前端标签管理页面
- [x] 邮件列表显示标签
- [x] 邮件详情页添加/移除标签
- [x] 侧边栏显示用户标签列表
- [x] 标签颜色自定义

## 邮箱账户分类

- [x] 创建账户分组数据库表
- [x] 实现账户分组 CRUD API
- [x] 为邮箱账户添加分组字段
- [x] 前端账户分组管理界面
- [x] 侧边栏按分组显示邮箱账户
- [x] 支持拖拽调整账户顺序
