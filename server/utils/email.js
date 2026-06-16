const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

const sendMail = async (to, subject, html) => {
  try {
    const info = await transporter.sendMail({
      from: `"项目管理系统" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html
    });
    console.log(`📧 邮件已发送: ${info.messageId} -> ${to}`);
    return true;
  } catch (err) {
    console.error('❌ 邮件发送失败:', err.message);
    return false;
  }
};

const sendOverdueReminder = async (userEmail, userName, tasks) => {
  const taskList = tasks.map(t => 
    `<li><strong>${t.name}</strong> - 截止日期: ${t.deadline} - 项目: ${t.project_name}</li>`
  ).join('');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #e74c3c;">⏰ 任务逾期提醒</h2>
      <p>尊敬的 ${userName}：</p>
      <p>您有以下任务已逾期，请尽快处理：</p>
      <ul>${taskList}</ul>
      <p>请登录系统查看详情：<a href="${process.env.APP_URL}">项目管理系统</a></p>
      <hr>
      <p style="color: #999; font-size: 12px;">此邮件由系统自动发送，请勿直接回复。</p>
    </div>
  `;

  return sendMail(userEmail, '任务逾期提醒', html);
};

const sendWeeklyReport = async (managerEmail, managerName, reportData) => {
  const reportRows = reportData.map(r => `
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;">${r.user_name}</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${r.department || '-'}</td>
      <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${r.total_hours}</td>
      <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${r.task_count}</td>
    </tr>
  `).join('');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
      <h2 style="color: #3498db;">📊 周工时统计报表</h2>
      <p>尊敬的 ${managerName}：</p>
      <p>以下是上周部门工时统计汇总：</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
          <tr style="background-color: #f5f5f5;">
            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">姓名</th>
            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">部门</th>
            <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">总工时(h)</th>
            <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">任务数</th>
          </tr>
        </thead>
        <tbody>${reportRows}</tbody>
      </table>
      <p>请登录系统查看详情：<a href="${process.env.APP_URL}">项目管理系统</a></p>
      <hr>
      <p style="color: #999; font-size: 12px;">此邮件由系统自动发送，请勿直接回复。</p>
    </div>
  `;

  return sendMail(managerEmail, '上周工时统计报表', html);
};

module.exports = { sendMail, sendOverdueReminder, sendWeeklyReport };
