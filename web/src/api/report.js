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

const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(new Blob([blob]))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

export const exportWorkLogsApi = (params) => {
  return request({
    url: '/reports/export/work-logs',
    method: 'get',
    params,
    responseType: 'blob'
  }).then(res => {
    downloadBlob(res, 'work_logs.xlsx')
  })
}

export const exportUserHoursApi = (params) => {
  return request({
    url: '/reports/export/user-hours',
    method: 'get',
    params,
    responseType: 'blob'
  }).then(res => {
    downloadBlob(res, 'user_hours_report.xlsx')
  })
}
