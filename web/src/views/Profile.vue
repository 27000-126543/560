<template>
  <div class="profile page-container">
    <div class="page-header">
      <h2 class="page-title">个人中心</h2>
    </div>
    
    <el-row :gutter="20">
      <el-col :span="8">
        <div class="card-wrapper profile-card">
          <div class="avatar-section">
            <el-avatar :size="100" class="profile-avatar">
              {{ userInfo?.real_name?.charAt(0) || 'U' }}
            </el-avatar>
            <h3 class="profile-name">{{ userInfo?.real_name }}</h3>
            <el-tag :type="roleType" size="large">{{ roleLabel }}</el-tag>
          </div>
          
          <div class="info-list">
            <div class="info-item">
              <span class="label">用户名</span>
              <span class="value">{{ userInfo?.username }}</span>
            </div>
            <div class="info-item">
              <span class="label">邮箱</span>
              <span class="value">{{ userInfo?.email }}</span>
            </div>
            <div class="info-item">
              <span class="label">手机号</span>
              <span class="value">{{ userInfo?.phone || '-' }}</span>
            </div>
            <div class="info-item">
              <span class="label">部门</span>
              <span class="value">{{ userInfo?.department || '-' }}</span>
            </div>
          </div>
        </div>
      </el-col>
      
      <el-col :span="16">
        <div class="card-wrapper mb-20">
          <h3 class="section-title">基本信息</h3>
          <el-form
            ref="profileFormRef"
            :model="profileForm"
            :rules="profileRules"
            label-width="100px"
            style="max-width: 500px;"
          >
            <el-form-item label="真实姓名" prop="real_name">
              <el-input v-model="profileForm.real_name" />
            </el-form-item>
            <el-form-item label="邮箱" prop="email">
              <el-input v-model="profileForm.email" />
            </el-form-item>
            <el-form-item label="手机号" prop="phone">
              <el-input v-model="profileForm.phone" />
            </el-form-item>
            <el-form-item label="部门">
              <el-input v-model="profileForm.department" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="saving" @click="handleSaveProfile">
                保存修改
              </el-button>
            </el-form-item>
          </el-form>
        </div>
        
        <div class="card-wrapper">
          <h3 class="section-title">修改密码</h3>
          <el-form
            ref="passwordFormRef"
            :model="passwordForm"
            :rules="passwordRules"
            label-width="100px"
            style="max-width: 500px;"
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
            <el-form-item>
              <el-button type="primary" :loading="passwordSaving" @click="handleUpdatePassword">
                修改密码
              </el-button>
            </el-form-item>
          </el-form>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { updateProfileApi, updatePasswordApi } from '@/api/auth'
import { roleMap } from '@/utils'

const userStore = useUserStore()

const userInfo = computed(() => userStore.userInfo)
const roleLabel = computed(() => {
  const role = userStore.userRole
  return roleMap[role]?.label || role
})
const roleType = computed(() => {
  const role = userStore.userRole
  return roleMap[role]?.type || 'info'
})

const profileFormRef = ref(null)
const passwordFormRef = ref(null)
const saving = ref(false)
const passwordSaving = ref(false)

const profileForm = reactive({
  real_name: '',
  email: '',
  phone: '',
  department: '',
  avatar: ''
})

const passwordForm = reactive({
  old_password: '',
  new_password: '',
  confirm_password: ''
})

const profileRules = {
  real_name: [
    { required: true, message: '请输入真实姓名', trigger: 'blur' }
  ],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: 'blur' }
  ]
}

const validateConfirmPassword = (rule, value, callback) => {
  if (value !== passwordForm.new_password) {
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

const loadProfile = () => {
  if (userInfo.value) {
    profileForm.real_name = userInfo.value.real_name || ''
    profileForm.email = userInfo.value.email || ''
    profileForm.phone = userInfo.value.phone || ''
    profileForm.department = userInfo.value.department || ''
    profileForm.avatar = userInfo.value.avatar || ''
  }
}

const handleSaveProfile = async () => {
  if (!profileFormRef.value) return
  
  await profileFormRef.value.validate(async (valid) => {
    if (valid) {
      saving.value = true
      try {
        const res = await updateProfileApi(profileForm)
        userStore.updateUserInfo(res)
        ElMessage.success('个人信息更新成功')
      } catch (err) {
        console.error('更新个人信息失败:', err)
      } finally {
        saving.value = false
      }
    }
  })
}

const handleUpdatePassword = async () => {
  if (!passwordFormRef.value) return
  
  await passwordFormRef.value.validate(async (valid) => {
    if (valid) {
      passwordSaving.value = true
      try {
        await updatePasswordApi(passwordForm)
        ElMessage.success('密码修改成功')
        passwordForm.old_password = ''
        passwordForm.new_password = ''
        passwordForm.confirm_password = ''
      } catch (err) {
        console.error('修改密码失败:', err)
      } finally {
        passwordSaving.value = false
      }
    }
  })
}

onMounted(() => {
  loadProfile()
})
</script>

<style scoped lang="scss">
.profile-card {
  text-align: center;
}

.avatar-section {
  padding: 20px 0;
  border-bottom: 1px solid #ebeef5;
  margin-bottom: 20px;
  
  .profile-avatar {
    width: 100px;
    height: 100px;
    font-size: 40px;
    background-color: #409EFF;
    margin-bottom: 16px;
  }
  
  .profile-name {
    font-size: 20px;
    font-weight: 600;
    color: #303133;
    margin-bottom: 12px;
  }
}

.info-list {
  .info-item {
    display: flex;
    justify-content: space-between;
    padding: 12px 0;
    border-bottom: 1px dashed #ebeef5;
    
    &:last-child {
      border-bottom: none;
    }
    
    .label {
      color: #909399;
      font-size: 14px;
    }
    
    .value {
      color: #303133;
      font-size: 14px;
    }
  }
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 20px;
}
</style>
