import request from '@/utils/request'

export const getProjectListApi = (params) => {
  return request({
    url: '/projects',
    method: 'get',
    params
  })
}

export const getAllProjectsApi = () => {
  return request({
    url: '/projects/all',
    method: 'get'
  })
}

export const getProjectDetailApi = (id) => {
  return request({
    url: `/projects/${id}`,
    method: 'get'
  })
}

export const createProjectApi = (data) => {
  return request({
    url: '/projects',
    method: 'post',
    data
  })
}

export const updateProjectApi = (id, data) => {
  return request({
    url: `/projects/${id}`,
    method: 'put',
    data
  })
}

export const deleteProjectApi = (id) => {
  return request({
    url: `/projects/${id}`,
    method: 'delete'
  })
}

export const getProjectTasksApi = (id, params) => {
  return request({
    url: `/projects/${id}/tasks`,
    method: 'get',
    params
  })
}
