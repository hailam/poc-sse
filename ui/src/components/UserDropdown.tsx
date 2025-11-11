import { useState } from "react";
import { useAppStore } from "../store";

interface UserDropdownProps {
  value: string;
  onChange: (username: string) => void;
  includeAll?: boolean;
}

export default function UserDropdown({ value, onChange, includeAll = true }: UserDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const users = useAppStore((state) => state.users);

  const handleSelect = (username: string) => {
    onChange(username);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button onClick={() => setIsOpen(!isOpen)} className="w-full form-input text-left flex justify-between items-center bg-white">
        <span>{value || "Select a user..."}</span>
        <span className="text-gray-500">▼</span>
      </button>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded ">
          {includeAll && (
            <button onClick={() => handleSelect("all")} className={`w-full text-left px-3 py-2 hover:bg-blue-50 ${value === "all" ? "bg-blue-100" : ""}`}>
              All Users
            </button>
          )}
          {users.map((user) => (
            <button key={user.username} onClick={() => handleSelect(user.username)} className={`w-full text-left px-3 py-2 hover:bg-blue-50 ${value === user.username ? "bg-blue-100" : ""}`}>
              {user.username}
            </button>
          ))}
          {users.length === 0 && !includeAll && <div className="px-3 py-2 text-gray-500 text-sm">No users available</div>}
        </div>
      )}
    </div>
  );
}
