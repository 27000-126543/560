import request from '@/utils/request'

export const getTaskListApi = (params) => {
  return request({
    url: '/tasks',
    method: 'get',
    params
  })
}

export const getMyTasksApi = (params) => {
  return request({
    url: '/tasks/my-tasks',
    method: 'get',
    params
  })
}

export const getTaskDetailApi = (id) => {
  return request({
    url: `/tasks/${id}`,
    method: 'get'
  })
}

export const createTaskApi = (data) => {
  return request({
    url: '/tasks',
    method: 'post',
    data
  })
}

export const updateTaskApi = (id, data) => {
  return request({
    url: `/tasks/${id}`,
    method: 'put',
    data
  })
}

export const deleteTaskApi = (id) => {
  return request({
    url: `/tasks/${id}`,
    method: 'delete'
  })
}

export const updateTaskStatusApi = (id, status) => {
  return request({
    url: `/tasks/${id}/status`,
    method: 'put',
    data: { status }
  })
}

export const rejectTaskApi = (id, rejectReason) => {
  return request({
    url: `/tasks/${id}/reject`,
    method: 'post',
    data: { reject_reason: rejectReason }
  })
}
