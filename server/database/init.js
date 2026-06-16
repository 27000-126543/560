const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const createDatabase = async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
  });

  console.log('📦 创建数据库...');
  await connection.execute(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME} DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  console.log('✅ 数据库创建成功');
  await connection.end();
};

const createTables = async () => {
  const pool = require('../config/database');

  console.log('📋 创建数据表...');

  const tables = [
    `CREATE TABLE IF NOT EXISTS roles (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(50) NOT NULL UNIQUE,
      description VARCHAR(200),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS users (
      id INT PRIMARY KEY AUTO_INCREMENT,
      username VARCHAR(50) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      real_name VARCHAR(50) NOT NULL,
      email VARCHAR(100) NOT NULL,
      phone VARCHAR(20),
      department VARCHAR(100),
      role_id INT NOT NULL,
      status TINYINT DEFAULT 1 COMMENT '1:正常 0:禁用',
      avatar VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS projects (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      manager_id INT NOT NULL,
      status VARCHAR(20) DEFAULT 'active' COMMENT 'active:进行中 completed:已完成 paused:已暂停',
      start_date DATE,
      end_date DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS project_members (
      id INT PRIMARY KEY AUTO_INCREMENT,
      project_id INT NOT NULL,
      user_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_project_user (project_id, user_id),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS tasks (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(200) NOT NULL,
      description TEXT,
      project_id INT NOT NULL,
      creator_id INT NOT NULL,
      assignee_id INT NOT NULL,
      priority VARCHAR(20) NOT NULL DEFAULT 'medium' COMMENT 'low:低 medium:中 high:高 urgent:紧急',
      status VARCHAR(20) DEFAULT 'pending' COMMENT 'pending:待开始 in_progress:进行中 completed:已完成 rejected:已驳回',
      deadline DATE NOT NULL,
      estimated_hours DECIMAL(5,1),
      actual_hours DECIMAL(5,1) DEFAULT 0,
      reject_reason TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      completed_at TIMESTAMP NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE RESTRICT,
      FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS work_logs (
      id INT PRIMARY KEY AUTO_INCREMENT,
      task_id INT NOT NULL,
      user_id INT NOT NULL,
      work_date DATE NOT NULL,
      hours DECIMAL(4,1) NOT NULL,
      log_content TEXT NOT NULL,
      status VARCHAR(20) DEFAULT 'submitted' COMMENT 'submitted:已提交 approved:已通过 rejected:已驳回',
      reject_reason TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS notifications (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      type VARCHAR(50) NOT NULL,
      title VARCHAR(200) NOT NULL,
      content TEXT,
      is_read TINYINT DEFAULT 0,
      related_id INT,
      related_type VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS system_settings (
      id INT PRIMARY KEY AUTO_INCREMENT,
      setting_key VARCHAR(100) NOT NULL UNIQUE,
      setting_value TEXT,
      description VARCHAR(200),
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  ];

  for (const sql of tables) {
    await pool.execute(sql);
  }

  console.log('✅ 数据表创建成功');
};

const seedData = async () => {
  const pool = require('../config/database');
  console.log('🌱 插入初始数据...');

  const [roles] = await pool.execute('SELECT COUNT(*) as count FROM roles');
  if (roles[0].count === 0) {
    await pool.execute(
      `INSERT INTO roles (name, description) VALUES 
        ('admin', '系统管理员 - 拥有所有权限'),
        ('manager', '项目主管 - 管理项目和任务'),
        ('member', '团队成员 - 执行任务并填报工时')`
    );
    console.log('  ✅ 角色数据插入成功');
  }

  const [users] = await pool.execute('SELECT COUNT(*) as count FROM users');
  if (users[0].count === 0) {
    const hashedPassword = await bcrypt.hash('123456', 10);
    await pool.execute(
      `INSERT INTO users (username, password, real_name, email, phone, department, role_id, avatar) VALUES 
        ('admin', ?, '系统管理员', 'admin@company.com', '13800000001', '技术部', 1, ''),
        ('manager1', ?, '张主管', 'zhang@company.com', '13800000002', '技术部', 2, ''),
        ('manager2', ?, '李经理', 'li@company.com', '13800000003', '产品部', 2, ''),
        ('user1', ?, '王开发', 'wang@company.com', '13800000004', '技术部', 3, ''),
        ('user2', ?, '赵测试', 'zhao@company.com', '13800000005', '技术部', 3, ''),
        ('user3', ?, '孙设计', 'sun@company.com', '13800000006', '产品部', 3, '')`,
      [hashedPassword, hashedPassword, hashedPassword, hashedPassword, hashedPassword, hashedPassword]
    );
    console.log('  ✅ 用户数据插入成功 (默认密码: 123456)');
  }

  const [projects] = await pool.execute('SELECT COUNT(*) as count FROM projects');
  if (projects[0].count === 0) {
    await pool.execute(
      `INSERT INTO projects (name, description, manager_id, status, start_date, end_date) VALUES 
        ('企业官网重构', '公司官方网站全面升级改造项目', 2, 'active', '2024-01-01', '2024-06-30'),
        ('移动App开发', '公司移动端应用开发项目', 2, 'active', '2024-02-01', '2024-08-31'),
        ('ERP系统升级', '企业资源管理系统功能升级', 3, 'active', '2024-01-15', '2024-05-31')`
    );
    console.log('  ✅ 项目数据插入成功');
  }

  const [projectMembers] = await pool.execute('SELECT COUNT(*) as count FROM project_members');
  if (projectMembers[0].count === 0) {
    await pool.execute(
      `INSERT INTO project_members (project_id, user_id) VALUES 
        (1, 2), (1, 4), (1, 5),
        (2, 2), (2, 4), (2, 5), (2, 6),
        (3, 3), (3, 4), (3, 6)`
    );
    console.log('  ✅ 项目成员数据插入成功');
  }

  const [tasks] = await pool.execute('SELECT COUNT(*) as count FROM tasks');
  if (tasks[0].count === 0) {
    await pool.execute(
      `INSERT INTO tasks (name, description, project_id, creator_id, assignee_id, priority, status, deadline, estimated_hours) VALUES 
        ('首页UI设计', '设计官网首页界面风格和布局', 1, 2, 6, 'high', 'completed', '2024-01-15', 16),
        ('用户登录模块开发', '开发用户登录注册功能模块', 1, 2, 4, 'high', 'in_progress', '2024-02-15', 24),
        ('数据库设计', '设计官网数据库表结构', 1, 2, 4, 'medium', 'completed', '2024-01-20', 8),
        ('首页前端开发', '实现官网首页前端页面', 1, 2, 5, 'medium', 'pending', '2024-02-28', 32),
        ('App原型设计', '设计移动App原型和交互流程', 2, 2, 6, 'high', 'in_progress', '2024-02-20', 40),
        ('用户管理模块', '开发App用户管理功能', 2, 2, 4, 'medium', 'pending', '2024-03-15', 32),
        ('ERP需求调研', '调研ERP系统升级需求', 3, 3, 6, 'high', 'completed', '2024-02-01', 24),
        ('ERP数据库优化', '优化ERP数据库性能', 3, 3, 4, 'medium', 'in_progress', '2024-02-28', 16)`
    );
    console.log('  ✅ 任务数据插入成功');
  }

  const [workLogs] = await pool.execute('SELECT COUNT(*) as count FROM work_logs');
  if (workLogs[0].count === 0) {
    await pool.execute(
      `INSERT INTO work_logs (task_id, user_id, work_date, hours, log_content, status) VALUES 
        (1, 6, '2024-01-10', 4.0, '完成首页设计初稿，确定整体风格', 'approved'),
        (1, 6, '2024-01-11', 6.0, '细化首页各模块设计，完成Banner区域', 'approved'),
        (1, 6, '2024-01-12', 5.0, '完成导航栏和页脚设计', 'approved'),
        (3, 4, '2024-01-15', 3.0, '需求分析，梳理数据实体', 'approved'),
        (3, 4, '2024-01-16', 5.0, '设计用户表和权限表结构', 'approved'),
        (2, 4, '2024-02-01', 4.0, '搭建登录模块基础框架', 'submitted'),
        (2, 4, '2024-02-02', 6.0, '实现登录接口和JWT认证', 'submitted'),
        (5, 6, '2024-02-10', 5.0, '完成App首页原型设计', 'approved'),
        (5, 6, '2024-02-11', 4.5, '完成个人中心原型设计', 'approved'),
        (8, 4, '2024-02-15', 4.0, '分析慢查询日志，定位性能瓶颈', 'submitted')`
    );
    console.log('  ✅ 工时记录数据插入成功');
  }

  const [settings] = await pool.execute('SELECT COUNT(*) as count FROM system_settings');
  if (settings[0].count === 0) {
    await pool.execute(
      `INSERT INTO system_settings (setting_key, setting_value, description) VALUES 
        ('daily_work_hours', '8', '每日标准工作时长'),
        ('overdue_reminder_enabled', 'true', '是否开启逾期提醒'),
        ('weekly_report_enabled', 'true', '是否开启周报功能'),
        ('work_log_review_required', 'true', '工时记录是否需要审核')`
    );
    console.log('  ✅ 系统配置数据插入成功');
  }

  console.log('✅ 初始数据插入完成');
};

const init = async () => {
  try {
    console.log('========================================');
    console.log('  🚀 开始初始化数据库');
    console.log('========================================');
    console.log();

    await createDatabase();
    await createTables();
    await seedData();

    console.log();
    console.log('========================================');
    console.log('  ✅ 数据库初始化完成！');
    console.log('========================================');
    console.log();
    console.log('  默认账号:');
    console.log('  管理员 - admin / 123456');
    console.log('  主管   - manager1 / 123456');
    console.log('  成员   - user1 / 123456');
    console.log();

    process.exit(0);
  } catch (err) {
    console.error('❌ 数据库初始化失败:', err.message);
    process.exit(1);
  }
};

init();
