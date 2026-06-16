import request from '@/utils/request'

export const getWorkLogListApi = (params) => {
  return request({
    url: '/worklogs',
    method: 'get',
    params
  })
}

export const getMyWorkLogsApi = (params) => {
  return request({
    url: '/worklogs/my-logs',
    method: 'get',
    params
  })
}

export const getWorkLogDetailApi = (id) => {
  return request({
    url: `/worklogs/${id}`,
    method: 'get'
  })
}

export const createWorkLogApi = (data) => {
  return request({
    url: '/worklogs',
    method: 'post',
    data
  })
}

export const updateWorkLogApi = (id, data) => {
  return request({
    url: `/worklogs/${id}`,
    method: 'put',
    data
  })
}

export const deleteWorkLogApi = (id) => {
  return request({
    url: `/worklogs/${id}`,
    method: 'delete'
  })
}

export const approveWorkLogApi = (id) => {
  return request({
    url: `/worklogs/${id}/approve`,
    method: 'post'
  })
}

export const rejectWorkLogApi = (id, rejectReason) => {
  return request({
    url: `/worklogs/${id}/reject`,
    method: 'post',
    data: { reject_reason: rejectReason }
  })
}

export const getWorkLogCalendarApi = (params) => {
  return request({
    url: '/worklogs/calendar',
    method: 'get',
    params
  })
}
