<template>
  <div class="worklog-list page-container">
    <div class="page-header">
      <h2 class="page-title">工时审核</h2>
      <div class="header-actions">
        <el-button type="success" :icon="Download" @click="handleExport">
          导出Excel
        </el-button>
      </div>
    </div>
    
    <div class="card-wrapper mb-20">
      <el-form :inline="true" :model="searchForm">
        <el-form-item label="成员">
          <el-select v-model="searchForm.user_id" placeholder="全部" clearable style="width: 130px;">
            <el-option
              v-for="m in memberList"
              :key="m.id"
              :label="m.real_name"
              :value="m.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="项目">
          <el-select v-model="searchForm.project_id" placeholder="全部" clearable style="width: 150px;">
            <el-option
              v-for="p in projectList"
              :key="p.id"
              :label="p.name"
              :value="p.id"
            />
          </el-select>
        </el-form-item>
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
          <el-select v-model="searchForm.status" placeholder="全部" clearable style="width: 110px;">
            <el-option label="待审核" value="submitted" />
            <el-option label="已通过" value="approved" />
            <el-option label="已驳回" value="rejected" />
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
        <el-table-column prop="user_name" label="成员" width="100" />
        <el-table-column prop="project_name" label="项目" width="140" />
        <el-table-column prop="task_name" label="任务" min-width="180" />
        <el-table-column prop="work_date" label="日期" width="110" />
        <el-table-column prop="hours" label="工时" width="80">
          <template #default="{ row }">{{ row.hours }}h</template>
        </el-table-column>
        <el-table-column prop="log_content" label="工作内容" min-width="200" show-overflow-tooltip />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small">
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handleView(row)">
              详情
            </el-button>
            <el-button
              v-if="row.status === 'submitted'"
              type="success"
              link
              size="small"
              @click="handleApprove(row)"
            >
              通过
            </el-button>
            <el-button
              v-if="row.status === 'submitted'"
              type="danger"
              link
              size="small"
              @click="handleReject(row)"
            >
              驳回
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
      v-model="detailDialogVisible"
      title="工时记录详情"
      width="500px"
    >
      <div class="log-detail" v-if="logDetail">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="成员">{{ logDetail.user_name }}</el-descriptions-item>
          <el-descriptions-item label="日期">{{ logDetail.work_date }}</el-descriptions-item>
          <el-descriptions-item label="项目">{{ logDetail.project_name }}</el-descriptions-item>
          <el-descriptions-item label="工时">{{ logDetail.hours }}h</el-descriptions-item>
          <el-descriptions-item label="任务" :span="2">{{ logDetail.task_name }}</el-descriptions-item>
        </el-descriptions>
        
        <div class="detail-section">
          <h4>工作内容</h4>
          <p>{{ logDetail.log_content }}</p>
        </div>
        
        <div class="detail-section" v-if="logDetail.reject_reason">
          <h4>驳回原因</h4>
          <p class="reject-reason">{{ logDetail.reject_reason }}</p>
        </div>
        
        <div class="detail-section">
          <h4>状态</h4>
          <el-tag :type="statusType(logDetail.status)" size="large">
            {{ statusLabel(logDetail.status) }}
          </el-tag>
        </div>
      </div>
      <template #footer v-if="logDetail?.status === 'submitted'">
        <el-button type="success" @click="handleApprove(logDetail)">通过</el-button>
        <el-button type="danger" @click="handleReject(logDetail)">驳回</el-button>
      </template>
    </el-dialog>
    
    <el-dialog
      v-model="rejectDialogVisible"
      title="驳回工时记录"
      width="450px"
      :close-on-click-modal="false"
    >
      <el-form :model="rejectForm" label-width="0">
        <el-form-item
          label=""
          prop="reject_reason"
          :rules="[{ required: true, message: '请输入驳回原因', trigger: 'blur' }]"
        >
          <el-input
            v-model="rejectForm.reject_reason"
            type="textarea"
            :rows="4"
            placeholder="请输入驳回原因"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rejectDialogVisible = false">取消</el-button>
        <el-button type="danger" :loading="rejectLoading" @click="handleConfirmReject">
          确认驳回
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Download } from '@element-plus/icons-vue'
import {
  getWorkLogListApi,
  getWorkLogDetailApi,
  approveWorkLogApi,
  rejectWorkLogApi
} from '@/api/worklog'
import { exportWorkLogsApi } from '@/api/report'
import { getAllProjectsApi } from '@/api/project'
import { getMembersApi } from '@/api/user'
import { workLogStatusMap } from '@/utils'

const loading = ref(false)
const rejectLoading = ref(false)
const detailDialogVisible = ref(false)
const rejectDialogVisible = ref(false)
const tableData = ref([])
const projectList = ref([])
const memberList = ref([])
const logDetail = ref(null)
const currentLogId = ref(null)
const dateRange = ref([])

const searchForm = reactive({
  user_id: '',
  project_id: '',
  status: ''
})

const pagination = reactive({
  page: 1,
  page_size: 10,
  total: 0
})

const rejectForm = reactive({
  reject_reason: ''
})

const statusLabel = (s) => workLogStatusMap[s]?.label || s
const statusType = (s) => workLogStatusMap[s]?.type || 'info'

const loadProjects = async () => {
  try {
    projectList.value = await getAllProjectsApi()
  } catch (err) {
    console.error('加载项目列表失败:', err)
  }
}

const loadMembers = async () => {
  try {
    memberList.value = await getMembersApi()
  } catch (err) {
    console.error('加载成员列表失败:', err)
  }
}

const loadData = async () => {
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

const handleReset = () => {
  searchForm.user_id = ''
  searchForm.project_id = ''
  searchForm.status = ''
  dateRange.value = []
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
    logDetail.value = await getWorkLogDetailApi(row.id)
    detailDialogVisible.value = true
  } catch (err) {
    console.error('获取详情失败:', err)
  }
}

const handleApprove = (row) => {
  ElMessageBox.confirm('确定要通过这条工时记录吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'success'
  }).then(async () => {
    try {
      await approveWorkLogApi(row.id)
      ElMessage.success('审核通过')
      detailDialogVisible.value = false
      loadData()
    } catch (err) {
      console.error('审核失败:', err)
    }
  }).catch(() => {})
}

const handleReject = (row) => {
  currentLogId.value = row.id
  rejectForm.reject_reason = ''
  detailDialogVisible.value = false
  rejectDialogVisible.value = true
}

const handleConfirmReject = async () => {
  if (!rejectForm.reject_reason.trim()) {
    ElMessage.warning('请输入驳回原因')
    return
  }
  
  rejectLoading.value = true
  try {
    await rejectWorkLogApi(currentLogId.value, rejectForm.reject_reason)
    ElMessage.success('已驳回')
    rejectDialogVisible.value = false
    loadData()
  } catch (err) {
    console.error('驳回失败:', err)
  } finally {
    rejectLoading.value = false
  }
}

const handleExport = async () => {
  const params = {}
  
  if (searchForm.user_id) params.user_id = searchForm.user_id
  if (searchForm.project_id) params.project_id = searchForm.project_id
  if (searchForm.status) params.status = searchForm.status
  if (dateRange.value && dateRange.value.length === 2) {
    params.start_date = dateRange.value[0]
    params.end_date = dateRange.value[1]
  }
  
  try {
    await exportWorkLogsApi(params)
    ElMessage.success('导出成功')
  } catch (err) {
    console.error('导出失败:', err)
  }
}

onMounted(() => {
  loadProjects()
  loadMembers()
  loadData()
})
</script>

<style scoped lang="scss">
.worklog-list {
  .pagination {
    margin-top: 20px;
    display: flex;
    justify-content: flex-end;
  }
  
  .header-actions {
    display: flex;
    gap: 10px;
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
