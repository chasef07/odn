export function smsStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case 'queued':
    case 'sending':
    case 'accepted':
      return 'Queued'
    case 'sent':
      return 'Sent'
    case 'delivered':
      return 'Delivered'
    case 'delivery_failed':
    case 'sending_failed':
    case 'failed':
    case 'undelivered':
    case 'rejected':
      return 'Failed'
    case 'delivery_unconfirmed':
      return 'Unconfirmed'
    default:
      return status ? formatStatusLabel(status) : 'Queued'
  }
}

function formatStatusLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}
