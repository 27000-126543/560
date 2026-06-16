<template>
  <div class="my-tasks page-container">
    <div class="page-header">
      <h2 class="page-title">我的任务</h2>
      <div class="header-stats">
        <el-tag type="primary">进行中：{{ stats.in_progress }}</el-tag>
        <el-tag type="success">已完成：{{ stats.completed }}</el-tag>
        <el-tag type="warning">待开始：{{ stats.pending }}</el-tag>
        <el-tag type="danger">已驳回：{{ stats.rejected }}</el-tag>
      </div>
    </div>
    
    <div class="card-wrapper mb-20">
      <el-form :inline="true" :model="searchForm">
        <el-form-item label="任务名称">
          <el-input
            v-model="searchForm.keyword"
            placeholder="请输入任务名称"
            clearable
            style="width: 200px;"
            @keyup.enter="loadData"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="全部" clearable style="width: 120px;">
            <el-option label="待开始" value="pending" />
            <el-option label="进行中" value="in_progress" />
            <el-option label="已完成" value="completed" />
            <el-option label="已驳回" value="rejected" />
          </el-select>
        </el-form-item>
        <el-form-item label="优先级">
          <el-select v-model="searchForm.priority" placeholder="全部" clearable style="width: 100px;">
            <el-option label="紧急" value="urgent" />
            <el-option label="高" value="high" />
            <el-option label="中" value="medium" />
            <el-option label="低" value="low" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="loadData">搜索</el-button>
          <el-button :icon="Refresh" @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </div>
    
    <div class="card-wrapper">
      <el-table :data="tableData" stripe v-loading="loading">
        <el-table-column type="index" label="序号" width="60" align="center" />
        <el-table-column prop="name" label="任务名称" min-width="220">
          <template #default="{ row }">
            <span class="link-text" @click="handleView(row)">{{ row.name }}</span>
            <el-tag v-if="row.status === 'rejected'" type="danger" size="small" class="ml-10">
              已驳回
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="project_name" label="所属项目" width="140" />
        <el-table-column prop="priority" label="优先级" width="80">
          <template #default="{ row }">
            <el-tag :type="priorityType(row.priority)" size="small">
              {{ priorityLabel(row.priority) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small">
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="deadline" label="截止日期" width="120">
          <template #default="{ row }">
            <span :class="{ 'text-danger': isOverdue(row) }">
              {{ row.deadline }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="工时" width="120">
          <template #default="{ row }">
            {{ row.actual_hours || 0 }} / {{ row.estimated_hours || '-' }}h
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handleView(row)">
              详情
            </el-button>
            <el-button
              v-if="row.status !== 'completed'"
              type="success"
              link
              size="small"
              @click="handleAddWorkLog(row)"
            >
              填报工时
            </el-button>
            <el-dropdown
              v-if="row.status !== 'completed'"
              @command="(cmd) => handleChangeStatus(row, cmd)"
            >
              <el-button type="warning" link size="small">
                状态 <el-icon class="el-icon--right"><ArrowDown /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item v-if="row.status === 'pending'" command="in_progress">
                    开始任务
                  </el-dropdown-item>
                  <el-dropdown-item v-if="row.status === 'in_progress'" command="completed">
                    完成任务
                  </el-dropdown-item>
                  <el-dropdown-item v-if="row.status === 'rejected'" command="in_progress">
                    重新开始
                  </el-dropdown-item>
                  <el-dropdown-item command="pending">
                    设为待开始
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
      </el-table>
      
      <div class="pagination">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.page_size"
          :page-sizes="[10, 20, 50]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </div>
    
    <el-dialog
      v-model="detailDialogVisible"
      title="任务详情"
      width="760px"
      class="task-detail-dialog"
    >
      <div class="task-detail" v-if="taskDetail">
        <div class="detail-header">
          <h3>{{ taskDetail.name }}</h3>
          <div class="detail-tags">
            <el-tag :type="priorityType(taskDetail.priority)">
              {{ priorityLabel(taskDetail.priority) }}
            </el-tag>
            <el-tag :type="statusType(taskDetail.status)">
              {{ statusLabel(taskDetail.status) }}
            </el-tag>
          </div>
        </div>
        
        <el-descriptions :column="2" border>
          <el-descriptions-item label="所属项目">{{ taskDetail.project_name }}</el-descriptions-item>
          <el-descriptions-item label="创建人">{{ taskDetail.creator_name }}</el-descriptions-item>
          <el-descriptions-item label="截止日期">
            <span :class="{ 'text-danger': isOverdue(taskDetail) }">
              {{ taskDetail.deadline }}
            </span>
          </el-descriptions-item>
          <el-descriptions-item label="预计工时">{{ taskDetail.estimated_hours || '-' }}h</el-descriptions-item>
          <el-descriptions-item label="实际工时" :span="2">
            {{ taskDetail.actual_hours || 0 }}h
          </el-descriptions-item>
        </el-descriptions>
        
        <div class="detail-section" v-if="taskDetail.description">
          <h4>任务描述</h4>
          <p>{{ taskDetail.description }}</p>
        </div>
        
        <div class="detail-section" v-if="taskDetail.reject_reason">
          <h4>驳回原因</h4>
          <p class="reject-reason">{{ taskDetail.reject_reason }}</p>
        </div>
        
        <div class="detail-section">
          <div class="section-header">
            <h4>工时记录</h4>
            <el-button type="primary" size="small" @click="handleAddWorkLog(taskDetail)">
              新增工时
            </el-button>
          </div>
          <el-table :data="taskDetail.work_logs || []" size="small">
            <el-table-column prop="work_date" label="日期" width="110" />
            <el-table-column prop="hours" label="工时" width="80">
              <template #default="{ row }">{{ row.hours }}h</template>
            </el-table-column>
            <el-table-column prop="log_content" label="工作内容" show-overflow-tooltip />
            <el-table-column prop="status" label="状态" width="80">
              <template #default="{ row }">
                <el-tag :type="logStatusType(row.status)" size="small">
                  {{ logStatusLabel(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
        
        <div class="detail-section">
          <div class="section-header">
            <h4>动态与评论</h4>
          </div>
          
          <div class="comment-input-wrapper">
            <el-input
              v-model="commentContent"
              type="textarea"
              :rows="3"
              placeholder="输入评论，支持@项目成员..."
              maxlength="500"
              show-word-limit
            />
            <div class="comment-actions">
              <el-select
                v-model="mentionedUserIds"
                multiple
                filterable
                placeholder="@成员"
                size="small"
                style="width: 200px;"
              >
                <el-option
                  v-for="member in projectMembers"
                  :key="member.id"
                  :label="member.name"
                  :value="member.id"
                />
              </el-select>
              <el-button
                type="primary"
                size="small"
                :loading="commentSubmitting"
                :disabled="!commentContent.trim()"
                @click="handleSubmitComment"
              >
                发表评论
              </el-button>
            </div>
          </div>
          
          <div class="timeline-wrapper">
            <el-timeline v-loading="activitiesLoading">
              <el-timeline-item
                v-for="activity in activities"
                :key="activity.id"
                :timestamp="formatDateTime(activity.created_at)"
                :type="activityType(activity.type)"
                :icon="activityIcon(activity.type)"
              >
                <div class="timeline-item-header">
                  <el-avatar :size="28" :src="activity.avatar">
                    {{ activity.user_name?.charAt(0) }}
                  </el-avatar>
                  <span class="user-name">{{ activity.user_name }}</span>
                  <span class="activity-type-tag">{{ activityTypeLabel(activity.type) }}</span>
                </div>
                <div class="timeline-item-content">
                  <p v-if="activity.type === 'comment'" class="comment-text">
                    {{ activity.content }}
                  </p>
                  <p v-else>{{ activity.content }}</p>
                </div>
              </el-timeline-item>
            </el-timeline>
            <div v-if="activities.length === 0 && !activitiesLoading" class="empty-text">
              暂无动态
            </div>
          </div>
        </div>
      </div>
    </el-dialog>
    
    <el-dialog
      v-model="workLogDialogVisible"
      title="填报工时"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="workLogFormRef"
        :model="workLogForm"
        :rules="workLogRules"
        label-width="100px"
      >
        <el-form-item label="任务">
          <el-input v-model="currentTaskName" disabled />
        </el-form-item>
        <el-form-item label="日期" prop="work_date">
          <el-date-picker
            v-model="workLogForm.work_date"
            type="date"
            value-format="YYYY-MM-DD"
            style="width: 100%;"
          />
        </el-form-item>
        <el-form-item label="工时" prop="hours">
          <el-input-number
            v-model="workLogForm.hours"
            :min="0.5"
            :max="24"
            :step="0.5"
            style="width: 100%;"
          />
          <div class="form-tip">工时精确到半小时，单日总工时不超过24小时</div>
        </el-form-item>
        <el-form-item label="工作内容" prop="log_content">
          <el-input
            v-model="workLogForm.log_content"
            type="textarea"
            :rows="4"
            placeholder="请详细描述今日工作内容"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="workLogDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="workLogSubmitting" @click="handleSubmitWorkLog">
          提交
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, Refresh, ArrowDown, ChatDotRound, Clock, Edit, Warning, Check, Close } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import dayjs from 'dayjs'
import {
  getTaskListApi,
  getTaskDetailApi,
  updateTaskStatusApi,
  getTaskActivitiesApi,
  addTaskCommentApi
} from '@/api/task'
import { createWorkLogApi } from '@/api/worklog'
import { getProjectDetailApi } from '@/api/project'
import {
  statusMap,
  priorityMap,
  workLogStatusMap
} from '@/utils'

const router = useRouter()

const loading = ref(false)
const workLogSubmitting = ref(false)
const detailDialogVisible = ref(false)
const workLogDialogVisible = ref(false)
const workLogFormRef = ref(null)
const tableData = ref([])
const taskDetail = ref(null)
const currentTaskId = ref(null)
const currentTaskName = ref('')

const activities = ref([])
const activitiesLoading = ref(false)
const commentContent = ref('')
const commentSubmitting = ref(false)
const mentionedUserIds = ref([])
const projectMembers = ref([])

const searchForm = reactive({
  keyword: '',
  status: '',
  priority: ''
})

const pagination = reactive({
  page: 1,
  page_size: 10,
  total: 0
})

const workLogForm = reactive({
  task_id: null,
  work_date: '',
  hours: 1,
  log_content: ''
})

const workLogRules = {
  work_date: [
    { required: true, message: '请选择日期', trigger: 'change' }
  ],
  hours: [
    { required: true, message: '请填写工时', trigger: 'blur' }
  ],
  log_content: [
    { required: true, message: '请填写工作内容', trigger: 'blur' }
  ]
}

const stats = computed(() => {
  const list = tableData.value
  return {
    total: list.length,
    pending: list.filter(t => t.status === 'pending').length,
    in_progress: list.filter(t => t.status === 'in_progress').length,
    completed: list.filter(t => t.status === 'completed').length,
    rejected: list.filter(t => t.status === 'rejected').length
  }
})

const statusLabel = (s) => statusMap[s]?.label || s
const statusType = (s) => statusMap[s]?.type || 'info'
const priorityLabel = (p) => priorityMap[p]?.label || p
const priorityType = (p) => priorityMap[p]?.type || 'info'
const logStatusLabel = (s) => workLogStatusMap[s]?.label || s
const logStatusType = (s) => workLogStatusMap[s]?.type || 'info'

const isOverdue = (task) => {
  if (task.status === 'completed') return false
  return new Date(task.deadline) < new Date()
}

const loadData = async () => {
  loading.value = true
  try {
    const res = await getTaskListApi({
      ...searchForm,
      page: pagination.page,
      page_size: pagination.page_size
    })
    tableData.value = res.list
    pagination.total = res.total
  } catch (err) {
    console.error('加载任务列表失败:', err)
  } finally {
    loading.value = false
  }
}

const handleReset = () => {
  searchForm.keyword = ''
  searchForm.status = ''
  searchForm.priority = ''
  pagination.page = 1
  loadData()
}

const handleSizeChange = (size) => {
  pagination.page_size = size
  pagination.page = 1
  loadData()
}

const handlePageChange = (page) => {
  pagination.page = page
  loadData()
}

const handleView = async (row) => {
  try {
    taskDetail.value = await getTaskDetailApi(row.id)
    currentTaskId.value = row.id
    detailDialogVisible.value = true
    commentContent.value = ''
    mentionedUserIds.value = []
    loadActivities(row.id)
    loadProjectMembers(taskDetail.value.project_id)
  } catch (err) {
    console.error('获取任务详情失败:', err)
  }
}

const loadActivities = async (taskId) => {
  activitiesLoading.value = true
  try {
    activities.value = await getTaskActivitiesApi(taskId)
  } catch (err) {
    console.error('获取活动记录失败:', err)
  } finally {
    activitiesLoading.value = false
  }
}

const loadProjectMembers = async (projectId) => {
  if (!projectId) {
    projectMembers.value = []
    return
  }
  try {
    const detail = await getProjectDetailApi(projectId)
    projectMembers.value = detail.members || []
  } catch (err) {
    console.error('获取项目成员失败:', err)
  }
}

const handleSubmitComment = async () => {
  if (!commentContent.value.trim()) return
  commentSubmitting.value = true
  try {
    const newActivity = await addTaskCommentApi(currentTaskId.value, {
      content: commentContent.value.trim(),
      mentioned_user_ids: mentionedUserIds.value
    })
    activities.value.unshift(newActivity)
    commentContent.value = ''
    mentionedUserIds.value = []
    ElMessage.success('评论发表成功')
  } catch (err) {
    console.error('发表评论失败:', err)
  } finally {
    commentSubmitting.value = false
  }
}

const activityType = (type) => {
  const map = {
    comment: 'primary',
    create: 'success',
    update_status: 'warning',
    assign: 'info',
    worklog_submit: 'primary',
    worklog_approve: 'success',
    worklog_reject: 'danger'
  }
  return map[type] || 'info'
}

const activityTypeLabel = (type) => {
  const map = {
    comment: '评论',
    create: '创建任务',
    update_status: '状态变更',
    assign: '分配任务',
    worklog_submit: '提交工时',
    worklog_approve: '审核通过',
    worklog_reject: '审核驳回'
  }
  return map[type] || type
}

const activityIcon = (type) => {
  const map = {
    comment: ChatDotRound,
    create: Edit,
    update_status: Warning,
    worklog_submit: Clock,
    worklog_approve: Check,
    worklog_reject: Close
  }
  return map[type] || null
}

const formatDateTime = (date) => {
  return dayjs(date).format('YYYY-MM-DD HH:mm')
}

const handleChangeStatus = async (row, status) => {
  try {
    await updateTaskStatusApi(row.id, status)
    ElMessage.success('状态更新成功')
    loadData()
    if (taskDetail.value?.id === row.id) {
      taskDetail.value.status = status
    }
  } catch (err) {
    console.error('更新状态失败:', err)
  }
}

const handleAddWorkLog = (row) => {
  currentTaskId.value = row.id
  currentTaskName.value = row.name
  Object.assign(workLogForm, {
    task_id: row.id,
    work_date: new Date().toISOString().split('T')[0],
    hours: 1,
    log_content: ''
  })
  detailDialogVisible.value = false
  workLogDialogVisible.value = true
}

const handleSubmitWorkLog = async () => {
  if (!workLogFormRef.value) return
  
  await workLogFormRef.value.validate(async (valid) => {
    if (valid) {
      workLogSubmitting.value = true
      try {
        await createWorkLogApi(workLogForm)
        ElMessage.success('工时提交成功')
        workLogDialogVisible.value = false
        loadData()
      } catch (err) {
        console.error('提交工时失败:', err)
      } finally {
        workLogSubmitting.value = false
      }
    }
  })
}

onMounted(() => {
  loadData()
})
</script>

<style scoped lang="scss">
.my-tasks {
  .header-stats {
    display: flex;
    gap: 10px;
    
    .el-tag {
      height: 28px;
      line-height: 26px;
      font-size: 13px;
    }
  }
  
  .pagination {
    margin-top: 20px;
    display: flex;
    justify-content: flex-end;
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
  
  .ml-10 {
    margin-left: 10px;
  }
  
  .task-detail {
    .detail-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      
      h3 {
        margin: 0;
        font-size: 18px;
      }
      
      .detail-tags {
        display: flex;
        gap: 10px;
      }
    }
    
    .detail-section {
      margin-top: 20px;
      
      .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
      }
      
      h4 {
        font-size: 14px;
        color: #303133;
        margin: 0;
      }
      
      p {
        color: #606266;
        line-height: 1.6;
        margin: 0;
      }
      
      .reject-reason {
        color: #F56C6C;
        background: #fef0f0;
        padding: 10px;
        border-radius: 4px;
      }
      
      .comment-input-wrapper {
        margin-bottom: 20px;
        
        .comment-actions {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 10px;
          margin-top: 10px;
        }
      }
      
      .timeline-wrapper {
        max-height: 400px;
        overflow-y: auto;
        padding-right: 10px;
        
        .timeline-item-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 8px;
          
          .user-name {
            font-weight: 600;
            color: #303133;
            font-size: 14px;
          }
          
          .activity-type-tag {
            font-size: 12px;
            color: #909399;
            background: #f4f4f5;
            padding: 2px 8px;
            border-radius: 10px;
          }
        }
        
        .timeline-item-content {
          .comment-text {
            background: #f5f7fa;
            padding: 10px 12px;
            border-radius: 6px;
            display: inline-block;
            max-width: 100%;
            word-break: break-word;
          }
          
          p {
            margin: 0;
            color: #606266;
            font-size: 14px;
          }
        }
        
        .empty-text {
          text-align: center;
          color: #909399;
          padding: 30px 0;
          font-size: 14px;
        }
      }
    }
  }
  
  .form-tip {
    font-size: 12px;
    color: #909399;
    margin-top: 5px;
  }
}
</style>
