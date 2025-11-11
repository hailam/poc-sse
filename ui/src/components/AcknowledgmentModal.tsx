import { useState } from 'react'
import { useAppStore } from '../store'
import { postAcknowledgeRequest } from '../api'
import Modal from './Modal'
import UserDropdown from './UserDropdown'

interface AcknowledgmentModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function AcknowledgmentModal({ isOpen, onClose }: AcknowledgmentModalProps) {
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeRequest, setActiveRequest] = useState<string | null>(null)
  const acknowledgmentRequests = useAppStore((state) => state.acknowledgmentRequests)
  const addAcknowledgmentRequest = useAppStore((state) => state.addAcknowledgmentRequest)
  const username = useAppStore((state) => state.username)

  const handleAddUser = (user: string) => {
    if (user && !selectedUsers.includes(user)) {
      setSelectedUsers([...selectedUsers, user])
    }
  }

  const handleRemoveUser = (user: string) => {
    setSelectedUsers(selectedUsers.filter((u) => u !== user))
  }

  const handleSend = async () => {
    if (!selectedUsers.length || !message.trim()) {
      alert('Please select at least one user and enter a message')
      return
    }

    setLoading(true)
    try {
      const response = await postAcknowledgeRequest({
        to_usernames: selectedUsers,
        message: message,
      })

      if (response.request_id) {
        addAcknowledgmentRequest({
          id: response.request_id,
          fromUsername: username || 'Unknown',
          toUsernames: selectedUsers,
          message: message,
          acknowledgedBy: [],
        })
        setActiveRequest(response.request_id)
        setMessage('')
      }
    } catch (err) {
      console.error('Failed to send acknowledgment request:', err)
      alert('Failed to send acknowledgment request')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const activeAckRequest = activeRequest
    ? acknowledgmentRequests.find((req) => req.id === activeRequest)
    : null

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        onClose()
        setSelectedUsers([])
        setMessage('')
        setActiveRequest(null)
      }}
      title="Request Acknowledgment"
    >
      {!activeAckRequest ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Users
            </label>
            <UserDropdown
              value=""
              onChange={handleAddUser}
              includeAll={false}
            />
          </div>

          {selectedUsers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedUsers.map((user) => (
                <span
                  key={user}
                  className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm flex items-center gap-2"
                >
                  {user}
                  <button
                    onClick={() => handleRemoveUser(user)}
                    className="font-bold hover:text-blue-600"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="form-textarea"
              placeholder="Enter your request message..."
              rows={3}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-blue-50 p-4 rounded">
            <p className="text-sm text-gray-600 mb-3">
              Waiting for acknowledgement from:
            </p>
            <div className="space-y-2">
              {activeAckRequest.toUsernames.map((user) => {
                const acknowledged = activeAckRequest.acknowledgedBy.includes(user)
                return (
                  <div key={user} className="flex items-center gap-3">
                    <span className={`text-sm font-medium ${acknowledged ? 'text-green-600' : 'text-gray-500'}`}>
                      {acknowledged ? '[Done]' : '[Waiting]'}
                    </span>
                    <span className={acknowledged ? 'text-green-600 line-through' : ''}>
                      {user}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <div slot="footer" className="flex gap-2">
        <button
          onClick={() => {
            onClose()
            setSelectedUsers([])
            setMessage('')
            setActiveRequest(null)
          }}
          className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Close
        </button>
        {!activeAckRequest && (
          <button
            onClick={handleSend}
            disabled={loading || !selectedUsers.length || !message.trim()}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Sending...' : 'Send Request'}
          </button>
        )}
      </div>
    </Modal>
  )
}
