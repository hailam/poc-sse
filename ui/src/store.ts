import { create } from 'zustand'

export interface User {
  username: string
}

export interface Notification {
  id?: string
  from?: string
  message?: string
  timestamp?: string
}

export interface AcknowledgmentRequest {
  id: string
  fromUsername: string
  toUsernames: string[]
  message: string
  acknowledgedBy: string[]
}

interface AppState {
  // User session
  username: string | null
  setUsername: (name: string) => void
  logout: () => void

  // Connected users list
  users: User[]
  setUsers: (users: User[]) => void
  addUser: (username: string) => void
  removeUser: (username: string) => void

  // Notifications
  notifications: Notification[]
  addNotification: (notification: Notification) => void
  clearNotifications: () => void

  // Acknowledgment tracking
  acknowledgmentRequests: AcknowledgmentRequest[]
  addAcknowledgmentRequest: (request: AcknowledgmentRequest) => void
  updateAcknowledgmentResponse: (requestId: string, username: string) => void
  removeAcknowledgmentRequest: (requestId: string) => void

  // UI state
  showAckModal: boolean
  setShowAckModal: (show: boolean) => void
  pendingAckRequest: AcknowledgmentRequest | null
  setPendingAckRequest: (request: AcknowledgmentRequest | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  // User session
  username: null,
  setUsername: (name) => set({ username: name }),
  logout: () => set({ username: null, users: [], notifications: [], acknowledgmentRequests: [] }),

  // Connected users list
  users: [],
  setUsers: (users) => set({ users }),
  addUser: (username) => set((state) => ({
    users: [...state.users, { username }]
  })),
  removeUser: (username) => set((state) => ({
    users: state.users.filter((u) => u.username !== username)
  })),

  // Notifications
  notifications: [],
  addNotification: (notification) => set((state) => ({
    notifications: [notification, ...state.notifications]
  })),
  clearNotifications: () => set({ notifications: [] }),

  // Acknowledgment tracking
  acknowledgmentRequests: [],
  addAcknowledgmentRequest: (request) => set((state) => ({
    acknowledgmentRequests: [...state.acknowledgmentRequests, request]
  })),
  updateAcknowledgmentResponse: (requestId, username) => set((state) => ({
    acknowledgmentRequests: state.acknowledgmentRequests.map((req) =>
      req.id === requestId
        ? { ...req, acknowledgedBy: [...req.acknowledgedBy, username] }
        : req
    )
  })),
  removeAcknowledgmentRequest: (requestId) => set((state) => ({
    acknowledgmentRequests: state.acknowledgmentRequests.filter((req) => req.id !== requestId)
  })),

  // UI state
  showAckModal: false,
  setShowAckModal: (show) => set({ showAckModal: show }),
  pendingAckRequest: null,
  setPendingAckRequest: (request) => set({ pendingAckRequest: request }),
}))

// Deprecated: Keep for backward compatibility
export const useUserStore = create<{ username: string | null; setUsername: (name: string) => void; logout: () => void }>((set) => ({
  username: null,
  setUsername: (name) => set({ username: name }),
  logout: () => set({ username: null }),
}))
