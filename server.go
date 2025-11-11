package main

import (
	"log"
	"sse-demo/auth"
	"sse-demo/handler"
	"sse-demo/service"

	"github.com/gin-gonic/gin"
)

func main() {
	// 1. Create the session store for authentication
	sessionStore := auth.NewSessionStore()

	// 2. Create the notification service (our in-memory "state")
	notificationService := service.NewNotificationService()

	// 3. Create the handler which implements the StrictServerInterface
	apiHandler := handler.NewStrictApiHandler(notificationService, sessionStore)

	// 4. Create a strict handler wrapper for type safety
	strictHandler := handler.NewStrictHandler(apiHandler, nil)

	// 5. Set up Gin
	r := gin.Default()

	// 6. Register the generated routes
	handler.RegisterHandlers(r, strictHandler)

	// 7. Start the server
	log.Println("Starting server on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatal(err)
	}
}
