import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { title: '登录', requiresAuth: false }
  },
  {
    path: '/',
    component: () => import('@/layout/MainLayout.vue'),
    redirect: '/dashboard',
    meta: { requiresAuth: true },
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: { title: '工作台', icon: 'Odometer' }
      },
      {
        path: 'profile',
        name: 'Profile',
        component: () => import('@/views/Profile.vue'),
        meta: { title: '个人中心', icon: 'User', hidden: true }
      },
      {
        path: 'notifications',
        name: 'Notifications',
        component: () => import('@/views/notification/NotificationCenter.vue'),
        meta: { title: '通知中心', icon: 'Bell', hidden: true }
      },
      {
        path: 'users',
        name: 'Users',
        component: () => import('@/views/admin/Users.vue'),
        meta: { title: '用户管理', icon: 'UserFilled', roles: ['admin'] }
      },
      {
        path: 'projects',
        name: 'Projects',
        component: () => import('@/views/project/ProjectList.vue'),
        meta: { title: '项目管理', icon: 'Folder', roles: ['admin', 'manager'] }
      },
      {
        path: 'projects/:id',
        name: 'ProjectDetail',
        component: () => import('@/views/project/ProjectDetail.vue'),
        meta: { title: '项目详情', icon: 'Folder', hidden: true, roles: ['admin', 'manager'] }
      },
      {
        path: 'tasks',
        name: 'Tasks',
        component: () => import('@/views/task/TaskList.vue'),
        meta: { title: '任务管理', icon: 'List', roles: ['admin', 'manager'] }
      },
      {
        path: 'my-tasks',
        name: 'MyTasks',
        component: () => import('@/views/task/MyTasks.vue'),
        meta: { title: '我的任务', icon: 'Checked', roles: ['member', 'manager'] }
      },
      {
        path: 'worklogs',
        name: 'WorkLogs',
        component: () => import('@/views/worklog/WorkLogList.vue'),
        meta: { title: '工时审核', icon: 'Clock', roles: ['admin', 'manager'] }
      },
      {
        path: 'my-worklogs',
        name: 'MyWorkLogs',
        component: () => import('@/views/worklog/MyWorkLogs.vue'),
        meta: { title: '我的工时', icon: 'EditPen', roles: ['member', 'manager'] }
      },
      {
        path: 'reports',
        name: 'Reports',
        component: () => import('@/views/report/ReportCenter.vue'),
        meta: { title: '报表中心', icon: 'DataLine', roles: ['admin', 'manager'] }
      },
      {
        path: 'kanban',
        name: 'Kanban',
        component: () => import('@/views/report/Kanban.vue'),
        meta: { title: '进度看板', icon: 'Grid', roles: ['admin', 'manager'] }
      }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFound.vue'),
    meta: { title: '页面不存在' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const userStore = useUserStore()
  
  document.title = to.meta.title ? `${to.meta.title} - 项目任务管理系统` : '项目任务管理系统'
  
  if (to.meta.requiresAuth === false) {
    next()
    return
  }
  
  if (!userStore.isLoggedIn) {
    next({ path: '/login', query: { redirect: to.fullPath } })
    return
  }
  
  if (to.meta.roles && to.meta.roles.length > 0) {
    const hasRole = to.meta.roles.some(role => userStore.hasRole(role))
    if (!hasRole) {
      next('/dashboard')
      return
    }
  }
  
  next()
})

export default router
