package service

import (
	"encoding/json"
	"log"
	"sse-demo/types"
	"sync"
	"time"

	"github.com/google/uuid"
)

// NotificationService manages all client connections and message broadcasting.
type NotificationService struct {
	mu                  sync.Mutex
	clients             map[string]chan string // Map of username -> SSE channel
	acknowledgmentReqs   map[string]*types.AcknowledgmentRequest // Map of request ID -> request
	acknowledgmentAckd   map[string][]string // Map of request ID -> list of users who acknowledged
}

func NewNotificationService() *NotificationService {
	return &NotificationService{
		clients:            make(map[string]chan string),
		acknowledgmentReqs:  make(map[string]*types.AcknowledgmentRequest),
		acknowledgmentAckd:  make(map[string][]string),
	}
}

// AddClient registers a new client for SSE and broadcasts user_connected event.
func (s *NotificationService) AddClient(username string) chan string {
	s.mu.Lock()
	defer s.mu.Unlock()

	// If client already exists, close their old channel
	if ch, ok := s.clients[username]; ok {
		close(ch)
	}

	ch := make(chan string, 10)
	s.clients[username] = ch
	log.Printf("Client added: %s. Total clients: %d", username, len(s.clients))

	// Broadcast user_connected event to all other users
	s.broadcastEventLocked(types.EventTypeUserConnected, types.UserConnectedPayload{
		Username: username,
	}, []string{}) // Empty list means broadcast to all

	return ch
}

// RemoveClient removes a client and closes their SSE channel, broadcasts user_disconnected event.
func (s *NotificationService) RemoveClient(username string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if ch, ok := s.clients[username]; ok {
		close(ch)
		delete(s.clients, username)
		log.Printf("Client removed: %s. Total clients: %d", username, len(s.clients))

		// Broadcast user_disconnected event to all remaining users
		s.broadcastEventLocked(types.EventTypeUserDisconnected, types.UserDisconnectedPayload{
			Username: username,
		}, []string{}) // Empty list means broadcast to all
	}
}

// GetConnectedUsers returns a list of currently connected usernames
func (s *NotificationService) GetConnectedUsers() []string {
	s.mu.Lock()
	defer s.mu.Unlock()

	users := make([]string, 0, len(s.clients))
	for username := range s.clients {
		users = append(users, username)
	}
	return users
}

// BroadcastMessage sends a message to the target user(s) using the typed event system.
func (s *NotificationService) BroadcastMessage(req types.NotifyRequest) {
	s.mu.Lock()
	defer s.mu.Unlock()

	notification := types.Notification{
		Id:        uuid.New().String(),
		From:      req.FromUsername,
		Message:   req.Message,
		Timestamp: time.Now(),
	}

	if req.TargetUsername == "all" {
		s.broadcastEventLocked(types.EventTypeNotification, notification, []string{})
	} else {
		s.broadcastEventLocked(types.EventTypeNotification, notification, []string{req.TargetUsername})
	}
}

// CreateAcknowledgmentRequest creates an acknowledgment request and broadcasts it
func (s *NotificationService) CreateAcknowledgmentRequest(fromUsername string, toUsernames []string, message string) string {
	s.mu.Lock()
	defer s.mu.Unlock()

	requestID := uuid.New().String()
	req := &types.AcknowledgmentRequest{
		ID:           requestID,
		FromUsername: fromUsername,
		ToUsernames:  toUsernames,
		Message:      message,
		CreatedAt:    time.Now(),
	}

	s.acknowledgmentReqs[requestID] = req
	s.acknowledgmentAckd[requestID] = []string{}

	payload := types.AcknowledgmentRequestPayload{
		ID:           req.ID,
		FromUsername: req.FromUsername,
		ToUsernames:  req.ToUsernames,
		Message:      req.Message,
	}

	s.broadcastEventLocked(types.EventTypeAcknowledgmentRequest, payload, toUsernames)

	return requestID
}

// RecordAcknowledgment records that a user acknowledged a request
func (s *NotificationService) RecordAcknowledgment(requestID string, fromUsername string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if req, ok := s.acknowledgmentReqs[requestID]; ok {
		// Add to acknowledged list
		s.acknowledgmentAckd[requestID] = append(s.acknowledgmentAckd[requestID], fromUsername)

		payload := types.AcknowledgmentResponsePayload{
			RequestID:    requestID,
			FromUsername: fromUsername,
		}

		// Send response to the requester only
		s.broadcastEventLocked(types.EventTypeAcknowledgmentResponse, payload, []string{req.FromUsername})
	}
}

// broadcastEventLocked broadcasts a typed SSE event to specified users (must be called with mu locked)
func (s *NotificationService) broadcastEventLocked(eventType types.EventType, payload interface{}, targetUsers []string) {
	event := types.SSEEvent{
		Type:      eventType,
		Payload:   payload,
		Timestamp: time.Now(),
	}

	eventPayload, err := json.Marshal(event)
	if err != nil {
		log.Printf("Error marshaling event: %v", err)
		return
	}

	eventStr := string(eventPayload)

	// Determine who receives the event
	recipients := make(map[string]bool)
	if len(targetUsers) == 0 {
		// Broadcast to all connected clients
		for username := range s.clients {
			recipients[username] = true
		}
	} else {
		// Send to specific users
		for _, username := range targetUsers {
			if _, ok := s.clients[username]; ok {
				recipients[username] = true
			}
		}
	}

	// Send to all recipients
	for username, ch := range s.clients {
		if recipients[username] {
			select {
			case ch <- eventStr:
			default:
				log.Printf("Channel full for user %s, skipping event", username)
			}
		}
	}
}
