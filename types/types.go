package types

import "time"

// EventType represents the type of SSE event
type EventType string

const (
	EventTypeNotification           EventType = "notification"
	EventTypeUserConnected         EventType = "user_connected"
	EventTypeUserDisconnected      EventType = "user_disconnected"
	EventTypeAcknowledgmentRequest EventType = "acknowledgment_request"
	EventTypeAcknowledgmentResponse EventType = "acknowledgment_response"
)

// SSEEvent represents a Server-Sent Event with type information
type SSEEvent struct {
	Type      EventType   `json:"type"`
	Payload   interface{} `json:"payload"`
	Timestamp time.Time   `json:"timestamp"`
}

// NotifyRequest represents a request to send a notification
type NotifyRequest struct {
	FromUsername   string `json:"from_username"`
	Message        string `json:"message"`
	TargetUsername string `json:"target_username"` // A specific username or 'all'
}

// Notification represents a notification message
type Notification struct {
	Id        string    `json:"id"`
	From      string    `json:"from"`
	Message   string    `json:"message"`
	Timestamp time.Time `json:"timestamp"`
}

// UserConnectedPayload represents a user_connected SSE event
type UserConnectedPayload struct {
	Username string `json:"username"`
}

// UserDisconnectedPayload represents a user_disconnected SSE event
type UserDisconnectedPayload struct {
	Username string `json:"username"`
}

// AcknowledgmentRequest represents an acknowledgment request
type AcknowledgmentRequest struct {
	ID           string    `json:"id"`
	FromUsername string    `json:"from_username"`
	ToUsernames  []string  `json:"to_usernames"`
	Message      string    `json:"message"`
	CreatedAt    time.Time `json:"created_at"`
}

// AcknowledgmentRequestPayload represents the SSE payload for acknowledgment request
type AcknowledgmentRequestPayload struct {
	ID           string   `json:"id"`
	FromUsername string   `json:"from_username"`
	ToUsernames  []string `json:"to_usernames"`
	Message      string   `json:"message"`
}

// AcknowledgmentResponse represents an acknowledgment response
type AcknowledgmentResponse struct {
	RequestID    string `json:"request_id"`
	FromUsername string `json:"from_username"`
}

// AcknowledgmentResponsePayload represents the SSE payload for acknowledgment response
type AcknowledgmentResponsePayload struct {
	RequestID    string `json:"request_id"`
	FromUsername string `json:"from_username"`
}
