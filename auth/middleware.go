package auth

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

const (
	SessionCookieName = "session_id"
	UsernameContextKey = "username"
)

// AuthMiddleware checks for valid session and adds username to context
func AuthMiddleware(sessionStore *SessionStore) gin.HandlerFunc {
	return func(c *gin.Context) {
		cookie, err := c.Cookie(SessionCookieName)
		if err != nil {
			c.JSON(http.StatusUnauthorized, map[string]string{
				"error": "Session not found",
			})
			c.Abort()
			return
		}

		session, exists := sessionStore.GetSession(cookie)
		if !exists {
			c.JSON(http.StatusUnauthorized, map[string]string{
				"error": "Invalid or expired session",
			})
			c.Abort()
			return
		}

		// Add username to context for handlers to use
		c.Set(UsernameContextKey, session.Username)
		c.Next()
	}
}

// GetUsernameFromContext extracts the authenticated username from context
func GetUsernameFromContext(c *gin.Context) (string, bool) {
	username, exists := c.Get(UsernameContextKey)
	if !exists {
		return "", false
	}

	usernameStr, ok := username.(string)
	return usernameStr, ok
}

// SetSessionCookie sets the session cookie on the response
func SetSessionCookie(c *gin.Context, sessionID string, maxAge int) {
	c.SetCookie(
		SessionCookieName,
		sessionID,
		maxAge,           // max age in seconds
		"/",              // path
		"localhost",      // domain (use localhost for development, would be different in production)
		false,            // secure (set to true in production with HTTPS)
		true,             // httpOnly
	)
}

// ClearSessionCookie clears the session cookie
func ClearSessionCookie(c *gin.Context) {
	c.SetCookie(
		SessionCookieName,
		"",
		-1,               // negative age to delete
		"/",              // path
		"localhost",      // domain
		false,            // secure
		true,             // httpOnly
	)
}
