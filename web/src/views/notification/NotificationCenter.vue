<template>
  <div class="notification-center page-container">
    <div class="page-header">
      <h2 class="page-title">通知中心</h2>
      <el-button type="primary" size="small" @click="handleMarkAllRead" :disabled="unreadCount === 0">
        全部标为已读
      </el-button>
    </div>
    
    <div class="card-wrapper">
      <div class="filter-tabs">
        <el-radio-group v-model="activeTab" @change="handleTabChange">
          <el-radio-button label="">全部</el-radio-button>
          <el-radio-button label="unread">未读</el-radio-button>
          <el-radio-button label="read">已读</el-radio-button>
        </el-radio-group>
      </div>
      
      <div class="notification-list" v-loading="loading">
        <div
          v-for="item in list"
          :key="item.id"
          class="notification-card"
          :class="{ unread: !item.is_read }"
          @click="handleView(item)"
        >
          <div class="notification-icon" :class="typeClass(item.type)">
            <el-icon :size="20">
              <component :is="typeIcon(item.type)" />
            </el-icon>
          </div>
          <div class="notification-info">
            <div class="notification-header">
              <span class="notification-title">{{ item.title }}</span>
              <span class="notification-time">{{ formatDateTime(item.created_at) }}</span>
            </div>
            <div class="notification-content">{{ item.content }}</div>
            <div class="notification-footer">
              <el-tag v-if="!item.is_read" type="danger" size="small">未读</el-tag>
              <span v-else class="read-text">已读</span>
            </div>
          </div>
        </div>
        
        <div v-if="list.length === 0 && !loading" class="empty-state">
          <el-empty description="暂无通知" />
        </div>
      </div>
      
      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.page_size"
          :total="pagination.total"
          layout="total, prev, pager, next, jumper"
          @current-change="handlePageChange"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Bell, Message, List, Clock, Check, Close, Warning, User
} from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import {
  getNotificationListApi,
  markNotificationReadApi,
  markAllReadApi
} from '@/api/notification'
import dayjs from 'dayjs'

const router = useRouter()

const loading = ref(false)
const list = ref([])
const activeTab = ref('')
const unreadCount = ref(0)

const pagination = reactive({
  page: 1,
  page_size: 10,
  total: 0
})

const typeIcon = (type) => {
  const map = {
    task_assign: List,
    task_reject: Close,
    worklog_submit: Clock,
    worklog_approve: Check,
    worklog_reject: Close,
    mention: Message,
    system: Bell
  }
  return map[type] || Bell
}

const typeClass = (type) => {
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

const formatDateTime = (date) => {
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
}

const loadData = async () => {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      page_size: pagination.page_size
    }
    if (activeTab.value === 'unread') {
      params.is_read = 0
    } else if (activeTab.value === 'read') {
      params.is_read = 1
    }
    
    const res = await getNotificationListApi(params)
    list.value = res.list || []
    pagination.total = res.total || 0
    
    const unreadRes = await getNotificationListApi({ page_size: 1, is_read: 0 })
    unreadCount.value = unreadRes.total || 0
  } catch (err) {
    console.error('获取通知列表失败:', err)
  } finally {
    loading.value = false
  }
}

const handleTabChange = () => {
  pagination.page = 1
  loadData()
}

const handlePageChange = (page) => {
  pagination.page = page
  loadData()
}

const handleView = async (item) => {
  if (!item.is_read) {
    try {
      await markNotificationReadApi(item.id)
      item.is_read = 1
      unreadCount.value = Math.max(0, unreadCount.value - 1)
    } catch (err) {
      console.error('标记已读失败:', err)
    }
  }
}

const handleMarkAllRead = async () => {
  try {
    await markAllReadApi()
    ElMessage.success('已全部标记为已读')
    list.value.forEach(item => {
      item.is_read = 1
    })
    unreadCount.value = 0
  } catch (err) {
    console.error('全部已读失败:', err)
  }
}

onMounted(() => {
  loadData()
})
</script>

<style scoped lang="scss">
.notification-center {
  .filter-tabs {
    margin-bottom: 20px;
  }
  
  .notification-list {
    min-height: 400px;
  }
  
  .notification-card {
    display: flex;
    gap: 15px;
    padding: 16px;
    border-bottom: 1px solid #ebeef5;
    cursor: pointer;
    transition: background-color 0.2s;
    
    &:hover {
      background-color: #f5f7fa;
    }
    
    &.unread {
      background-color: #ecf5ff;
      
      &:hover {
        background-color: #d9ecff;
      }
    }
    
    &:last-child {
      border-bottom: none;
    }
    
    .notification-icon {
      width: 40px;
      height: 40px;
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
    
    .notification-info {
      flex: 1;
      min-width: 0;
      
      .notification-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
        
        .notification-title {
          font-size: 15px;
          font-weight: 600;
          color: #303133;
        }
        
        .notification-time {
          font-size: 12px;
          color: #909399;
          flex-shrink: 0;
          margin-left: 10px;
        }
      }
      
      .notification-content {
        font-size: 14px;
        color: #606266;
        line-height: 1.5;
        margin-bottom: 8px;
      }
      
      .notification-footer {
        .read-text {
          font-size: 12px;
          color: #909399;
        }
      }
    }
  }
  
  .empty-state {
    padding: 60px 0;
  }
  
  .pagination-wrapper {
    margin-top: 20px;
    display: flex;
    justify-content: center;
  }
}
</style>
