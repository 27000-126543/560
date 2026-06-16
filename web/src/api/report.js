import request from '@/utils/request'

export const getDashboardApi = () => {
  return request({
    url: '/reports/dashboard',
    method: 'get'
  })
}

export const getUserWorkHoursApi = (params) => {
  return request({
    url: '/reports/user-work-hours',
    method: 'get',
    params
  })
}

export const getProjectProgressApi = () => {
  return request({
    url: '/reports/project-progress',
    method: 'get'
  })
}

export const getTaskTrendApi = (params) => {
  return request({
    url: '/reports/task-trend',
    method: 'get',
    params
  })
}

export const exportWorkLogsApi = (params) => {
  window.open(`/api/reports/export/work-logs?${new URLSearchParams(params).toString()}`, '_blank')
}

export const exportUserHoursApi = (params) => {
  window.open(`/api/reports/export/user-hours?${new URLSearchParams(params).toString()}`, '_blank')
}
