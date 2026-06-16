import request from '@/utils/request'

export const loginApi = (data) => {
  return request({
    url: '/auth/login',
    method: 'post',
    data
  })
}

export const logoutApi = () => {
  return request({
    url: '/auth/logout',
    method: 'post'
  })
}

export const getUserProfileApi = () => {
  return request({
    url: '/auth/profile',
    method: 'get'
  })
}

export const updateProfileApi = (data) => {
  return request({
    url: '/auth/profile',
    method: 'put',
    data
  })
}

export const updatePasswordApi = (data) => {
  return request({
    url: '/auth/password',
    method: 'put',
    data
  })
}
