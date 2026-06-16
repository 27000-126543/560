<template>
  <div class="report-center page-container">
    <div class="page-header">
      <h2 class="page-title">报表中心</h2>
    </div>
    
    <el-row :gutter="20">
      <el-col :span="24">
        <div class="card-wrapper mb-20">
          <div class="card-header">
            <h3 class="section-title">成员工时统计</h3>
            <div class="header-actions">
              <el-date-picker
                v-model="dateRange"
                type="daterange"
                value-format="YYYY-MM-DD"
                range-separator="至"
                start-placeholder="开始日期"
                end-placeholder="结束日期"
                style="width: 240px;"
                @change="loadUserHours"
              />
              <el-button type="primary" :icon="Download" @click="exportUserHours">
                导出Excel
              </el-button>
            </div>
          </div>
          
          <div ref="hoursChartRef" style="height: 320px; margin-bottom: 20px;"></div>
          
          <el-table :data="userHoursData" stripe>
            <el-table-column type="index" label="排名" width="70" align="center" />
            <el-table-column prop="real_name" label="姓名" width="100" />
            <el-table-column prop="department" label="部门" width="120" />
            <el-table-column prop="total_hours" label="总工时" width="100">
              <template #default="{ row }">
                <span class="hours-highlight">{{ row.total_hours }}h</span>
              </template>
            </el-table-column>
            <el-table-column prop="task_count" label="任务数" width="100" />
            <el-table-column prop="log_count" label="工时记录数" width="120" />
            <el-table-column label="工时排行" min-width="200">
              <template #default="{ row }">
                <div class="rank-progress">
                  <el-progress
                    :percentage="getPercentage(row.total_hours)"
                    :stroke-width="10"
                    color="#67C23A"
                  />
                </div>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-col>
    </el-row>
    
    <el-row :gutter="20">
      <el-col :span="12">
        <div class="card-wrapper">
          <h3 class="section-title">任务状态分布</h3>
          <div ref="taskPieChartRef" style="height: 280px;"></div>
        </div>
      </el-col>
      <el-col :span="12">
        <div class="card-wrapper">
          <h3 class="section-title">项目工时分布</h3>
          <div ref="projectPieChartRef" style="height: 280px;"></div>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Download } from '@element-plus/icons-vue'
import { getUserWorkHoursApi, getProjectProgressApi } from '@/api/report'
import { exportUserHoursApi } from '@/api/report'
import dayjs from 'dayjs'
import * as echarts from 'echarts'

const hoursChartRef = ref(null)
const taskPieChartRef = ref(null)
const projectPieChartRef = ref(null)

let hoursChart = null
let taskPieChart = null
let projectPieChart = null

const userHoursData = ref([])
const projectProgressData = ref([])
const dateRange = ref([])

const maxHours = computed(() => {
  if (userHoursData.value.length === 0) return 1
  return Math.max(...userHoursData.value.map(u => parseFloat(u.total_hours))) || 1
})

const getPercentage = (hours) => {
  return Math.round((parseFloat(hours) / maxHours.value) * 100)
}

const loadUserHours = async () => {
  try {
    const params = {}
    if (dateRange.value && dateRange.value.length === 2) {
      params.start_date = dateRange.value[0]
      params.end_date = dateRange.value[1]
    }
    userHoursData.value = await getUserWorkHoursApi(params)
    nextTick(() => {
      renderHoursChart()
    })
  } catch (err) {
    console.error('加载成员工时失败:', err)
  }
}

const loadProjectProgress = async () => {
  try {
    projectProgressData.value = await getProjectProgressApi()
    nextTick(() => {
      renderProjectPieChart()
    })
  } catch (err) {
    console.error('加载项目进度失败:', err)
  }
}

const renderHoursChart = () => {
  if (!hoursChartRef.value) return
  
  if (hoursChart) hoursChart.dispose()
  hoursChart = echarts.init(hoursChartRef.value)
  
  const names = userHoursData.value.map(u => u.real_name)
  const hours = userHoursData.value.map(u => parseFloat(u.total_hours))
  
  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: '{b}: {c}h'
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
      axisLabel: {
        formatter: '{value}h'
      }
    },
    series: [
      {
        name: '工时',
        type: 'bar',
        data: hours,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#667eea' },
            { offset: 1, color: '#764ba2' }
          ]),
          borderRadius: [4, 4, 0, 0]
        },
        label: {
          show: true,
          position: 'top',
          formatter: '{c}h'
        },
        barWidth: '50%'
      }
    ]
  }
  
  hoursChart.setOption(option)
}

const renderTaskPieChart = () => {
  if (!taskPieChartRef.value) return
  
  if (taskPieChart) taskPieChart.dispose()
  taskPieChart = echarts.init(taskPieChartRef.value)
  
  const data = [
    { value: 12, name: '待开始' },
    { value: 8, name: '进行中' },
    { value: 15, name: '已完成' },
    { value: 2, name: '已驳回' }
  ]
  
  const option = {
    tooltip: {
      trigger: 'item'
    },
    legend: {
      orient: 'vertical',
      left: 'left'
    },
    series: [
      {
        name: '任务状态',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 6,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: false,
          position: 'center'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 20,
            fontWeight: 'bold'
          }
        },
        labelLine: {
          show: false
        },
        data: data,
        color: ['#909399', '#409EFF', '#67C23A', '#F56C6C']
      }
    ]
  }
  
  taskPieChart.setOption(option)
}

const renderProjectPieChart = () => {
  if (!projectPieChartRef.value) return
  
  if (projectPieChart) projectPieChart.dispose()
  projectPieChart = echarts.init(projectPieChartRef.value)
  
  const data = projectProgressData.value.map(p => ({
    value: parseFloat(p.actual_hours) || 0,
    name: p.name
  }))
  
  const option = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c}h ({d}%)'
    },
    legend: {
      orient: 'vertical',
      left: 'left'
    },
    series: [
      {
        name: '项目工时',
        type: 'pie',
        radius: '70%',
        data: data,
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }
    ]
  }
  
  projectPieChart.setOption(option)
}

const exportUserHours = async () => {
  const params = {}
  if (dateRange.value && dateRange.value.length === 2) {
    params.start_date = dateRange.value[0]
    params.end_date = dateRange.value[1]
  }
  try {
    await exportUserHoursApi(params)
    ElMessage.success('导出成功')
  } catch (err) {
    console.error('导出失败:', err)
  }
}

onMounted(() => {
  const endDate = dayjs().format('YYYY-MM-DD')
  const startDate = dayjs().subtract(30, 'day').format('YYYY-MM-DD')
  dateRange.value = [startDate, endDate]
  
  loadUserHours()
  loadProjectProgress()
  nextTick(() => {
    renderTaskPieChart()
  })
  
  window.addEventListener('resize', () => {
    hoursChart?.resize()
    taskPieChart?.resize()
    projectPieChart?.resize()
  })
})
</script>

<style scoped lang="scss">
.report-center {
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
  
  .header-actions {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  
  .hours-highlight {
    font-weight: 600;
    color: #67C23A;
  }
  
  .rank-progress {
    width: 100%;
  }
}
</style>
