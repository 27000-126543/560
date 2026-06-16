import request from '@/utils/request'

export const getNotificationListApi = (params) => {
  return request({
    url: '/notifications',
    method: 'get',
    params
  })
}

export const getUnreadCountApi = () => {
  return request({
    url: '/notifications/unread-count',
    method: 'get'
  })
}

export const markNotificationReadApi = (id) => {
  return request({
    url: `/notifications/${id}/read`,
    method: 'put'
  })
}

export const markAllReadApi = () => {
  return request({
    url: '/notifications/read-all',
    method: 'put'
  })
}
