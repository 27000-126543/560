<template>
  <div class="my-worklogs page-container">
    <div class="page-header">
      <h2 class="page-title">我的工时</h2>
      <div class="header-actions">
        <el-radio-group v-model="viewMode" size="default" class="view-switcher">
          <el-radio-button value="calendar">
            <el-icon><Calendar /></el-icon>
            <span>日历视图</span>
          </el-radio-button>
          <el-radio-button value="list">
            <el-icon><List /></el-icon>
            <span>列表视图</span>
          </el-radio-button>
        </el-radio-group>
        <el-button type="primary" :icon="Plus" @click="handleAdd()">
          填报工时
        </el-button>
      </div>
    </div>
    
    <el-row :gutter="20" class="mb-20">
      <el-col :span="6">
        <div class="stat-card total">
          <div class="stat-icon"><el-icon><Clock /></el-icon></div>
          <div class="stat-info">
            <div class="stat-value">{{ stats.total_hours || 0 }}</div>
            <div class="stat-label">总工时 (h)</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card approved">
          <div class="stat-icon"><el-icon><CircleCheck /></el-icon></div>
          <div class="stat-info">
            <div class="stat-value">{{ stats.approved_count || 0 }}</div>
            <div class="stat-label">已通过</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card pending">
          <div class="stat-icon"><el-icon><Timer /></el-icon></div>
          <div class="stat-info">
            <div class="stat-value">{{ stats.pending_count || 0 }}</div>
            <div class="stat-label">审核中</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card rejected">
          <div class="stat-icon"><el-icon><Close /></el-icon></div>
          <div class="stat-info">
            <div class="stat-value">{{ stats.rejected_count || 0 }}</div>
            <div class="stat-label">已驳回</div>
          </div>
        </div>
      </el-col>
    </el-row>
    
    <div v-if="viewMode === 'calendar'" class="card-wrapper calendar-wrapper">
      <div class="calendar-header">
        <h3>{{ currentMonthLabel }}</h3>
        <div class="calendar-legend">
          <span class="legend-item approved-dot">已通过</span>
          <span class="legend-item submitted-dot">审核中</span>
          <span class="legend-item rejected-dot">已驳回</span>
          <span class="legend-item empty-dot">未填报</span>
        </div>
      </div>
      <el-calendar v-model="currentDate" ref="calendarRef">
        <template #date-cell="{ data }">
          <div 
            class="calendar-cell" 
            :class="{
              'is-today': data.isToday,
              'has-log': calendarData[data.day]?.total_hours > 0,
              'has-rejected': calendarData[data.day]?.rejected_count > 0,
              'other-month': data.type !== 'current-month'
            }"
            @click="handleDayClick(data.day)"
          >
            <div class="cell-date">{{ data.day.split('-').slice(1).join('/') }}</div>
            <div class="cell-hours" v-if="calendarData[data.day]?.total_hours">
              {{ calendarData[data.day].total_hours }}h
            </div>
            <div class="cell-status" v-if="calendarData[data.day]?.log_count">
              <span 
                v-if="calendarData[data.day].rejected_count > 0"
                class="status-dot rejected"
                :title="`${calendarData[data.day].rejected_count}条被驳回`"
              ></span>
              <span 
                v-if="calendarData[data.day].submitted_hours > 0"
                class="status-dot submitted"
                title="有待审核记录"
              ></span>
              <span 
                v-if="calendarData[data.day].approved_hours > 0 && calendarData[data.day].rejected_count === 0 && calendarData[data.day].submitted_hours === 0"
                class="status-dot approved"
                title="已通过"
              ></span>
            </div>
          </div>
        </template>
      </el-calendar>
    </div>
    
    <div v-if="viewMode === 'list'" class="card-wrapper mb-20">
      <el-form :inline="true" :model="searchForm">
        <el-form-item label="日期范围">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            style="width: 240px;"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="全部" clearable style="width: 120px;">
            <el-option label="已提交" value="submitted" />
            <el-option label="已通过" value="approved" />
            <el-option label="已驳回" value="rejected" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="loadListData">搜索</el-button>
          <el-button :icon="Refresh" @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </div>
    
    <div v-if="viewMode === 'list'" class="card-wrapper">
      <el-table :data="tableData" stripe v-loading="loading">
        <el-table-column type="index" label="序号" width="60" align="center" />
        <el-table-column prop="work_date" label="日期" width="110" />
        <el-table-column prop="project_name" label="项目" width="140" />
        <el-table-column prop="task_name" label="任务" min-width="180" />
        <el-table-column prop="hours" label="工时" width="80">
          <template #default="{ row }">
            <span class="hours-text">{{ row.hours }}h</span>
          </template>
        </el-table-column>
        <el-table-column prop="log_content" label="工作内容" min-width="200" show-overflow-tooltip />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small">
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handleView(row)">
              详情
            </el-button>
            <el-button
              v-if="row.status === 'rejected'"
              type="warning"
              link
              size="small"
              @click="handleEdit(row)"
            >
              编辑
            </el-button>
            <el-button
              v-if="row.status === 'rejected'"
              type="danger"
              link
              size="small"
              @click="handleDelete(row)"
            >
              删除
            </el-button>
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
      v-model="dayDialogVisible"
      :title="`${selectedDay} 工时记录`"
      width="700px"
    >
      <div class="day-logs">
        <div class="day-summary">
          <el-statistic title="当日总工时" :value="dayStats.total_hours" suffix="小时" />
          <el-button type="primary" size="small" :icon="Plus" @click="handleAdd(selectedDay)">
            新增工时
          </el-button>
        </div>
        <el-table :data="dayLogs" size="small" v-loading="dayLoading">
          <el-table-column prop="project_name" label="项目" width="120" />
          <el-table-column prop="task_name" label="任务" min-width="150" />
          <el-table-column prop="hours" label="工时" width="80">
            <template #default="{ row }">{{ row.hours }}h</template>
          </el-table-column>
          <el-table-column prop="log_content" label="工作内容" min-width="200" show-overflow-tooltip />
          <el-table-column prop="status" label="状态" width="90">
            <template #default="{ row }">
              <el-tag :type="statusType(row.status)" size="small">
                {{ statusLabel(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="120" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" link size="small" @click="handleView(row)">详情</el-button>
              <el-button
                v-if="row.status === 'rejected'"
                type="warning"
                link
                size="small"
                @click="handleEdit(row)"
              >
                编辑
              </el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!dayLoading && dayLogs.length === 0" description="当天暂无工时记录" />
      </div>
    </el-dialog>
    
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="100px"
      >
        <el-form-item label="任务" prop="task_id">
          <el-select v-model="formData.task_id" style="width: 100%;" placeholder="请选择任务">
            <el-option
              v-for="t in myTasks"
              :key="t.id"
              :label="t.name"
              :value="t.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="日期" prop="work_date">
          <el-date-picker
            v-model="formData.work_date"
            type="date"
            value-format="YYYY-MM-DD"
            style="width: 100%;"
          />
        </el-form-item>
        <el-form-item label="工时" prop="hours">
          <el-input-number
            v-model="formData.hours"
            :min="0.5"
            :max="24"
            :step="0.5"
            style="width: 100%;"
          />
          <div class="form-tip">工时精确到半小时，单日总工时不超过24小时</div>
        </el-form-item>
        <el-form-item label="工作内容" prop="log_content">
          <el-input
            v-model="formData.log_content"
            type="textarea"
            :rows="4"
            placeholder="请详细描述今日工作内容"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">
          提交
        </el-button>
      </template>
    </el-dialog>
    
    <el-dialog
      v-model="detailDialogVisible"
      title="工时记录详情"
      width="500px"
    >
      <div class="log-detail" v-if="logDetail">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="日期">{{ logDetail.work_date }}</el-descriptions-item>
          <el-descriptions-item label="工时">{{ logDetail.hours }}h</el-descriptions-item>
          <el-descriptions-item label="项目" :span="2">{{ logDetail.project_name }}</el-descriptions-item>
          <el-descriptions-item label="任务" :span="2">{{ logDetail.task_name }}</el-descriptions-item>
        </el-descriptions>
        
        <div class="detail-section">
          <h4>工作内容</h4>
          <p>{{ logDetail.log_content }}</p>
        </div>
        
        <div class="detail-section">
          <h4>状态</h4>
          <el-tag :type="statusType(logDetail.status)" size="large">
            {{ statusLabel(logDetail.status) }}
          </el-tag>
        </div>
        
        <div class="detail-section" v-if="logDetail.reject_reason">
          <h4>驳回原因</h4>
          <p class="reject-reason">{{ logDetail.reject_reason }}</p>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Search, Refresh, Plus, Clock, CircleCheck, Timer, Close, Calendar, List
} from '@element-plus/icons-vue'
import {
  getWorkLogListApi,
  getWorkLogDetailApi,
  createWorkLogApi,
  updateWorkLogApi,
  deleteWorkLogApi,
  getWorkLogCalendarApi
} from '@/api/worklog'
import { getMyTasksApi } from '@/api/task'
import { workLogStatusMap } from '@/utils'

const loading = ref(false)
const dayLoading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const detailDialogVisible = ref(false)
const dayDialogVisible = ref(false)
const isEdit = ref(false)
const formRef = ref(null)
const calendarRef = ref(null)
const tableData = ref([])
const myTasks = ref([])
const logDetail = ref(null)
const dateRange = ref([])
const calendarData = ref({})
const dayLogs = ref([])
const selectedDay = ref('')
const viewMode = ref('calendar')
const currentDate = ref(new Date())

const searchForm = reactive({
  status: ''
})

const pagination = reactive({
  page: 1,
  page_size: 10,
  total: 0
})

const formData = reactive({
  id: null,
  task_id: null,
  work_date: '',
  hours: 1,
  log_content: ''
})

const formRules = {
  task_id: [
    { required: true, message: '请选择任务', trigger: 'change' }
  ],
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

const dialogTitle = computed(() => isEdit.value ? '编辑工时' : '填报工时')

const currentMonthLabel = computed(() => {
  const d = currentDate.value
  return `${d.getFullYear()}年${d.getMonth() + 1}月`
})

const dayStats = computed(() => {
  const list = dayLogs.value
  return {
    total_hours: list.reduce((sum, item) => sum + parseFloat(item.hours || 0), 0).toFixed(1)
  }
})

const stats = computed(() => {
  const list = tableData.value
  const totalHours = list.reduce((sum, item) => sum + parseFloat(item.hours), 0)
  return {
    total_hours: totalHours.toFixed(1),
    total_count: list.length,
    approved_count: list.filter(l => l.status === 'approved').length,
    pending_count: list.filter(l => l.status === 'submitted').length,
    rejected_count: list.filter(l => l.status === 'rejected').length
  }
})

const statusLabel = (s) => workLogStatusMap[s]?.label || s
const statusType = (s) => workLogStatusMap[s]?.type || 'info'

const loadMyTasks = async () => {
  try {
    myTasks.value = await getMyTasksApi()
  } catch (err) {
    console.error('加载我的任务失败:', err)
  }
}

const loadCalendarData = async () => {
  try {
    const d = currentDate.value
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const data = await getWorkLogCalendarApi({ month })
    calendarData.value = data
  } catch (err) {
    console.error('加载日历数据失败:', err)
  }
}

const loadListData = async () => {
  loading.value = true
  try {
    const params = {
      ...searchForm,
      page: pagination.page,
      page_size: pagination.page_size
    }
    
    if (dateRange.value && dateRange.value.length === 2) {
      params.date_from = dateRange.value[0]
      params.date_to = dateRange.value[1]
    }
    
    const res = await getWorkLogListApi(params)
    tableData.value = res.list
    pagination.total = res.total
  } catch (err) {
    console.error('加载工时记录失败:', err)
  } finally {
    loading.value = false
  }
}

const loadDayLogs = async (day) => {
  dayLoading.value = true
  try {
    const res = await getWorkLogListApi({
      date_from: day,
      date_to: day,
      page_size: 100
    })
    dayLogs.value = res.list || []
  } catch (err) {
    console.error('加载当日工时失败:', err)
  } finally {
    dayLoading.value = false
  }
}

const handleDayClick = (day) => {
  selectedDay.value = day
  loadDayLogs(day)
  dayDialogVisible.value = true
}

const handleReset = () => {
  searchForm.status = ''
  dateRange.value = []
  pagination.page = 1
  loadListData()
}

const handleSizeChange = (size) => {
  pagination.page_size = size
  pagination.page = 1
  loadListData()
}

const handlePageChange = (page) => {
  pagination.page = page
  loadListData()
}

const handleAdd = (day) => {
  isEdit.value = false
  const workDate = day || new Date().toISOString().split('T')[0]
  Object.assign(formData, {
    id: null,
    task_id: myTasks.value[0]?.id || null,
    work_date: workDate,
    hours: 1,
    log_content: ''
  })
  dialogVisible.value = true
}

const handleEdit = (row) => {
  isEdit.value = true
  Object.assign(formData, {
    id: row.id,
    task_id: row.task_id,
    work_date: row.work_date,
    hours: parseFloat(row.hours),
    log_content: row.log_content
  })
  dialogVisible.value = true
}

const handleView = async (row) => {
  try {
    logDetail.value = await getWorkLogDetailApi(row.id)
    detailDialogVisible.value = true
  } catch (err) {
    console.error('获取详情失败:', err)
  }
}

const handleSubmit = async () => {
  if (!formRef.value) return
  
  await formRef.value.validate(async (valid) => {
    if (valid) {
      submitting.value = true
      try {
        if (isEdit.value) {
          await updateWorkLogApi(formData.id, formData)
          ElMessage.success('更新成功')
        } else {
          await createWorkLogApi(formData)
          ElMessage.success('提交成功')
        }
        dialogVisible.value = false
        if (dayDialogVisible.value && selectedDay.value) {
          loadDayLogs(selectedDay.value)
        }
        loadCalendarData()
        loadListData()
      } catch (err) {
        console.error('提交失败:', err)
      } finally {
        submitting.value = false
      }
    }
  })
}

const handleDelete = (row) => {
  ElMessageBox.confirm('确定要删除这条工时记录吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    try {
      await deleteWorkLogApi(row.id)
      ElMessage.success('删除成功')
      if (dayDialogVisible.value && selectedDay.value) {
        loadDayLogs(selectedDay.value)
      }
      loadCalendarData()
      loadListData()
    } catch (err) {
      console.error('删除失败:', err)
    }
  }).catch(() => {})
}

watch(currentDate, () => {
  if (viewMode.value === 'calendar') {
    loadCalendarData()
  }
})

watch(viewMode, (val) => {
  if (val === 'calendar') {
    loadCalendarData()
  } else {
    loadListData()
  }
})

onMounted(() => {
  loadMyTasks()
  loadCalendarData()
})
</script>

<style scoped lang="scss">
.my-worklogs {
  .header-actions {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  
  .view-switcher {
    margin-right: 10px;
  }
  
  .calendar-wrapper {
    .calendar-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      
      h3 {
        margin: 0;
        font-size: 18px;
        color: #303133;
      }
      
      .calendar-legend {
        display: flex;
        gap: 16px;
        font-size: 12px;
        color: #606266;
        
        .legend-item {
          display: flex;
          align-items: center;
          gap: 5px;
          
          &::before {
            content: '';
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
          }
          
          &.approved-dot::before { background: #67C23A; }
          &.submitted-dot::before { background: #E6A23C; }
          &.rejected-dot::before { background: #F56C6C; }
          &.empty-dot::before { background: #dcdfe6; }
        }
      }
    }
    
    :deep(.el-calendar) {
      --el-calendar-cell-width: auto;
    }
    
    :deep(.el-calendar__body) {
      padding: 0;
    }
    
    .calendar-cell {
      padding: 8px;
      height: 80px;
      cursor: pointer;
      border-radius: 4px;
      transition: background 0.2s;
      position: relative;
      
      &:hover {
        background: #f5f7fa;
      }
      
      &.is-today {
        background: #ecf5ff;
        
        .cell-date {
          color: #409EFF;
          font-weight: 600;
        }
      }
      
      &.other-month {
        opacity: 0.3;
      }
      
      &.has-log {
        .cell-hours {
          color: #67C23A;
        }
      }
      
      &.has-rejected {
        .cell-hours {
          color: #F56C6C;
        }
      }
      
      .cell-date {
        font-size: 13px;
        color: #606266;
        margin-bottom: 4px;
      }
      
      .cell-hours {
        font-size: 18px;
        font-weight: 600;
        line-height: 1.2;
      }
      
      .cell-status {
        position: absolute;
        bottom: 6px;
        right: 6px;
        display: flex;
        gap: 3px;
        
        .status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          
          &.approved { background: #67C23A; }
          &.submitted { background: #E6A23C; }
          &.rejected { background: #F56C6C; }
        }
      }
    }
  }
  
  .day-logs {
    .day-summary {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid #ebeef5;
    }
  }
  
  .stat-card {
    background: #fff;
    border-radius: 8px;
    padding: 20px;
    display: flex;
    align-items: center;
    gap: 20px;
    box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.06);
    
    .stat-icon {
      width: 48px;
      height: 48px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 20px;
    }
    
    .stat-value {
      font-size: 24px;
      font-weight: 600;
      color: #303133;
      margin-bottom: 4px;
    }
    
    .stat-label {
      font-size: 13px;
      color: #909399;
    }
    
    &.total .stat-icon {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    
    &.approved .stat-icon {
      background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
    }
    
    &.pending .stat-icon {
      background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
    }
    
    &.rejected .stat-icon {
      background: linear-gradient(135deg, #f5576c 0%, #f093fb 100%);
    }
  }
  
  .pagination {
    margin-top: 20px;
    display: flex;
    justify-content: flex-end;
  }
  
  .hours-text {
    font-weight: 600;
    color: #67C23A;
  }
  
  .form-tip {
    font-size: 12px;
    color: #909399;
    margin-top: 5px;
  }
  
  .log-detail {
    .detail-section {
      margin-top: 20px;
      
      h4 {
        font-size: 14px;
        color: #303133;
        margin-bottom: 10px;
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
    }
  }
}
</style>
