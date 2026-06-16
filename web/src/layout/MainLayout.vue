<template>
  <div class="main-layout">
    <el-container class="layout-container">
      <el-aside :width="isCollapsed ? '64px' : '220px'" class="sidebar">
        <div class="logo">
          <span v-if="!isCollapsed" class="logo-text">项目管理系统</span>
          <span v-else class="logo-icon">PM</span>
        </div>
        
        <el-menu
          :default-active="activeMenu"
          :collapse="isCollapsed"
          :collapse-transition="false"
          router
          background-color="#304156"
          text-color="#bfcbd9"
          active-text-color="#409EFF"
          class="sidebar-menu"
        >
          <template v-for="item in menuList" :key="item.path">
            <el-menu-item v-if="!item.hidden" :index="item.path">
              <el-icon><component :is="item.icon" /></el-icon>
              <template #title>{{ item.title }}</template>
            </el-menu-item>
          </template>
        </el-menu>
      </el-aside>
      
      <el-container class="main-container">
        <el-header class="header">
          <div class="header-left">
            <el-icon class="collapse-btn" @click="toggleSidebar">
              <Fold v-if="!isCollapsed" />
              <Expand v-else />
            </el-icon>
            
            <el-breadcrumb separator="/">
              <el-breadcrumb-item :to="{ path: '/dashboard' }">首页</el-breadcrumb-item>
              <el-breadcrumb-item v-if="currentRoute">{{ currentRoute }}</el-breadcrumb-item>
            </el-breadcrumb>
          </div>
          
          <div class="header-right">
            <el-dropdown trigger="click" @command="handleNotificationCommand">
              <div class="notification-bell" @click="loadNotifications">
                <el-badge :value="unreadCount" :hidden="unreadCount === 0" class="notification-badge">
                  <el-icon class="bell-icon"><Bell /></el-icon>
                </el-badge>
              </div>
              <template #dropdown>
                <el-dropdown-menu class="notification-dropdown">
                  <div class="dropdown-header">
                    <span>通知</span>
                    <el-link type="primary" :underline="false" @click="goToNotifications">
                      全部通知
                    </el-link>
                  </div>
                  <el-dropdown-item v-for="item in notificationList" :key="item.id" :command="'view_' + item.id">
                    <div class="notification-item" :class="{ unread: !item.is_read }">
                      <div class="notification-title">{{ item.title }}</div>
                      <div class="notification-content">{{ item.content }}</div>
                      <div class="notification-time">{{ formatTime(item.created_at) }}</div>
                    </div>
                  </el-dropdown-item>
                  <el-dropdown-item v-if="notificationList.length === 0" disabled>
                    <div class="empty-notification">暂无通知</div>
                  </el-dropdown-item>
                  <div class="dropdown-footer" v-if="unreadCount > 0">
                    <el-link type="primary" :underline="false" @click="handleMarkAllRead">
                      全部标为已读
                    </el-link>
                  </div>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            
            <el-dropdown @command="handleCommand">
              <div class="user-info">
                <el-avatar :size="32" class="user-avatar">
                  {{ userStore.userName?.charAt(0) || 'U' }}
                </el-avatar>
                <span class="user-name">{{ userStore.userName }}</span>
                <el-tag :type="roleTagType" size="small" class="role-tag">
                  {{ roleLabel }}
                </el-tag>
                <el-icon class="el-icon--right"><ArrowDown /></el-icon>
              </div>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="profile">
                    <el-icon><User /></el-icon>
                    个人中心
                  </el-dropdown-item>
                  <el-dropdown-item command="password">
                    <el-icon><Key /></el-icon>
                    修改密码
                  </el-dropdown-item>
                  <el-dropdown-item divided command="logout">
                    <el-icon><SwitchButton /></el-icon>
                    退出登录
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </el-header>
        
        <el-main class="main-content">
          <router-view v-slot="{ Component }">
            <transition name="fade" mode="out-in">
              <component :is="Component" />
            </transition>
          </router-view>
        </el-main>
      </el-container>
    </el-container>
    
    <el-dialog
      v-model="passwordDialogVisible"
      title="修改密码"
      width="400px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="passwordFormRef"
        :model="passwordForm"
        :rules="passwordRules"
        label-width="80px"
      >
        <el-form-item label="原密码" prop="old_password">
          <el-input v-model="passwordForm.old_password" type="password" show-password />
        </el-form-item>
        <el-form-item label="新密码" prop="new_password">
          <el-input v-model="passwordForm.new_password" type="password" show-password />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirm_password">
          <el-input v-model="passwordForm.confirm_password" type="password" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="passwordDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="passwordLoading" @click="handleUpdatePassword">
          确认
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Fold, Expand, User, Key, SwitchButton, ArrowDown, Bell,
  Odometer, UserFilled, Folder, List, Checked, Clock,
  EditPen, DataLine, Grid
} from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import { useAppStore } from '@/stores/app'
import { updatePasswordApi } from '@/api/auth'
import { getNotificationListApi, getUnreadCountApi, markAllReadApi, markNotificationReadApi } from '@/api/notification'
import { roleMap } from '@/utils'
import dayjs from 'dayjs'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const appStore = useAppStore()

const isCollapsed = computed(() => appStore.sidebarCollapsed)

const unreadCount = ref(0)
const notificationList = ref([])

const loadUnreadCount = async () => {
  try {
    const res = await getUnreadCountApi()
    unreadCount.value = res.unread_count
  } catch (err) {
    console.error('获取未读通知数失败:', err)
  }
}

const loadNotifications = async () => {
  try {
    const res = await getNotificationListApi({ page_size: 5, is_read: 0 })
    notificationList.value = res.list || []
  } catch (err) {
    console.error('获取通知列表失败:', err)
  }
}

const goToNotifications = () => {
  router.push('/notifications')
}

const handleNotificationCommand = async (command) => {
  if (command.startsWith('view_')) {
    const id = parseInt(command.replace('view_', ''))
    try {
      await markNotificationReadApi(id)
      loadUnreadCount()
    } catch (err) {
      console.error('标记已读失败:', err)
    }
  }
}

const handleMarkAllRead = async () => {
  try {
    await markAllReadApi()
    unreadCount.value = 0
    ElMessage.success('已全部标记为已读')
  } catch (err) {
    console.error('全部已读失败:', err)
  }
}

const formatTime = (date) => {
  return dayjs(date).format('MM-DD HH:mm')
}

onMounted(() => {
  if (userStore.token) {
    loadUnreadCount()
  }
})

const activeMenu = computed(() => route.path)
const currentRoute = computed(() => route.meta.title || '')

const menuList = computed(() => {
  const allMenus = [
    { path: '/dashboard', title: '工作台', icon: 'Odometer' },
    { path: '/users', title: '用户管理', icon: 'UserFilled', roles: ['admin'] },
    { path: '/projects', title: '项目管理', icon: 'Folder', roles: ['admin', 'manager'] },
    { path: '/tasks', title: '任务管理', icon: 'List', roles: ['admin', 'manager'] },
    { path: '/my-tasks', title: '我的任务', icon: 'Checked', roles: ['member', 'manager'] },
    { path: '/worklogs', title: '工时审核', icon: 'Clock', roles: ['admin', 'manager'] },
    { path: '/my-worklogs', title: '我的工时', icon: 'EditPen', roles: ['member', 'manager'] },
    { path: '/kanban', title: '进度看板', icon: 'Grid', roles: ['admin', 'manager'] },
    { path: '/reports', title: '报表中心', icon: 'DataLine', roles: ['admin', 'manager'] }
  ]
  
  return allMenus.filter(menu => {
    if (!menu.roles) return true
    return menu.roles.some(role => userStore.hasRole(role))
  })
})

const roleLabel = computed(() => {
  const role = userStore.userRole
  return roleMap[role]?.label || role
})

const roleTagType = computed(() => {
  const role = userStore.userRole
  return roleMap[role]?.type || 'info'
})

const toggleSidebar = () => {
  appStore.toggleSidebar()
}

const handleCommand = (command) => {
  switch (command) {
    case 'profile':
      router.push('/profile')
      break
    case 'password':
      showPasswordDialog()
      break
    case 'logout':
      handleLogout()
      break
  }
}

const passwordDialogVisible = ref(false)
const passwordFormRef = ref(null)
const passwordLoading = ref(false)
const passwordForm = ref({
  old_password: '',
  new_password: '',
  confirm_password: ''
})

const validateConfirmPassword = (rule, value, callback) => {
  if (value !== passwordForm.value.new_password) {
    callback(new Error('两次输入的密码不一致'))
  } else {
    callback()
  }
}

const passwordRules = {
  old_password: [
    { required: true, message: '请输入原密码', trigger: 'blur' }
  ],
  new_password: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于6位', trigger: 'blur' }
  ],
  confirm_password: [
    { required: true, message: '请确认新密码', trigger: 'blur' },
    { validator: validateConfirmPassword, trigger: 'blur' }
  ]
}

const showPasswordDialog = () => {
  passwordForm.value = {
    old_password: '',
    new_password: '',
    confirm_password: ''
  }
  passwordDialogVisible.value = true
}

const handleUpdatePassword = async () => {
  if (!passwordFormRef.value) return
  
  await passwordFormRef.value.validate(async (valid) => {
    if (valid) {
      passwordLoading.value = true
      try {
        await updatePasswordApi(passwordForm.value)
        ElMessage.success('密码修改成功')
        passwordDialogVisible.value = false
      } catch (err) {
        console.error('修改密码失败:', err)
      } finally {
        passwordLoading.value = false
      }
    }
  })
}

const handleLogout = () => {
  ElMessageBox.confirm('确定要退出登录吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    await userStore.logout()
    router.push('/login')
    ElMessage.success('已退出登录')
  }).catch(() => {})
}
</script>

<style scoped lang="scss">
.main-layout {
  width: 100%;
  height: 100%;
}

.layout-container {
  height: 100%;
}

.sidebar {
  background-color: #304156;
  transition: width 0.3s;
  overflow: hidden;
}

.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #2b3648;
  color: #fff;
  font-size: 18px;
  font-weight: 600;
  
  .logo-text {
    white-space: nowrap;
  }
  
  .logo-icon {
    font-size: 20px;
  }
}

.sidebar-menu {
  border-right: none;
}

.main-container {
  display: flex;
  flex-direction: column;
}

.header {
  height: 60px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

.collapse-btn {
  font-size: 20px;
  cursor: pointer;
  color: #606266;
  
  &:hover {
    color: #409EFF;
  }
}

.header-right {
  display: flex;
  align-items: center;
  gap: 15px;
}

.notification-bell {
  cursor: pointer;
  padding: 0 10px;
  
  .bell-icon {
    font-size: 20px;
    color: #606266;
    
    &:hover {
      color: #409EFF;
    }
  }
}

.notification-dropdown {
  width: 320px;
  padding: 0;
  
  .dropdown-header {
    padding: 12px 16px;
    border-bottom: 1px solid #ebeef5;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 600;
    color: #303133;
  }
  
  .dropdown-footer {
    padding: 10px 16px;
    border-top: 1px solid #ebeef5;
    text-align: center;
  }
  
  .notification-item {
    padding: 10px 0;
    border-bottom: 1px solid #f2f6fc;
    
    &:last-child {
      border-bottom: none;
    }
    
    &.unread {
      background: #ecf5ff;
    }
    
    .notification-title {
      font-size: 14px;
      color: #303133;
      font-weight: 500;
      margin-bottom: 4px;
    }
    
    .notification-content {
      font-size: 12px;
      color: #606266;
      margin-bottom: 4px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .notification-time {
      font-size: 12px;
      color: #909399;
    }
  }
  
  .empty-notification {
    text-align: center;
    color: #909399;
    padding: 20px 0;
    font-size: 14px;
  }
}

.user-info {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  padding: 0 10px;
  
  .user-avatar {
    background-color: #409EFF;
    color: #fff;
  }
  
  .user-name {
    color: #303133;
    font-size: 14px;
  }
  
  .role-tag {
    margin-left: 5px;
  }
}

.main-content {
  background-color: #f5f7fa;
  padding: 0;
  overflow-y: auto;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
