<template>
  <div class="project-list page-container">
    <div class="page-header">
      <h2 class="page-title">项目管理</h2>
      <el-button type="primary" :icon="Plus" @click="handleAdd">
        新建项目
      </el-button>
    </div>
    
    <div class="card-wrapper mb-20">
      <el-form :inline="true" :model="searchForm">
        <el-form-item label="项目名称">
          <el-input
            v-model="searchForm.keyword"
            placeholder="请输入项目名称"
            clearable
            style="width: 200px;"
            @keyup.enter="loadData"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="全部" clearable style="width: 120px;">
            <el-option label="进行中" value="active" />
            <el-option label="已完成" value="completed" />
            <el-option label="已暂停" value="paused" />
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
        <el-table-column prop="name" label="项目名称" min-width="180">
          <template #default="{ row }">
            <span class="link-text" @click="viewDetail(row)">{{ row.name }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="项目描述" min-width="200" show-overflow-tooltip />
        <el-table-column prop="manager_name" label="项目主管" width="100" />
        <el-table-column prop="department" label="部门" width="100" />
        <el-table-column label="任务进度" width="200">
          <template #default="{ row }">
            <div class="task-progress">
              <span>{{ row.task_stats?.completed_tasks || 0 }}/{{ row.task_stats?.total_tasks || 0 }}</span>
              <el-progress
                :percentage="row.task_stats?.total_tasks ? Math.round((row.task_stats.completed_tasks / row.task_stats.total_tasks) * 100) : 0"
                :stroke-width="6"
              />
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small">
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="start_date" label="开始日期" width="120" />
        <el-table-column prop="end_date" label="结束日期" width="120" />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="viewDetail(row)">
              详情
            </el-button>
            <el-button type="warning" link size="small" @click="handleEdit(row)">
              编辑
            </el-button>
            <el-button
              v-if="userStore.hasRole('admin')"
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
      v-model="dialogVisible"
      :title="dialogTitle"
      width="600px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="100px"
      >
        <el-form-item label="项目名称" prop="name">
          <el-input v-model="formData.name" />
        </el-form-item>
        <el-form-item label="项目描述" prop="description">
          <el-input v-model="formData.description" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="项目主管" prop="manager_id">
          <el-select v-model="formData.manager_id" style="width: 100%;">
            <el-option
              v-for="m in managerList"
              :key="m.id"
              :label="m.real_name"
              :value="m.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="项目成员" prop="members">
          <el-select
            v-model="formData.members"
            multiple
            placeholder="请选择项目成员"
            style="width: 100%;"
          >
            <el-option
              v-for="m in memberList"
              :key="m.id"
              :label="m.real_name"
              :value="m.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-select v-model="formData.status" style="width: 100%;">
            <el-option label="进行中" value="active" />
            <el-option label="已完成" value="completed" />
            <el-option label="已暂停" value="paused" />
          </el-select>
        </el-form-item>
        <el-form-item label="开始日期" prop="start_date">
          <el-date-picker
            v-model="formData.start_date"
            type="date"
            value-format="YYYY-MM-DD"
            style="width: 100%;"
          />
        </el-form-item>
        <el-form-item label="结束日期" prop="end_date">
          <el-date-picker
            v-model="formData.end_date"
            type="date"
            value-format="YYYY-MM-DD"
            style="width: 100%;"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">
          确定
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, Refresh } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import {
  getProjectListApi,
  getProjectDetailApi,
  createProjectApi,
  updateProjectApi,
  deleteProjectApi
} from '@/api/project'
import { getManagersApi, getMembersApi } from '@/api/user'
import { projectStatusMap } from '@/utils'

const router = useRouter()
const userStore = useUserStore()

const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const formRef = ref(null)
const tableData = ref([])
const managerList = ref([])
const memberList = ref([])

const searchForm = reactive({
  keyword: '',
  status: ''
})

const pagination = reactive({
  page: 1,
  page_size: 10,
  total: 0
})

const formData = reactive({
  id: null,
  name: '',
  description: '',
  manager_id: null,
  members: [],
  status: 'active',
  start_date: '',
  end_date: ''
})

const formRules = {
  name: [
    { required: true, message: '请输入项目名称', trigger: 'blur' }
  ],
  manager_id: [
    { required: true, message: '请选择项目主管', trigger: 'change' }
  ]
}

const dialogTitle = computed(() => isEdit.value ? '编辑项目' : '新建项目')

const statusLabel = (status) => projectStatusMap[status]?.label || status
const statusType = (status) => projectStatusMap[status]?.type || 'info'

const loadManagers = async () => {
  try {
    managerList.value = await getManagersApi()
  } catch (err) {
    console.error('加载主管列表失败:', err)
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
    const res = await getProjectListApi({
      ...searchForm,
      page: pagination.page,
      page_size: pagination.page_size
    })
    tableData.value = res.list
    pagination.total = res.total
  } catch (err) {
    console.error('加载项目列表失败:', err)
  } finally {
    loading.value = false
  }
}

const handleReset = () => {
  searchForm.keyword = ''
  searchForm.status = ''
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

const handleAdd = () => {
  isEdit.value = false
  Object.assign(formData, {
    id: null,
    name: '',
    description: '',
    manager_id: null,
    members: [],
    status: 'active',
    start_date: '',
    end_date: ''
  })
  dialogVisible.value = true
}

const handleEdit = async (row) => {
  isEdit.value = true
  try {
    const detail = await getProjectDetailApi(row.id)
    Object.assign(formData, {
      id: detail.id,
      name: detail.name,
      description: detail.description || '',
      manager_id: detail.manager_id,
      members: (detail.members || []).map(m => m.id),
      status: detail.status,
      start_date: detail.start_date,
      end_date: detail.end_date
    })
  } catch (err) {
    console.error('加载项目详情失败:', err)
    Object.assign(formData, {
      id: row.id,
      name: row.name,
      description: row.description || '',
      manager_id: row.manager_id,
      members: [],
      status: row.status,
      start_date: row.start_date,
      end_date: row.end_date
    })
  }
  dialogVisible.value = true
}

const viewDetail = (row) => {
  router.push(`/projects/${row.id}`)
}

const handleSubmit = async () => {
  if (!formRef.value) return
  
  await formRef.value.validate(async (valid) => {
    if (valid) {
      submitting.value = true
      try {
        if (isEdit.value) {
          await updateProjectApi(formData.id, formData)
          ElMessage.success('项目更新成功')
        } else {
          await createProjectApi(formData)
          ElMessage.success('项目创建成功')
        }
        dialogVisible.value = false
        loadData()
      } catch (err) {
        console.error('提交失败:', err)
      } finally {
        submitting.value = false
      }
    }
  })
}

const handleDelete = (row) => {
  ElMessageBox.confirm(`确定要删除项目"${row.name}"吗？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    try {
      await deleteProjectApi(row.id)
      ElMessage.success('删除成功')
      loadData()
    } catch (err) {
      console.error('删除失败:', err)
    }
  }).catch(() => {})
}

onMounted(() => {
  loadManagers()
  loadMembers()
  loadData()
})
</script>

<style scoped lang="scss">
.project-list {
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
  
  .task-progress {
    display: flex;
    align-items: center;
    gap: 10px;
    
    span {
      font-size: 12px;
      color: #606266;
      white-space: nowrap;
    }
    
    .el-progress {
      flex: 1;
    }
  }
}
</style>
