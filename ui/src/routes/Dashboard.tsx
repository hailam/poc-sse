import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore, Notification } from "../store";
import { postNotify, postLogout, getUsers } from "../api";
import UserDropdown from "../components/UserDropdown";
import AcknowledgmentModal from "../components/AcknowledgmentModal";
import AcknowledgmentRequestModal from "../components/AcknowledgmentRequestModal";

export default function Dashboard() {
  const navigate = useNavigate();
  const { username, logout, setUsername } = useAppStore((state) => ({
    username: state.username,
    logout: state.logout,
    setUsername: state.setUsername,
  }));

  // App store actions
  const { users, setUsers, addUser, removeUser, notifications, addNotification, updateAcknowledgmentResponse, acknowledgmentRequests } = useAppStore();

  // Local state
  const [targetUser, setTargetUser] = useState("all");
  const [message, setMessage] = useState("");
  const [showAckModal, setShowAckModal] = useState(false);
  const [incomingAckRequest, setIncomingAckRequest] = useState<{
    id: string;
    from: string;
    message: string;
  } | null>(null);

  // Protect route
  useEffect(() => {
    if (!username) {
      navigate("/login");
    }
  }, [username, navigate]);

  // Fetch initial user list
  useEffect(() => {
    if (!username) return;

    const fetchUsers = async () => {
      try {
        const response = await getUsers({});
        if (response.users) {
          setUsers(response.users.map((u: string) => ({ username: u })));
        }
      } catch (err) {
        console.error("Failed to fetch users:", err);
      }
    };

    fetchUsers();
  }, [username, setUsers]);

  // Main SSE Logic
  useEffect(() => {
    if (!username) return;

    const eventSource = new EventSource("/api/events");

    eventSource.onopen = () => {
      console.log("SSE connection opened");
    };

    eventSource.onerror = (err) => {
      console.error("EventSource failed:", err);
      eventSource.close();
    };

    // Handle all SSE messages
    eventSource.onmessage = (event) => {
      try {
        const sseEvent = JSON.parse(event.data);
        const eventType = sseEvent.type;
        const payload = sseEvent.payload;

        // Route based on event type
        if (eventType === "notification") {
          addNotification({
            id: payload.id,
            from: payload.from,
            message: payload.message,
            timestamp: payload.timestamp,
          });
        } else if (eventType === "user_connected") {
          if (payload.username && payload.username !== username) {
            addUser(payload.username);
          }
        } else if (eventType === "user_disconnected") {
          removeUser(payload.username);
        } else if (eventType === "acknowledgment_request") {
          setIncomingAckRequest({
            id: payload.id,
            from: payload.from_username,
            message: payload.message,
          });
        } else if (eventType === "acknowledgment_response") {
          console.log("Received acknowledgment_response:", payload);
          updateAcknowledgmentResponse(payload.request_id, payload.from_username);
          console.log("Updated acknowledgment for request:", payload.request_id, "from:", payload.from_username);
        }
      } catch (e) {
        console.error("Failed to parse SSE message:", e);
      }
    };

    // Cleanup on unmount
    return () => {
      eventSource.close();
    };
  }, [username, addNotification, addUser, removeUser, updateAcknowledgmentResponse]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !username) return;

    try {
      await postNotify({
        from_username: username,
        target_username: targetUser,
        message: message,
      });
      setMessage("");
    } catch (err) {
      console.error("Failed to send notification:", err);
    }
  };

  const handleLogout = async () => {
    try {
      await postLogout({});
    } catch (err) {
      console.error("Failed to logout:", err);
    }
    logout();
    navigate("/login");
  };

  if (!username) return null;

  return (
    <div className="min-h-screen bg-gray-100 w-full">
      {/* Header */}
      <header className="bg-white  w-full">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Chat Dashboard</h1>
            <p className="text-gray-600 text-sm">
              Logged in as <span className="font-semibold">{username}</span>
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowAckModal(true)} className="btn-secondary" title="Send acknowledgment request">
              Wait For...
            </button>
            <button onClick={handleLogout} className="btn-danger">
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Send Messages Section */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg  p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Send Message</h2>

              <form onSubmit={handleSend} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">To</label>
                  <UserDropdown value={targetUser} onChange={setTargetUser} includeAll={true} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
                  <textarea placeholder="Type your message..." value={message} onChange={(e) => setMessage(e.target.value)} className="form-textarea" rows={4} />
                </div>

                <button type="submit" disabled={!message.trim()} className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
                  Send
                </button>
              </form>

              {/* Connected Users */}
              <div className="mt-6 pt-6 border-t">
                <h3 className="text-sm font-bold text-gray-700 mb-3">Connected Users ({users.length})</h3>
                <div className="space-y-2">
                  {users.length === 0 ? (
                    <p className="text-gray-500 text-sm">No other users connected</p>
                  ) : (
                    users.map((user) => (
                      <div key={user.username} className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded border border-green-200">
                        <span className="text-gray-800 font-medium">{user.username}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Messages and Acknowledgments Section */}
          <div className="lg:col-span-2 space-y-6">
            {/* Notifications Feed */}
            <div className="bg-white rounded-lg  p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Messages ({notifications.length})</h2>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No messages yet</p>
                ) : (
                  notifications.map((notif) => (
                    <div key={notif.id || Math.random().toString()} className=" bg-blue-50 p-4 rounded-r">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <p className="font-semibold text-gray-800">{notif.from || "Unknown"}</p>
                          <p className="text-gray-700">{notif.message || "No message"}</p>
                        </div>
                        <span className="text-xs text-gray-500 whitespace-nowrap">{notif.timestamp ? new Date(notif.timestamp).toLocaleTimeString() : "N/A"}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Acknowledgments Status */}
            {acknowledgmentRequests.length > 0 && (
              <div className="bg-white rounded-lg  p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">Acknowledgment Requests</h2>
                <div className="space-y-4">
                  {acknowledgmentRequests.map((req) => (
                    <div key={req.id} className="border border-yellow-300 bg-yellow-50 p-4 rounded">
                      <p className="font-semibold text-gray-800 mb-2">{req.message}</p>
                      <div className="space-y-2">
                        {req.toUsernames.map((user) => {
                          const ackd = req.acknowledgedBy.includes(user);
                          return (
                            <div key={user} className="flex items-center gap-2">
                              <span className={`text-sm font-medium ${ackd ? "text-green-600" : "text-gray-500"}`}>{ackd ? "[Done]" : "[Waiting]"}</span>
                              <span className={ackd ? "text-green-600 line-through" : ""}>{user}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <AcknowledgmentModal isOpen={showAckModal} onClose={() => setShowAckModal(false)} />

      <AcknowledgmentRequestModal isOpen={!!incomingAckRequest} requestId={incomingAckRequest?.id ?? null} fromUsername={incomingAckRequest?.from ?? null} message={incomingAckRequest?.message ?? null} onClose={() => setIncomingAckRequest(null)} onAcknowledge={() => setIncomingAckRequest(null)} />
    </div>
  );
}
