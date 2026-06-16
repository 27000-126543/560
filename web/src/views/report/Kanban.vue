<template>
  <div class="kanban-page page-container">
    <div class="page-header">
      <h2 class="page-title">进度看板</h2>
      <div class="header-actions">
        <el-select v-model="selectedProject" placeholder="选择项目" clearable style="width: 200px;" @change="loadData">
          <el-option
            v-for="p in projectList"
            :key="p.id"
            :label="p.name"
            :value="p.id"
          />
        </el-select>
      </div>
    </div>
    
    <el-row :gutter="20" class="mb-20">
      <el-col :span="6">
        <div class="stat-card total">
          <div class="stat-icon"><el-icon><FolderOpened /></el-icon></div>
          <div class="stat-info">
            <div class="stat-value">{{ projectStats.total }}</div>
            <div class="stat-label">项目总数</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card active">
          <div class="stat-icon"><el-icon><Loading /></el-icon></div>
          <div class="stat-info">
            <div class="stat-value">{{ projectStats.active }}</div>
            <div class="stat-label">进行中</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card completed">
          <div class="stat-icon"><el-icon><CircleCheck /></el-icon></div>
          <div class="stat-info">
            <div class="stat-value">{{ projectStats.completed }}</div>
            <div class="stat-label">已完成</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card avg-progress">
          <div class="stat-icon"><el-icon><TrendCharts /></el-icon></div>
          <div class="stat-info">
            <div class="stat-value">{{ avgProgress }}%</div>
            <div class="stat-label">平均进度</div>
          </div>
        </div>
      </el-col>
    </el-row>
    
    <div class="card-wrapper">
      <h3 class="section-title">项目进度详情</h3>
      
      <div ref="chartRef" style="height: 350px; margin-bottom: 30px;"></div>
      
      <el-table :data="projectProgress" stripe>
        <el-table-column prop="name" label="项目名称" min-width="200">
          <template #default="{ row }">
            <span class="link-text" @click="goToProject(row)">{{ row.name }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="manager_name" label="项目主管" width="100" />
        <el-table-column label="任务" width="120">
          <template #default="{ row }">
            {{ row.completed_tasks }} / {{ row.total_tasks }}
          </template>
        </el-table-column>
        <el-table-column label="进度" min-width="200">
          <template #default="{ row }">
            <div class="progress-wrapper">
              <el-progress :percentage="row.progress" :stroke-width="10" />
              <span class="progress-text">{{ row.progress }}%</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="工时(h)" width="150">
          <template #default="{ row }">
            <span class="hours-text">
              {{ row.actual_hours || 0 }} / {{ row.estimated_hours || 0 }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small">
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import {
  FolderOpened, Loading, CircleCheck, TrendCharts
} from '@element-plus/icons-vue'
import { getAllProjectsApi } from '@/api/project'
import { getProjectProgressApi } from '@/api/report'
import { projectStatusMap } from '@/utils'
import * as echarts from 'echarts'

const router = useRouter()

const chartRef = ref(null)
let chartInstance = null

const projectList = ref([])
const projectProgress = ref([])
const selectedProject = ref('')

const projectStats = computed(() => {
  const list = projectProgress.value
  return {
    total: list.length,
    active: list.filter(p => p.status === 'active').length,
    completed: list.filter(p => p.status === 'completed').length,
    paused: list.filter(p => p.status === 'paused').length
  }
})

const avgProgress = computed(() => {
  const list = projectProgress.value
  if (list.length === 0) return 0
  const total = list.reduce((sum, p) => sum + p.progress, 0)
  return Math.round(total / list.length)
})

const statusLabel = (status) => projectStatusMap[status]?.label || status
const statusType = (status) => projectStatusMap[status]?.type || 'info'

const loadProjects = async () => {
  try {
    projectList.value = await getAllProjectsApi()
  } catch (err) {
    console.error('加载项目列表失败:', err)
  }
}

const loadData = async () => {
  try {
    let data = await getProjectProgressApi()
    
    if (selectedProject.value) {
      data = data.filter(p => p.id === selectedProject.value)
    }
    
    projectProgress.value = data
    nextTick(() => {
      renderChart()
    })
  } catch (err) {
    console.error('加载项目进度失败:', err)
  }
}

const renderChart = () => {
  if (!chartRef.value) return
  
  if (chartInstance) {
    chartInstance.dispose()
  }
  
  chartInstance = echarts.init(chartRef.value)
  
  const data = projectProgress.value
  const names = data.map(p => p.name)
  const progresses = data.map(p => p.progress)
  
  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: '{b}: {c}%'
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: names,
      axisLabel: {
        interval: 0,
        rotate: 30
      }
    },
    yAxis: {
      type: 'value',
      max: 100,
      axisLabel: {
        formatter: '{value}%'
      }
    },
    series: [
      {
        name: '项目进度',
        type: 'bar',
        data: progresses,
        itemStyle: {
          color: function(params) {
            const colors = ['#409EFF', '#67C23A', '#E6A23C', '#F56C6C', '#909399', '#9C27B0']
            return colors[params.dataIndex % colors.length]
          },
          borderRadius: [4, 4, 0, 0]
        },
        label: {
          show: true,
          position: 'top',
          formatter: '{c}%'
        },
        barWidth: '50%'
      }
    ]
  }
  
  chartInstance.setOption(option)
}

const goToProject = (row) => {
  router.push(`/projects/${row.id}`)
}

onMounted(() => {
  loadProjects()
  loadData()
  
  window.addEventListener('resize', () => {
    chartInstance?.resize()
  })
})
</script>

<style scoped lang="scss">
.kanban-page {
  .header-actions {
    display: flex;
    gap: 10px;
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
      width: 56px;
      height: 56px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 24px;
    }
    
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
    
    &.total .stat-icon {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    
    &.active .stat-icon {
      background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    }
    
    &.completed .stat-icon {
      background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
    }
    
    &.avg-progress .stat-icon {
      background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
    }
  }
  
  .section-title {
    font-size: 16px;
    font-weight: 600;
    color: #303133;
    margin-bottom: 20px;
  }
  
  .link-text {
    color: #409EFF;
    cursor: pointer;
    
    &:hover {
      text-decoration: underline;
    }
  }
  
  .progress-wrapper {
    display: flex;
    align-items: center;
    gap: 10px;
    
    .el-progress {
      flex: 1;
    }
    
    .progress-text {
      font-size: 12px;
      color: #606266;
      min-width: 45px;
      text-align: right;
    }
  }
  
  .hours-text {
    font-size: 13px;
    color: #606266;
  }
}
</style>
