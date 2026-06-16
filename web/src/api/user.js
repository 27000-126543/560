import request from '@/utils/request'

export const getUserListApi = (params) => {
  return request({
    url: '/users',
    method: 'get',
    params
  })
}

export const getRolesApi = () => {
  return request({
    url: '/users/roles',
    method: 'get'
  })
}

export const getManagersApi = () => {
  return request({
    url: '/users/managers',
    method: 'get'
  })
}

export const getMembersApi = () => {
  return request({
    url: '/users/members',
    method: 'get'
  })
}

export const getUserDetailApi = (id) => {
  return request({
    url: `/users/${id}`,
    method: 'get'
  })
}

export const createUserApi = (data) => {
  return request({
    url: '/users',
    method: 'post',
    data
  })
}

export const updateUserApi = (id, data) => {
  return request({
    url: `/users/${id}`,
    method: 'put',
    data
  })
}

export const deleteUserApi = (id) => {
  return request({
    url: `/users/${id}`,
    method: 'delete'
  })
}

export const updateUserStatusApi = (id, status) => {
  return request({
    url: `/users/${id}/status`,
    method: 'put',
    data: { status }
  })
}
