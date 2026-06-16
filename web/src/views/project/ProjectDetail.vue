<template>
  <div class="project-detail page-container">
    <div class="page-header">
      <div class="header-left">
        <el-button :icon="ArrowLeft" text @click="goBack">返回</el-button>
        <h2 class="page-title">{{ projectInfo.name }}</h2>
        <el-tag :type="statusType" size="large">{{ statusLabel }}</el-tag>
      </div>
      <div class="header-right">
        <el-button type="primary" :icon="Plus" @click="handleAddTask">
          新增任务
        </el-button>
        <el-button :icon="Edit" @click="handleEdit">编辑项目</el-button>
      </div>
    </div>
    
    <el-row :gutter="20" class="mb-20">
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-label">任务总数</div>
          <div class="stat-value">{{ taskStats.total_tasks || 0 }}</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card primary">
          <div class="stat-label">进行中</div>
          <div class="stat-value">{{ taskStats.in_progress_tasks || 0 }}</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card success">
          <div class="stat-label">已完成</div>
          <div class="stat-value">{{ taskStats.completed_tasks || 0 }}</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card warning">
          <div class="stat-label">完成率</div>
          <div class="stat-value">{{ completionRate }}%</div>
        </div>
      </el-col>
    </el-row>
    
    <el-row :gutter="20">
      <el-col :span="16">
        <div class="card-wrapper mb-20">
          <div class="card-header">
            <h3 class="section-title">任务列表</h3>
            <div class="filter-tabs">
              <el-radio-group v-model="taskStatusFilter" size="small" @change="loadTasks">
                <el-radio-button value="">全部</el-radio-button>
                <el-radio-button value="pending">待开始</el-radio-button>
                <el-radio-button value="in_progress">进行中</el-radio-button>
                <el-radio-button value="completed">已完成</el-radio-button>
              </el-radio-group>
            </div>
          </div>
          
          <el-table :data="taskList" stripe v-loading="taskLoading">
            <el-table-column prop="name" label="任务名称" min-width="200" />
            <el-table-column prop="assignee_name" label="负责人" width="100" />
            <el-table-column prop="priority" label="优先级" width="90">
              <template #default="{ row }">
                <el-tag :type="priorityType(row.priority)" size="small">
                  {{ priorityLabel(row.priority) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="90">
              <template #default="{ row }">
                <el-tag :type="taskStatusType(row.status)" size="small">
                  {{ taskStatusLabel(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="deadline" label="截止日期" width="120" />
            <el-table-column label="操作" width="120">
              <template #default="{ row }">
                <el-button type="primary" link size="small" @click="viewTask(row)">
                  查看
                </el-button>
                <el-button type="warning" link size="small" @click="editTask(row)">
                  编辑
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-col>
      
      <el-col :span="8">
        <div class="card-wrapper mb-20">
          <h3 class="section-title">项目信息</h3>
          <div class="info-list">
            <div class="info-item">
              <span class="label">项目主管</span>
              <span class="value">{{ projectInfo.manager_name }}</span>
            </div>
            <div class="info-item">
              <span class="label">所属部门</span>
              <span class="value">{{ projectInfo.department || '-' }}</span>
            </div>
            <div class="info-item">
              <span class="label">开始日期</span>
              <span class="value">{{ projectInfo.start_date || '-' }}</span>
            </div>
            <div class="info-item">
              <span class="label">结束日期</span>
              <span class="value">{{ projectInfo.end_date || '-' }}</span>
            </div>
            <div class="info-item">
              <span class="label">预计工时</span>
              <span class="value">{{ taskStats.estimated_hours || 0 }}h</span>
            </div>
            <div class="info-item">
              <span class="label">实际工时</span>
              <span class="value">{{ taskStats.actual_hours || 0 }}h</span>
            </div>
          </div>
        </div>
        
        <div class="card-wrapper">
          <h3 class="section-title">项目成员</h3>
          <div class="member-list">
            <div v-for="member in projectInfo.members" :key="member.id" class="member-item">
              <el-avatar :size="32" class="member-avatar">
                {{ member.real_name?.charAt(0) }}
              </el-avatar>
              <div class="member-info">
                <div class="member-name">{{ member.real_name }}</div>
                <div class="member-dept">{{ member.department || '-' }}</div>
              </div>
            </div>
          </div>
        </div>
      </el-col>
    </el-row>
    
    <el-dialog
      v-model="taskDialogVisible"
      :title="taskDialogTitle"
      width="550px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="taskFormRef"
        :model="taskForm"
        :rules="taskFormRules"
        label-width="100px"
      >
        <el-form-item label="任务名称" prop="name">
          <el-input v-model="taskForm.name" />
        </el-form-item>
        <el-form-item label="任务描述" prop="description">
          <el-input v-model="taskForm.description" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="负责人" prop="assignee_id">
          <el-select v-model="taskForm.assignee_id" style="width: 100%;">
            <el-option
              v-for="m in allMembers"
              :key="m.id"
              :label="m.real_name"
              :value="m.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="优先级" prop="priority">
          <el-select v-model="taskForm.priority" style="width: 100%;">
            <el-option label="低" value="low" />
            <el-option label="中" value="medium" />
            <el-option label="高" value="high" />
            <el-option label="紧急" value="urgent" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-select v-model="taskForm.status" style="width: 100%;">
            <el-option label="待开始" value="pending" />
            <el-option label="进行中" value="in_progress" />
            <el-option label="已完成" value="completed" />
          </el-select>
        </el-form-item>
        <el-form-item label="截止日期" prop="deadline">
          <el-date-picker
            v-model="taskForm.deadline"
            type="date"
            value-format="YYYY-MM-DD"
            style="width: 100%;"
          />
        </el-form-item>
        <el-form-item label="预计工时" prop="estimated_hours">
          <el-input-number v-model="taskForm.estimated_hours" :min="0" :step="0.5" style="width: 100%;" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="taskDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="taskSubmitting" @click="handleSubmitTask">
          确定
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Plus, Edit } from '@element-plus/icons-vue'
import { getProjectDetailApi, getProjectTasksApi } from '@/api/project'
import {
  createTaskApi,
  updateTaskApi
} from '@/api/task'
import { getMembersApi } from '@/api/user'
import {
  projectStatusMap,
  statusMap,
  priorityMap
} from '@/utils'

const router = useRouter()
const route = useRoute()

const projectId = computed(() => route.params.id)

const projectInfo = ref({})
const taskStats = ref({})
const taskList = ref([])
const taskLoading = ref(false)
const taskStatusFilter = ref('')
const memberList = ref([])
const allMembers = ref([])

const taskDialogVisible = ref(false)
const isTaskEdit = ref(false)
const taskFormRef = ref(null)
const taskSubmitting = ref(false)

const taskForm = reactive({
  id: null,
  name: '',
  description: '',
  project_id: null,
  assignee_id: null,
  priority: 'medium',
  status: 'pending',
  deadline: '',
  estimated_hours: null
})

const taskFormRules = {
  name: [
    { required: true, message: '请输入任务名称', trigger: 'blur' }
  ],
  assignee_id: [
    { required: true, message: '请选择负责人', trigger: 'change' }
  ],
  deadline: [
    { required: true, message: '请选择截止日期', trigger: 'change' }
  ]
}

const statusLabel = computed(() => projectStatusMap[projectInfo.value.status]?.label || '')
const statusType = computed(() => projectStatusMap[projectInfo.value.status]?.type || 'info')
const taskDialogTitle = computed(() => isTaskEdit.value ? '编辑任务' : '新增任务')

const completionRate = computed(() => {
  const total = taskStats.value.total_tasks || 0
  const completed = taskStats.value.completed_tasks || 0
  return total > 0 ? Math.round((completed / total) * 100) : 0
})

const priorityLabel = (p) => priorityMap[p]?.label || p
const priorityType = (p) => priorityMap[p]?.type || 'info'
const taskStatusLabel = (s) => statusMap[s]?.label || s
const taskStatusType = (s) => statusMap[s]?.type || 'info'

const goBack = () => {
  router.push('/projects')
}

const loadProjectDetail = async () => {
  try {
    const res = await getProjectDetailApi(projectId.value)
    projectInfo.value = res
    taskStats.value = res.task_stats || {}
  } catch (err) {
    console.error('加载项目详情失败:', err)
  }
}

const loadTasks = async () => {
  taskLoading.value = true
  try {
    const params = taskStatusFilter.value ? { status: taskStatusFilter.value } : {}
    taskList.value = await getProjectTasksApi(projectId.value, params)
  } catch (err) {
    console.error('加载任务列表失败:', err)
  } finally {
    taskLoading.value = false
  }
}

const loadMembers = async () => {
  try {
    allMembers.value = await getMembersApi()
  } catch (err) {
    console.error('加载成员列表失败:', err)
  }
}

const handleAddTask = () => {
  isTaskEdit.value = false
  Object.assign(taskForm, {
    id: null,
    name: '',
    description: '',
    project_id: projectId.value,
    assignee_id: null,
    priority: 'medium',
    status: 'pending',
    deadline: '',
    estimated_hours: null
  })
  taskDialogVisible.value = true
}

const editTask = (row) => {
  isTaskEdit.value = true
  Object.assign(taskForm, {
    id: row.id,
    name: row.name,
    description: row.description || '',
    project_id: row.project_id,
    assignee_id: row.assignee_id,
    priority: row.priority,
    status: row.status,
    deadline: row.deadline,
    estimated_hours: row.estimated_hours
  })
  taskDialogVisible.value = true
}

const viewTask = (row) => {
  editTask(row)
}

const handleSubmitTask = async () => {
  if (!taskFormRef.value) return
  
  await taskFormRef.value.validate(async (valid) => {
    if (valid) {
      taskSubmitting.value = true
      try {
        if (isTaskEdit.value) {
          await updateTaskApi(taskForm.id, taskForm)
          ElMessage.success('任务更新成功')
        } else {
          taskForm.project_id = projectId.value
          await createTaskApi(taskForm)
          ElMessage.success('任务创建成功')
        }
        taskDialogVisible.value = false
        loadProjectDetail()
        loadTasks()
      } catch (err) {
        console.error('提交失败:', err)
      } finally {
        taskSubmitting.value = false
      }
    }
  })
}

const handleEdit = () => {
  ElMessage.info('请前往项目列表页编辑')
}

onMounted(() => {
  loadMembers()
  loadProjectDetail()
  loadTasks()
})
</script>

<style scoped lang="scss">
.project-detail {
  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .header-right {
    display: flex;
    gap: 10px;
  }
  
  .stat-card {
    background: #fff;
    border-radius: 8px;
    padding: 20px;
    text-align: center;
    box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.06);
    border-left: 4px solid #909399;
    
    .stat-label {
      font-size: 13px;
      color: #909399;
      margin-bottom: 8px;
    }
    
    .stat-value {
      font-size: 28px;
      font-weight: 600;
      color: #303133;
    }
    
    &.primary {
      border-left-color: #409EFF;
      
      .stat-value {
        color: #409EFF;
      }
    }
    
    &.success {
      border-left-color: #67C23A;
      
      .stat-value {
        color: #67C23A;
      }
    }
    
    &.warning {
      border-left-color: #E6A23C;
      
      .stat-value {
        color: #E6A23C;
      }
    }
  }
  
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }
  
  .section-title {
    font-size: 16px;
    font-weight: 600;
    color: #303133;
    margin: 0;
  }
  
  .info-list {
    .info-item {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px dashed #ebeef5;
      
      &:last-child {
        border-bottom: none;
      }
      
      .label {
        color: #909399;
      }
      
      .value {
        color: #303133;
      }
    }
  }
  
  .member-list {
    .member-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 0;
      border-bottom: 1px dashed #ebeef5;
      
      &:last-child {
        border-bottom: none;
      }
      
      .member-avatar {
        background-color: #409EFF;
        color: #fff;
      }
      
      .member-name {
        font-size: 14px;
        color: #303133;
      }
      
      .member-dept {
        font-size: 12px;
        color: #909399;
      }
    }
  }
}
</style>
