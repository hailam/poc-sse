import { useState } from 'react'
import { postAcknowledgeResponse } from '../api'
import Modal from './Modal'

interface AcknowledgmentRequestModalProps {
  isOpen: boolean
  requestId: string | null
  fromUsername: string | null
  message: string | null
  onClose: () => void
  onAcknowledge: () => void
}

export default function AcknowledgmentRequestModal({
  isOpen,
  requestId,
  fromUsername,
  message,
  onClose,
  onAcknowledge,
}: AcknowledgmentRequestModalProps) {
  const [loading, setLoading] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)

  const handleAcknowledge = async () => {
    if (!requestId) return

    setLoading(true)
    try {
      await postAcknowledgeResponse({
        request_id: requestId,
      })
      setAcknowledged(true)
      onAcknowledge()
      setTimeout(onClose, 500)
    } catch (err) {
      console.error('Failed to acknowledge:', err)
      alert('Failed to acknowledge')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !fromUsername || !message) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Acknowledgment Request from ${fromUsername}`}
    >
      <div className="space-y-4">
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded">
          <p className="text-sm font-medium text-yellow-800 mb-2">Request Message:</p>
          <p className="text-gray-700">{message}</p>
        </div>

        {acknowledged && (
          <div className="bg-green-50 border border-green-200 p-4 rounded text-center">
            <p className="text-green-800 font-medium">Acknowledged!</p>
          </div>
        )}
      </div>

      <div slot="footer" className="flex gap-2">
        <button
          onClick={onClose}
          className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Close
        </button>
        {!acknowledged && (
          <button
            onClick={handleAcknowledge}
            disabled={loading}
            className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Acknowledging...' : 'Acknowledge'}
          </button>
        )}
      </div>
    </Modal>
  )
}
