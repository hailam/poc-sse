package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sse-demo/auth"
	"sse-demo/service"
	"sse-demo/types"
	"time"

	"github.com/gin-gonic/gin"
)

// boolPtr returns a pointer to a bool value
func boolPtr(b bool) *bool {
	return &b
}

// StrictApiHandler implements the generated StrictServerInterface
type StrictApiHandler struct {
	Service       *service.NotificationService
	SessionStore  *auth.SessionStore
}

func NewStrictApiHandler(svc *service.NotificationService, sessionStore *auth.SessionStore) *StrictApiHandler {
	return &StrictApiHandler{
		Service:      svc,
		SessionStore: sessionStore,
	}
}

// PostLogin implements StrictServerInterface
func (h *StrictApiHandler) PostLogin(ctx context.Context, request PostLoginRequestObject) (PostLoginResponseObject, error) {
	if request.Body == nil {
		return nil, fmt.Errorf("request body is required")
	}

	username := request.Body.Username
	if username == "" {
		return nil, fmt.Errorf("username is required")
	}

	// Create a new session (24 hour duration)
	session, err := h.SessionStore.CreateSession(username, 24*time.Hour)
	if err != nil {
		return nil, fmt.Errorf("failed to create session: %w", err)
	}

	log.Printf("User logged in: %s (session: %s)", username, session.ID)

	// Create cookie string for Set-Cookie header
	cookieStr := fmt.Sprintf("%s=%s; Path=/; HttpOnly; Max-Age=%d", auth.SessionCookieName, session.ID, 24*60*60)

	return PostLogin200JSONResponse{
		Body: LoginResponse{
			Success:  boolPtr(true),
			Username: &username,
		},
		Headers: PostLogin200ResponseHeaders{
			SetCookie: cookieStr,
		},
	}, nil
}

// PostNotify implements StrictServerInterface
func (h *StrictApiHandler) PostNotify(ctx context.Context, request PostNotifyRequestObject) (PostNotifyResponseObject, error) {
	if request.Body == nil {
		return nil, fmt.Errorf("request body is required")
	}

	// Convert handler's NotifyRequest to types.NotifyRequest
	typesReq := types.NotifyRequest{
		FromUsername:   request.Body.FromUsername,
		Message:        request.Body.Message,
		TargetUsername: request.Body.TargetUsername,
	}

	// Pass the request to the service to broadcast
	go h.Service.BroadcastMessage(typesReq)

	return PostNotify200JSONResponse{Success: boolPtr(true)}, nil
}

// PostLogout implements StrictServerInterface
func (h *StrictApiHandler) PostLogout(ctx context.Context, request PostLogoutRequestObject) (PostLogoutResponseObject, error) {
	// Derive the Gin context from context.Context
	ginCtx, ok := ctx.(*gin.Context)
	if !ok {
		return nil, fmt.Errorf("context is not a gin.Context")
	}

	// Get session ID from cookie
	sessionID, err := ginCtx.Cookie(auth.SessionCookieName)
	if err == nil && sessionID != "" {
		// Delete the session
		h.SessionStore.DeleteSession(sessionID)
	}

	// Clear the session cookie
	auth.ClearSessionCookie(ginCtx)

	log.Printf("User logged out")

	return PostLogout200JSONResponse{Success: boolPtr(true)}, nil
}

// GetEvents implements StrictServerInterface for SSE streaming
func (h *StrictApiHandler) GetEvents(ctx context.Context, request GetEventsRequestObject) (GetEventsResponseObject, error) {
	// Derive the Gin context from context.Context
	ginCtx, ok := ctx.(*gin.Context)
	if !ok {
		return nil, fmt.Errorf("context is not a gin.Context")
	}

	// Get username from session cookie
	sessionID, err := ginCtx.Cookie(auth.SessionCookieName)
	if err != nil {
		ginCtx.JSON(http.StatusUnauthorized, map[string]string{"error": "Session not found"})
		return nil, fmt.Errorf("session not found")
	}

	session, exists := h.SessionStore.GetSession(sessionID)
	if !exists {
		ginCtx.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid or expired session"})
		return nil, fmt.Errorf("invalid or expired session")
	}

	username := session.Username

	// Set headers for SSE
	ginCtx.Header("Content-Type", "text/event-stream")
	ginCtx.Header("Cache-Control", "no-cache")
	ginCtx.Header("Connection", "keep-alive")

	// Get the channel for this user
	clientChan := h.Service.AddClient(username)
	defer h.Service.RemoveClient(username)

	// Get http.Flusher from ResponseWriter
	writer := ginCtx.Writer
	flusher, ok := writer.(http.Flusher)
	if !ok {
		ginCtx.JSON(http.StatusInternalServerError, map[string]string{"error": "Streaming unsupported!"})
		return nil, fmt.Errorf("streaming unsupported")
	}

	// Send an initial "connected" event
	welcomeMsg, _ := json.Marshal(map[string]string{"message": "Connected"})
	fmt.Fprintf(writer, "data: %s\n\n", string(welcomeMsg))
	flusher.Flush()

	// Listen for messages on the channel or client disconnect
	for {
		select {
		case msg := <-clientChan:
			// Send the message with proper SSE format
			_, err := fmt.Fprintf(writer, "data: %s\n\n", msg)
			if err != nil {
				// Client likely disconnected
				log.Printf("Error writing to client %s: %v", username, err)
				return nil, err
			}
			flusher.Flush()

		case <-ginCtx.Request.Context().Done():
			// Client disconnected
			log.Printf("Client %s disconnected.", username)
			return nil, nil
		}
	}
}

// GetUsers implements StrictServerInterface
func (h *StrictApiHandler) GetUsers(ctx context.Context, request GetUsersRequestObject) (GetUsersResponseObject, error) {
	users := h.Service.GetConnectedUsers()
	return GetUsers200JSONResponse(UsersResponse{
		Users: &users,
	}), nil
}

// PostAcknowledgeRequest implements StrictServerInterface
func (h *StrictApiHandler) PostAcknowledgeRequest(ctx context.Context, request PostAcknowledgeRequestRequestObject) (PostAcknowledgeRequestResponseObject, error) {
	// Derive the Gin context to get authenticated username
	ginCtx, ok := ctx.(*gin.Context)
	if !ok {
		return nil, fmt.Errorf("context is not a gin.Context")
	}

	sessionID, err := ginCtx.Cookie(auth.SessionCookieName)
	if err != nil {
		return nil, fmt.Errorf("session not found")
	}

	session, exists := h.SessionStore.GetSession(sessionID)
	if !exists {
		return nil, fmt.Errorf("invalid or expired session")
	}

	if request.Body == nil {
		return nil, fmt.Errorf("request body is required")
	}

	if len(request.Body.ToUsernames) == 0 {
		return nil, fmt.Errorf("to_usernames is required and must not be empty")
	}

	if request.Body.Message == "" {
		return nil, fmt.Errorf("message is required")
	}

	// Create the acknowledgment request via service
	requestID := h.Service.CreateAcknowledgmentRequest(
		session.Username,
		request.Body.ToUsernames,
		request.Body.Message,
	)

	return PostAcknowledgeRequest200JSONResponse(AcknowledgeRequestResponse{
		Success:    boolPtr(true),
		RequestId:  &requestID,
	}), nil
}

// PostAcknowledgeResponse implements StrictServerInterface
func (h *StrictApiHandler) PostAcknowledgeResponse(ctx context.Context, request PostAcknowledgeResponseRequestObject) (PostAcknowledgeResponseResponseObject, error) {
	// Derive the Gin context to get authenticated username
	ginCtx, ok := ctx.(*gin.Context)
	if !ok {
		return nil, fmt.Errorf("context is not a gin.Context")
	}

	sessionID, err := ginCtx.Cookie(auth.SessionCookieName)
	if err != nil {
		return nil, fmt.Errorf("session not found")
	}

	session, exists := h.SessionStore.GetSession(sessionID)
	if !exists {
		return nil, fmt.Errorf("invalid or expired session")
	}

	if request.Body == nil {
		return nil, fmt.Errorf("request body is required")
	}

	if request.Body.RequestId == "" {
		return nil, fmt.Errorf("request_id is required")
	}

	// Record the acknowledgment via service
	h.Service.RecordAcknowledgment(request.Body.RequestId, session.Username)

	return PostAcknowledgeResponse200JSONResponse(AcknowledgeResponseResponse{
		Success: boolPtr(true),
	}), nil
}
