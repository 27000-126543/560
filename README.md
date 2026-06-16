# 企业项目任务管理与工时统计系统

基于 Vue3 + Node.js + MySQL 的企业内部项目任务管理与工时统计系统。

## 功能特性

### 角色权限
- **系统管理员**：用户管理、角色管理、系统配置、所有数据查看
- **项目主管**：项目管理、任务分配、工时审核、进度看板、报表导出
- **团队成员**：任务查看、工时填报、日志提交、个人统计

### 核心功能
- 📁 **项目管理**：创建、编辑、删除项目，分配项目成员
- 📋 **任务管理**：任务创建、分配、优先级设置、截止日期
- ⏱️ **工时填报**：精确到半小时，每日不超过24小时，日志详情填写
- ✅ **审核机制**：主管可审核/驳回工时记录，驳回原因必填
- 📊 **数据看板**：项目进度、任务趋势、成员工时统计
- 📈 **报表导出**：支持导出Excel格式的工时报表
- 📧 **邮件提醒**：每日逾期任务提醒，每周工时统计报表
- ⏰ **定时任务**：凌晨自动统计逾期任务，周一自动生成周报

## 技术栈

### 后端
- Node.js + Express
- MySQL + mysql2
- JWT 身份认证
- bcryptjs 密码加密
- node-cron 定时任务
- nodemailer 邮件服务
- exceljs Excel导出

### 前端
- Vue 3 + Vite
- Element Plus UI框架
- Pinia 状态管理
- Vue Router 路由
- Axios 请求封装
- ECharts 图表
- Day.js 日期处理

## 快速开始

### 环境要求
- Node.js >= 16.0.0
- MySQL >= 5.7

### 1. 数据库配置

创建 MySQL 数据库：

```sql
CREATE DATABASE project_management DEFAULT CHARACTER SET utf8mb4;
```

修改后端配置文件 `server/.env`：

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=project_management
```

### 2. 初始化数据库

```bash
cd server
npm install
npm run init-db
```

初始化成功后会创建所有数据表和初始数据。

### 3. 启动后端服务

```bash
cd server
npm run dev
```

后端服务默认运行在 http://localhost:3000

### 4. 启动前端服务

```bash
cd web
npm install
npm run dev
```

前端服务默认运行在 http://localhost:5173

### 默认账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 系统管理员 | admin | 123456 |
| 项目主管 | manager1 | 123456 |
| 项目主管 | manager2 | 123456 |
| 团队成员 | user1 | 123456 |
| 团队成员 | user2 | 123456 |
| 团队成员 | user3 | 123456 |

## 项目结构

```
.
├── server/                 # 后端服务
│   ├── config/            # 配置文件
│   │   └── database.js    # 数据库配置
│   ├── database/          # 数据库脚本
│   │   └── init.js        # 初始化脚本
│   ├── middleware/        # 中间件
│   │   ├── auth.js        # 认证中间件
│   │   └── validation.js  # 验证中间件
│   ├── routes/            # 路由
│   │   ├── auth.js        # 认证接口
│   │   ├── users.js       # 用户接口
│   │   ├── projects.js    # 项目接口
│   │   ├── tasks.js       # 任务接口
│   │   ├── worklogs.js    # 工时接口
│   │   └── reports.js     # 报表接口
│   ├── utils/             # 工具函数
│   │   ├── jwt.js         # JWT工具
│   │   ├── email.js       # 邮件工具
│   │   └── helpers.js     # 辅助函数
│   ├── cron/              # 定时任务
│   │   └── index.js       # 定时任务入口
│   ├── app.js             # 应用入口
│   └── package.json
│
└── web/                   # 前端应用
    ├── src/
    │   ├── api/            # API接口
    │   ├── assets/         # 静态资源
    │   ├── components/     # 公共组件
    │   ├── layout/         # 布局组件
    │   ├── router/         # 路由配置
    │   ├── stores/         # Pinia状态管理
    │   ├── utils/          # 工具函数
    │   ├── views/          # 页面组件
    │   │   ├── admin/      # 管理员页面
    │   │   ├── project/    # 项目管理页面
    │   │   ├── task/       # 任务管理页面
    │   │   ├── worklog/    # 工时管理页面
    │   │   └── report/     # 报表页面
    │   ├── App.vue
    │   └── main.js
    ├── index.html
    ├── vite.config.js
    └── package.json
```

## API 接口

### 认证接口
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/logout` - 用户登出
- `GET /api/auth/profile` - 获取用户信息
- `PUT /api/auth/profile` - 更新个人信息
- `PUT /api/auth/password` - 修改密码

### 用户接口
- `GET /api/users` - 用户列表
- `GET /api/users/roles` - 角色列表
- `GET /api/users/managers` - 主管列表
- `GET /api/users/members` - 成员列表
- `POST /api/users` - 创建用户
- `PUT /api/users/:id` - 更新用户
- `DELETE /api/users/:id` - 删除用户

### 项目接口
- `GET /api/projects` - 项目列表
- `GET /api/projects/all` - 所有项目
- `GET /api/projects/:id` - 项目详情
- `POST /api/projects` - 创建项目
- `PUT /api/projects/:id` - 更新项目
- `DELETE /api/projects/:id` - 删除项目

### 任务接口
- `GET /api/tasks` - 任务列表
- `GET /api/tasks/my-tasks` - 我的任务
- `GET /api/tasks/:id` - 任务详情
- `POST /api/tasks` - 创建任务
- `PUT /api/tasks/:id` - 更新任务
- `PUT /api/tasks/:id/status` - 更新任务状态
- `POST /api/tasks/:id/reject` - 驳回任务
- `DELETE /api/tasks/:id` - 删除任务

### 工时接口
- `GET /api/worklogs` - 工时记录列表
- `GET /api/worklogs/my-logs` - 我的工时记录
- `GET /api/worklogs/:id` - 工时记录详情
- `POST /api/worklogs` - 提交工时记录
- `PUT /api/worklogs/:id` - 更新工时记录
- `DELETE /api/worklogs/:id` - 删除工时记录
- `POST /api/worklogs/:id/approve` - 审核通过
- `POST /api/worklogs/:id/reject` - 驳回工时记录

### 报表接口
- `GET /api/reports/dashboard` - 看板数据
- `GET /api/reports/user-work-hours` - 成员工时统计
- `GET /api/reports/project-progress` - 项目进度
- `GET /api/reports/task-trend` - 任务趋势
- `GET /api/reports/export/work-logs` - 导出工时记录Excel
- `GET /api/reports/export/user-hours` - 导出成员工时Excel

## 定时任务

- **每日凌晨 1:00**：检查逾期任务，发送邮件提醒
- **每周一上午 9:00**：生成上周工时统计报表，发送给部门经理

## 邮件配置

修改 `server/.env` 中的SMTP配置：

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your_email@example.com
SMTP_PASS=your_email_password
```

## 数据校验规则

1. **工时校验**：
   - 工时必须在 0.5-24 小时之间
   - 工时必须精确到半小时（0.5的倍数）
   - 同一用户单日总工时不超过24小时

2. **日志提交规则**：
   - 提交后状态为"待审核"
   - 主管审核通过后状态变为"已通过"
   - 主管驳回需填写驳回原因
   - 已通过的工时记录不能修改或删除
   - 被驳回的工时记录可重新编辑提交

## License

MIT
