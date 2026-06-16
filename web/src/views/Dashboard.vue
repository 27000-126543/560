<template>
  <div class="dashboard page-container">
    <div class="page-header">
      <h2 class="page-title">工作台</h2>
      <div class="user-welcome">
        <span>欢迎回来，{{ userStore.userName }}！</span>
      </div>
    </div>
    
    <el-row :gutter="20" class="mb-20">
      <el-col :span="6" v-for="(card, index) in statCards" :key="index">
        <div class="stat-card" :class="'card-' + (index + 1)">
          <div class="stat-icon">
            <el-icon :size="32"><component :is="card.icon" /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ card.value }}</div>
            <div class="stat-label">{{ card.label }}</div>
          </div>
        </div>
      </el-col>
    </el-row>
    
    <el-row :gutter="20">
      <el-col :span="16">
        <div class="card-wrapper mb-20">
          <h3 class="section-title">任务趋势</h3>
          <div ref="chartRef" style="height: 300px;"></div>
        </div>
        
        <div class="card-wrapper">
          <h3 class="section-title">最近任务</h3>
          <el-table :data="recentTasks" stripe style="width: 100%">
            <el-table-column prop="name" label="任务名称" min-width="200">
              <template #default="{ row }">
                <span class="link-text" @click="viewTask(row)">{{ row.name }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="project_name" label="所属项目" width="150" />
            <el-table-column prop="priority" label="优先级" width="100">
              <template #default="{ row }">
                <el-tag :type="priorityType(row.priority)" size="small">
                  {{ priorityLabel(row.priority) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="statusType(row.status)" size="small">
                  {{ statusLabel(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="deadline" label="截止日期" width="120">
              <template #default="{ row }">
                <span :class="{ 'text-danger': isOverdue(row) }">
                  {{ formatDate(row.deadline) }}
                </span>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-col>
      
      <el-col :span="8">
        <div class="card-wrapper mb-20">
          <div class="section-header-with-action">
            <h3 class="section-title">待处理提醒</h3>
            <el-link type="primary" :underline="false" @click="goTo('/notifications')">
              查看全部
            </el-link>
          </div>
          <div class="todo-list" v-loading="notificationsLoading">
            <div
              v-for="item in todoNotifications"
              :key="item.id"
              class="todo-item"
              @click="viewNotification(item)"
            >
              <div class="todo-icon" :class="todoTypeClass(item.type)">
                <el-icon :size="16">
                  <component :is="todoTypeIcon(item.type)" />
                </el-icon>
              </div>
              <div class="todo-content">
                <div class="todo-title">{{ item.title }}</div>
                <div class="todo-time">{{ formatDateShort(item.created_at) }}</div>
              </div>
              <div class="todo-dot" v-if="!item.is_read"></div>
            </div>
            <div v-if="todoNotifications.length === 0 && !notificationsLoading" class="empty-todo">
              暂无待处理事项
            </div>
          </div>
        </div>
        
        <div class="card-wrapper mb-20">
          <h3 class="section-title">快捷操作</h3>
          <div class="quick-actions">
            <el-button v-if="userStore.hasRole(['admin', 'manager'])" type="primary" @click="goTo('/projects')">
              <el-icon><Folder /></el-icon>
              项目管理
            </el-button>
            <el-button v-if="userStore.hasRole(['admin', 'manager'])" type="success" @click="goTo('/tasks')">
              <el-icon><List /></el-icon>
              任务管理
            </el-button>
            <el-button v-if="userStore.hasRole(['member', 'manager'])" type="warning" @click="goTo('/my-tasks')">
              <el-icon><Checked /></el-icon>
              我的任务
            </el-button>
            <el-button v-if="userStore.hasRole(['member', 'manager'])" type="info" @click="goTo('/my-worklogs')">
              <el-icon><EditPen /></el-icon>
              填报工时
            </el-button>
            <el-button v-if="userStore.hasRole(['admin', 'manager'])" type="danger" @click="goTo('/kanban')">
              <el-icon><Grid /></el-icon>
              进度看板
            </el-button>
            <el-button v-if="userStore.hasRole(['admin', 'manager'])" type="primary" plain @click="goTo('/reports')">
              <el-icon><DataLine /></el-icon>
              报表中心
            </el-button>
          </div>
        </div>
        
        <div class="card-wrapper">
          <h3 class="section-title">项目进度</h3>
          <div class="project-progress-list">
            <div v-for="project in projectProgress" :key="project.id" class="progress-item">
              <div class="progress-header">
                <span class="project-name">{{ project.name }}</span>
                <span class="progress-text">{{ project.progress }}%</span>
              </div>
              <el-progress :percentage="project.progress" :stroke-width="8" />
            </div>
          </div>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { getDashboardApi, getTaskTrendApi, getProjectProgressApi } from '@/api/report'
import { getTaskListApi } from '@/api/task'
import { getNotificationListApi, markNotificationReadApi } from '@/api/notification'
import { formatDate, statusMap, priorityMap } from '@/utils'
import * as echarts from 'echarts'
import {
  Folder, List, Checked, EditPen, Grid, DataLine,
  User, Document, Warning, Clock, Bell, Message
} from '@element-plus/icons-vue'
import dayjs from 'dayjs'

const router = useRouter()
const userStore = useUserStore()
const chartRef = ref(null)
let chartInstance = null

const dashboardData = ref({})
const taskTrend = ref([])
const projectProgress = ref([])
const recentTasks = ref([])
const todoNotifications = ref([])
const notificationsLoading = ref(false)

const todoTypeIcon = (type) => {
  const map = {
    task_assign: List,
    task_reject: Warning,
    worklog_submit: Clock,
    worklog_approve: Checked,
    worklog_reject: Warning,
    mention: Message,
    system: Bell
  }
  return map[type] || Bell
}

const todoTypeClass = (type) => {
  const map = {
    task_assign: 'primary',
    task_reject: 'danger',
    worklog_submit: 'warning',
    worklog_approve: 'success',
    worklog_reject: 'danger',
    mention: 'primary',
    system: 'info'
  }
  return map[type] || 'info'
}

const formatDateShort = (date) => {
  return dayjs(date).format('MM-DD HH:mm')
}

const statCards = computed(() => {
  const role = userStore.userRole
  const data = dashboardData.value
  
  if (role === 'admin') {
    return [
      { label: '总用户数', value: data.users?.total_users || 0, icon: 'User' },
      { label: '总项目数', value: data.projects?.total_projects || 0, icon: 'Folder' },
      { label: '总任务数', value: data.tasks?.total_tasks || 0, icon: 'List' },
      { label: '逾期任务', value: data.overdue_tasks || 0, icon: 'Warning' }
    ]
  } else if (role === 'manager') {
    return [
      { label: '我的项目', value: data.projects?.total_projects || 0, icon: 'Folder' },
      { label: '进行中任务', value: data.tasks?.in_progress_tasks || 0, icon: 'Clock' },
      { label: '待审核工时', value: data.pending_logs || 0, icon: 'Document' },
      { label: '逾期任务', value: data.overdue_tasks || 0, icon: 'Warning' }
    ]
  } else {
    return [
      { label: '我的任务', value: data.tasks?.total_tasks || 0, icon: 'List' },
      { label: '进行中', value: data.tasks?.in_progress_tasks || 0, icon: 'Clock' },
      { label: '本周工时', value: data.week_hours || 0, icon: 'EditPen' },
      { label: '已完成', value: data.tasks?.completed_tasks || 0, icon: 'Checked' }
    ]
  }
})

const loadDashboard = async () => {
  try {
    dashboardData.value = await getDashboardApi()
  } catch (err) {
    console.error('加载看板数据失败:', err)
  }
}

const loadTaskTrend = async () => {
  try {
    taskTrend.value = await getTaskTrendApi({ days: 7 })
    renderChart()
  } catch (err) {
    console.error('加载任务趋势失败:', err)
  }
}

const loadProjectProgress = async () => {
  if (!userStore.hasRole(['admin', 'manager'])) return
  try {
    projectProgress.value = await getProjectProgressApi()
  } catch (err) {
    console.error('加载项目进度失败:', err)
  }
}

const loadRecentTasks = async () => {
  try {
    const res = await getTaskListApi({ page_size: 5, page: 1 })
    recentTasks.value = res.list || []
  } catch (err) {
    console.error('加载最近任务失败:', err)
  }
}

const loadTodoNotifications = async () => {
  notificationsLoading.value = true
  try {
    const res = await getNotificationListApi({ page_size: 5, page: 1, is_read: 0 })
    todoNotifications.value = res.list || []
  } catch (err) {
    console.error('加载待办通知失败:', err)
  } finally {
    notificationsLoading.value = false
  }
}

const viewNotification = async (item) => {
  if (!item.is_read) {
    try {
      await markNotificationReadApi(item.id)
      item.is_read = 1
    } catch (err) {
      console.error('标记已读失败:', err)
    }
  }
  if (item.related_type === 'task') {
    if (userStore.hasRole(['admin', 'manager'])) {
      router.push('/tasks')
    } else {
      router.push('/my-tasks')
    }
  } else {
    router.push('/notifications')
  }
}

const renderChart = () => {
  if (!chartRef.value) return
  
  if (chartInstance) {
    chartInstance.dispose()
  }
  
  chartInstance = echarts.init(chartRef.value)
  
  const dates = taskTrend.value.map(item => item.date)
  const createdData = taskTrend.value.map(item => item.created)
  const completedData = taskTrend.value.map(item => item.completed)
  
  const option = {
    tooltip: {
      trigger: 'axis'
    },
    legend: {
      data: ['新增任务', '完成任务']
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: dates
    },
    yAxis: {
      type: 'value'
    },
    series: [
      {
        name: '新增任务',
        type: 'line',
        data: createdData,
        smooth: true,
        itemStyle: { color: '#409EFF' }
      },
      {
        name: '完成任务',
        type: 'line',
        data: completedData,
        smooth: true,
        itemStyle: { color: '#67C23A' }
      }
    ]
  }
  
  chartInstance.setOption(option)
}

const statusLabel = (status) => statusMap[status]?.label || status
const statusType = (status) => statusMap[status]?.type || 'info'
const priorityLabel = (priority) => priorityMap[priority]?.label || priority
const priorityType = (priority) => priorityMap[priority]?.type || 'info'

const isOverdue = (task) => {
  if (task.status === 'completed') return false
  return new Date(task.deadline) < new Date()
}

const viewTask = (task) => {
  if (userStore.hasRole(['admin', 'manager'])) {
    router.push('/tasks')
  } else {
    router.push('/my-tasks')
  }
}

const goTo = (path) => {
  router.push(path)
}

onMounted(() => {
  loadDashboard()
  loadTaskTrend()
  loadProjectProgress()
  loadRecentTasks()
  loadTodoNotifications()
  
  window.addEventListener('resize', () => {
    chartInstance?.resize()
  })
})
</script>

<style scoped lang="scss">
.dashboard {
  .user-welcome {
    color: #606266;
    font-size: 14px;
  }
}

.stat-card {
  background: #fff;
  border-radius: 8px;
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 20px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.06);
  
  .stat-icon {
    width: 64px;
    height: 64px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
  }
  
  &.card-1 .stat-icon {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }
  
  &.card-2 .stat-icon {
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  }
  
  &.card-3 .stat-icon {
    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  }
  
  &.card-4 .stat-icon {
    background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
  }
  
  .stat-info {
    .stat-value {
      font-size: 28px;
      font-weight: 600;
      color: #303133;
      margin-bottom: 4px;
    }
    
    .stat-label {
      font-size: 13px;
      color: #909399;
    }
  }
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 20px;
}

.quick-actions {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  
  .el-button {
    width: 100%;
    height: 50px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
}

.project-progress-list {
  .progress-item {
    margin-bottom: 20px;
    
    &:last-child {
      margin-bottom: 0;
    }
  }
  
  .progress-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  
  .project-name {
    font-size: 14px;
    color: #303133;
  }
  
  .progress-text {
    font-size: 14px;
    color: #409EFF;
    font-weight: 500;
  }
}

.link-text {
  color: #409EFF;
  cursor: pointer;
  
  &:hover {
    text-decoration: underline;
  }
}

.text-danger {
  color: #F56C6C;
}

.section-header-with-action {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  
  .section-title {
    margin: 0;
  }
}

.todo-list {
  .todo-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 0;
    border-bottom: 1px solid #f2f6fc;
    cursor: pointer;
    position: relative;
    
    &:last-child {
      border-bottom: none;
    }
    
    &:hover {
      background-color: #f5f7fa;
      margin: 0 -10px;
      padding-left: 10px;
      padding-right: 10px;
      border-radius: 4px;
    }
    
    .todo-icon {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      color: #fff;
      
      &.primary { background-color: #409EFF; }
      &.success { background-color: #67C23A; }
      &.warning { background-color: #E6A23C; }
      &.danger { background-color: #F56C6C; }
      &.info { background-color: #909399; }
    }
    
    .todo-content {
      flex: 1;
      min-width: 0;
      
      .todo-title {
        font-size: 14px;
        color: #303133;
        margin-bottom: 4px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      
      .todo-time {
        font-size: 12px;
        color: #909399;
      }
    }
    
    .todo-dot {
      width: 8px;
      height: 8px;
      background-color: #F56C6C;
      border-radius: 50%;
      flex-shrink: 0;
    }
  }
  
  .empty-todo {
    text-align: center;
    color: #909399;
    padding: 30px 0;
    font-size: 14px;
  }
}
</style>
