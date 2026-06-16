const cron = require('node-cron');
const dayjs = require('dayjs');
const pool = require('../config/database');
const { sendOverdueReminder, sendWeeklyReport } = require('../utils/email');
const { getLastWeekRange } = require('../utils/helpers');

const checkOverdueTasks = async () => {
  console.log('⏰ 执行逾期任务检查...', dayjs().format('YYYY-MM-DD HH:mm:ss'));

  try {
    const [overdueTasks] = await pool.execute(
      `SELECT 
         t.id,
         t.name,
         t.deadline,
         p.name as project_name,
         u.id as user_id,
         u.real_name as user_name,
         u.email as user_email
       FROM tasks t
       LEFT JOIN projects p ON t.project_id = p.id
       LEFT JOIN users u ON t.assignee_id = u.id
       WHERE t.status NOT IN ('completed') 
         AND t.deadline < CURDATE()
         AND u.status = 1
       ORDER BY u.id, t.deadline ASC`
    );

    if (overdueTasks.length === 0) {
      console.log('✅ 没有逾期任务');
      return;
    }

    const userTasks = {};
    for (const task of overdueTasks) {
      if (!userTasks[task.user_id]) {
        userTasks[task.user_id] = {
          user_name: task.user_name,
          user_email: task.user_email,
          tasks: []
        };
      }
      userTasks[task.user_id].tasks.push({
        id: task.id,
        name: task.name,
        deadline: task.deadline,
        project_name: task.project_name
      });
    }

    console.log(`📋 找到 ${Object.keys(userTasks).length} 位用户有逾期任务，共 ${overdueTasks.length} 个逾期任务`);

    for (const userId in userTasks) {
      const userData = userTasks[userId];
      try {
        await sendOverdueReminder(userData.user_email, userData.user_name, userData.tasks);
        
        for (const task of userData.tasks) {
          await pool.execute(
            `INSERT INTO notifications (user_id, type, title, content, related_id, related_type) 
             VALUES (?, 'overdue', '任务逾期提醒', ?, ?, 'task')`,
            [userId, `任务"${task.name}"已逾期，请尽快处理`, task.id]
          );
        }
      } catch (err) {
        console.error(`  ❌ 发送逾期提醒给 ${userData.user_name} 失败:`, err.message);
      }
    }

    console.log('✅ 逾期任务检查完成');
  } catch (err) {
    console.error('❌ 逾期任务检查出错:', err);
  }
};

const generateWeeklyReport = async () => {
  console.log('📊 生成周工时统计报表...', dayjs().format('YYYY-MM-DD HH:mm:ss'));

  try {
    const { start, end } = getLastWeekRange();
    console.log(`   统计周期: ${start} ~ ${end}`);

    const [reportData] = await pool.execute(
      `SELECT 
         u.id as user_id,
         u.real_name as user_name,
         u.department,
         COALESCE(SUM(wl.hours), 0) as total_hours,
         COUNT(DISTINCT wl.task_id) as task_count
       FROM users u
       LEFT JOIN work_logs wl ON u.id = wl.user_id 
         AND wl.work_date >= ? AND wl.work_date <= ?
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE r.name = 'member' AND u.status = 1
       GROUP BY u.id, u.real_name, u.department
       ORDER BY total_hours DESC`,
      [start, end]
    );

    console.log(`   共统计 ${reportData.length} 位成员的工时数据`);

    const [managers] = await pool.execute(
      `SELECT u.id, u.real_name, u.email 
       FROM users u 
       LEFT JOIN roles r ON u.role_id = r.id 
       WHERE r.name IN ('admin', 'manager') AND u.status = 1`
    );

    console.log(`   将发送周报给 ${managers.length} 位管理人员`);

    for (const manager of managers) {
      try {
        await sendWeeklyReport(manager.email, manager.real_name, reportData);

        await pool.execute(
          `INSERT INTO notifications (user_id, type, title, content, related_type) 
           VALUES (?, 'weekly_report', '周工时统计报表', ?, 'report')`,
          [manager.id, `上周（${start} ~ ${end}）工时统计报表已生成，请查收`]
        );
      } catch (err) {
        console.error(`  ❌ 发送周报给 ${manager.real_name} 失败:`, err.message);
      }
    }

    console.log('✅ 周工时统计报表生成完成');
  } catch (err) {
    console.error('❌ 生成周工时统计报表出错:', err);
  }
};

const startCronJobs = () => {
  console.log('⏰ 定时任务已启动');

  cron.schedule('0 0 1 * * *', () => {
    checkOverdueTasks();
  });

  cron.schedule('0 0 9 * * 1', () => {
    generateWeeklyReport();
  });

  console.log('  - 每日凌晨 1:00 检查逾期任务');
  console.log('  - 每周一上午 9:00 发送周工时报表');
  console.log();
};

module.exports = {
  startCronJobs,
  checkOverdueTasks,
  generateWeeklyReport
};
