import dayjs from 'dayjs'

export const formatDate = (date, format = 'YYYY-MM-DD') => {
  if (!date) return '-'
  return dayjs(date).format(format)
}

export const formatDateTime = (date, format = 'YYYY-MM-DD HH:mm:ss') => {
  if (!date) return '-'
  return dayjs(date).format(format)
}

export const statusMap = {
  pending: { label: '待开始', type: 'info' },
  in_progress: { label: '进行中', type: 'primary' },
  completed: { label: '已完成', type: 'success' },
  rejected: { label: '已驳回', type: 'danger' }
}

export const priorityMap = {
  low: { label: '低', type: 'info' },
  medium: { label: '中', type: 'warning' },
  high: { label: '高', type: 'danger' },
  urgent: { label: '紧急', type: 'danger' }
}

export const workLogStatusMap = {
  submitted: { label: '已提交', type: 'warning' },
  approved: { label: '已通过', type: 'success' },
  rejected: { label: '已驳回', type: 'danger' }
}

export const projectStatusMap = {
  active: { label: '进行中', type: 'primary' },
  completed: { label: '已完成', type: 'success' },
  paused: { label: '已暂停', type: 'info' }
}

export const roleMap = {
  admin: { label: '管理员', type: 'danger' },
  manager: { label: '主管', type: 'warning' },
  member: { label: '成员', type: 'primary' }
}

export const getStatusLabel = (status, map = statusMap) => {
  return map[status]?.label || status
}

export const getStatusType = (status, map = statusMap) => {
  return map[status]?.type || 'info'
}
