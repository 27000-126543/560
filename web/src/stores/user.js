import { defineStore } from 'pinia'
import { loginApi, logoutApi, getUserProfileApi } from '@/api/auth'

export const useUserStore = defineStore('user', {
  state: () => ({
    token: localStorage.getItem('token') || '',
    userInfo: JSON.parse(localStorage.getItem('userInfo') || 'null'),
    roles: []
  }),

  getters: {
    isLoggedIn: (state) => !!state.token,
    userRole: (state) => state.userInfo?.role || '',
    userId: (state) => state.userInfo?.id || null,
    userName: (state) => state.userInfo?.real_name || ''
  },

  actions: {
    async login(loginForm) {
      const res = await loginApi(loginForm)
      this.token = res.token
      this.userInfo = res.user
      
      localStorage.setItem('token', res.token)
      localStorage.setItem('userInfo', JSON.stringify(res.user))
      
      return res
    },

    async logout() {
      try {
        await logoutApi()
      } catch (err) {
        console.error('登出API调用失败:', err)
      }
      this.token = ''
      this.userInfo = null
      localStorage.removeItem('token')
      localStorage.removeItem('userInfo')
    },

    async getUserProfile() {
      const res = await getUserProfileApi()
      this.userInfo = res
      localStorage.setItem('userInfo', JSON.stringify(res))
      return res
    },

    updateUserInfo(userInfo) {
      this.userInfo = userInfo
      localStorage.setItem('userInfo', JSON.stringify(userInfo))
    },

    hasRole(role) {
      if (Array.isArray(role)) {
        return role.includes(this.userRole)
      }
      return this.userRole === role
    }
  }
})
